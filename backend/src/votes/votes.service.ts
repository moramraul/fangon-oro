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

  async cast(eventId: string, votedUserId: string, user: UserDocument) {
    const detail = await this.eventsService.getDetail(eventId, user);
    if (
      !detail.participants.some(
        (participant) => participant.id === user._id.toHexString(),
      )
    ) {
      throw new ForbiddenException('Only participants can vote');
    }
    if (!Types.ObjectId.isValid(votedUserId))
      throw new BadRequestException('Invalid candidate ID');
    const candidateId = new Types.ObjectId(votedUserId);
    if (candidateId.equals(user._id)) {
      throw new BadRequestException('You cannot vote for yourself');
    }
    if (
      !detail.participants.some(
        (participant) => participant.id === candidateId.toHexString(),
      )
    ) {
      throw new BadRequestException('Candidate must participate in the event');
    }
    try {
      return await this.connection.transaction(async (session) => {
        const event = await this.eventModel
          .findOneAndUpdate(
            {
              _id: eventId,
              status: EventStatus.OPEN,
              participants: { $all: [user._id, candidateId] },
            },
            { $inc: { votingRevision: 1 } },
            { session, new: true },
          )
          .exec();
        if (!event) throw new ConflictException('Voting is not open');
        const [vote] = await this.voteModel.create(
          [{ eventId: event._id, voterId: user._id, votedUserId: candidateId }],
          { session },
        );
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
      .aggregate<{ _id: Types.ObjectId; votes: number }>([
        { $match: { eventId: new Types.ObjectId(eventId) } },
        { $group: { _id: '$votedUserId', votes: { $sum: 1 } } },
      ])
      .exec();
    const totalVotes = counts.reduce((total, entry) => total + entry.votes, 0);
    const byUser = new Map(
      counts.map((entry) => [entry._id.toHexString(), entry.votes]),
    );
    const candidates = event.participants
      .map((participant) => {
        const votes = byUser.get(participant.id) ?? 0;
        return {
          ...participant,
          votes,
          percentage: totalVotes
            ? Math.round((votes / totalVotes) * 10000) / 100
            : 0,
        };
      })
      .sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id));
    const highest = candidates[0]?.votes ?? 0;
    return {
      eventId: event.id,
      status: event.status,
      totalVotes,
      participantCount: event.participantCount,
      participationPercentage: event.participantCount
        ? Math.round((totalVotes / event.participantCount) * 10000) / 100
        : 0,
      candidates,
      leaderIds: highest
        ? candidates
            .filter((candidate) => candidate.votes === highest)
            .map((candidate) => candidate.id)
        : [],
    };
  }

  private response(vote: Vote) {
    return {
      eventId: vote.eventId.toHexString(),
      votedUserId: vote.votedUserId.toHexString(),
      createdAt: vote.createdAt.toISOString(),
    };
  }
}
