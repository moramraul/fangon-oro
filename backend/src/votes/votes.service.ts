import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { EventsService } from '../events/events.service';
import { Event, EventStatus } from '../events/schemas/event.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { compareScores, Score } from './score';
import { pointsPipeline } from './points.pipeline';
import { Vote } from './schemas/vote.schema';

@Injectable()
export class VotesService implements OnModuleInit {
  constructor(
    @InjectModel(Vote.name) private readonly voteModel: Model<Vote>,
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @InjectConnection() private readonly connection: Connection,
    private readonly eventsService: EventsService,
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

  async results(eventId: string, user: UserDocument) {
    const event = await this.eventsService.getDetail(eventId, user);
    const counts = await this.voteModel
      .aggregate<{ _id: Types.ObjectId } & Score>([
        { $match: { eventId: new Types.ObjectId(eventId) } },
        ...pointsPipeline(),
      ])
      .exec();
    const totalVotes = await this.voteModel
      .countDocuments({ eventId: new Types.ObjectId(eventId) })
      .exec();
    const totalPoints = counts.reduce(
      (total, entry) => total + entry.points,
      0,
    );
    const byUser = new Map(
      counts.map((entry) => [entry._id.toHexString(), entry]),
    );
    const candidates = event.participants
      .map((participant) => {
        const score = byUser.get(participant.id);
        const points = score?.points ?? 0;
        return {
          ...participant,
          points,
          fivePointVotes: score?.fivePointVotes ?? 0,
          threePointVotes: score?.threePointVotes ?? 0,
          percentage: totalPoints
            ? Math.round((points / totalPoints) * 10000) / 100
            : 0,
        };
      })
      .sort((a, b) => compareScores(a, b) || a.id.localeCompare(b.id));
    const highest = candidates[0]?.points ?? 0;
    return {
      eventId: event.id,
      status: event.status,
      totalVotes,
      totalPoints,
      participantCount: event.participantCount,
      participationPercentage: event.participantCount
        ? Math.round((totalVotes / event.participantCount) * 10000) / 100
        : 0,
      candidates,
      leaderIds: highest
        ? candidates
            .filter(
              (candidate) => compareScores(candidate, candidates[0]) === 0,
            )
            .map((candidate) => candidate.id)
        : [],
    };
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
