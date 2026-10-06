import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import { RankingEntry } from '../rankings/models/ranking.model';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { EventsService } from '../events/events.service';
import {
  Event,
  EventStatus,
  EventSummaryStatus,
} from '../events/schemas/event.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { Vote } from './schemas/vote.schema';

export interface EventResults {
  eventId: string;
  status: EventSummaryStatus;
  calculatedAt?: string | null;
  totalVotes: number | null;
  totalPoints: number;
  participantCount: number;
  participationPercentage: number | null;
  candidates: (Omit<RankingEntry, 'position'> & { position?: number })[];
  leaderIds: string[];
}

@Injectable()
export class VotesService implements OnModuleInit {
  constructor(
    @InjectModel(Vote.name) private readonly voteModel: Model<Vote>,
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @InjectConnection() private readonly connection: Connection,
    private readonly eventsService: EventsService,
    private readonly snapshots: RankingSnapshotsService,
  ) {}

  async onModuleInit() {
    // Wait for the unique index before accepting requests.
    await this.voteModel.init();
  }

  async cast(eventId: string, candidateIds: string[], user: UserDocument) {
    const detail = await this.eventsService.getDetail(eventId, user);
    if (
      !detail.participants.some(
        (participant) => participant.id === user._id.toHexString(),
      )
    ) {
      throw new ForbiddenException('Only participants can vote');
    }
    if (
      !Array.isArray(candidateIds) ||
      candidateIds.length !== 3 ||
      candidateIds.some((id) => !Types.ObjectId.isValid(id))
    )
      throw new BadRequestException('Select exactly three valid candidates');
    const ids = candidateIds.map((id) => new Types.ObjectId(id));
    if (new Set(ids.map((id) => id.toHexString())).size !== 3)
      throw new BadRequestException('Candidates must be distinct');
    if (ids.some((id) => id.equals(user._id)))
      throw new BadRequestException('You cannot vote for yourself');
    if (
      ids.some(
        (id) =>
          !detail.participants.some(
            (participant) => participant.id === id.toHexString(),
          ),
      )
    )
      throw new BadRequestException('Candidates must participate in the event');
    const allocations = ids.map((id, index) => ({
      votedUserId: id,
      points: [5, 3, 1][index],
    }));
    try {
      return await this.connection.transaction(async (session) => {
        const event = await this.eventModel
          .findOneAndUpdate(
            {
              _id: eventId,
              status: EventStatus.OPEN,
              startDate: { $lte: new Date() },
              endDate: { $gt: new Date() },
              participants: { $all: [user._id, ...ids] },
            },
            { $inc: { votingRevision: 1 } },
            { session, new: true },
          )
          .exec();
        if (!event) throw new ConflictException('Voting is not open');
        const [vote] = await this.voteModel.create(
          [{ eventId: event._id, voterId: user._id, allocations }],
          { session },
        );
        const totalVotes = await this.voteModel
          .countDocuments({
            eventId: event._id,
            voterId: { $in: event.participants },
          })
          .session(session)
          .exec();
        if (totalVotes === event.participants.length) {
          await this.eventModel
            .updateOne(
              { _id: event._id, status: EventStatus.OPEN },
              { $set: { status: EventStatus.CLOSED } },
              { session },
            )
            .exec();
        }
        if (totalVotes === event.participants.length)
          await this.snapshots.capture(eventId, session);
        return this.response(vote);
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('You have already voted in this event');
      }
      throw error;
    }
  }

  async mine(eventId: string, user: UserDocument) {
    await this.eventsService.getDetail(eventId, user);
    const vote = await this.voteModel
      .findOne({ eventId, voterId: user._id })
      .exec();
    return vote ? this.response(vote) : null;
  }

  async results(eventId: string, user: UserDocument): Promise<EventResults> {
    const event = await this.eventsService.getDetail(eventId, user);
    if (event.status === EventStatus.CLOSED) {
      const snapshot = await this.snapshots.forEvent(event.id);
      if (!snapshot?.eventRanking)
        throw new ServiceUnavailableException(
          'Event snapshot is not available yet',
        );
      const ranking = snapshot.eventRanking;
      const candidates: RankingEntry[] = ranking.entries;
      // Older snapshots preserve scores but did not record participation counts.
      const totalVotes = snapshot.totalVotes ?? null;
      const participantCount =
        snapshot.participantCount ?? ranking.entries.length;
      return {
        eventId: event.id,
        status: EventStatus.CLOSED,
        calculatedAt: snapshot.calculatedAt?.toISOString() ?? null,
        totalVotes,
        totalPoints: ranking.totalPoints,
        participantCount,
        participationPercentage:
          totalVotes === null
            ? null
            : participantCount
              ? Math.round((totalVotes / participantCount) * 10000) / 100
              : 0,
        candidates,
        leaderIds: ranking.leaderIds,
      };
    }
    throw new ConflictException(
      'Results are only available after the event closes',
    );
  }

  private response(vote: Vote) {
    return {
      eventId: vote.eventId.toHexString(),
      allocations: (
        vote.allocations ??
        (vote.votedUserId ? [{ votedUserId: vote.votedUserId, points: 1 }] : [])
      ).map((entry) => ({
        votedUserId: entry.votedUserId.toHexString(),
        points: entry.points,
      })),
      createdAt: vote.createdAt.toISOString(),
    };
  }
}
