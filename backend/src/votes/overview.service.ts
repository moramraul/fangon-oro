import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventsService } from '../events/events.service';
import {
  Event,
  EventDocument,
  EventStatus,
} from '../events/schemas/event.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { editionYear } from './edition';
import { Vote } from './schemas/vote.schema';

@Injectable()
export class OverviewService {
  constructor(
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Vote.name) private readonly votes: Model<Vote>,
    private readonly eventsService: EventsService,
    private readonly snapshots: RankingSnapshotsService,
  ) {}

  private start(event: EventDocument) {
    return event.startDate ?? event.date;
  }

  async overview(user: UserDocument) {
    await this.eventsService.closeExpired();
    const now = new Date();
    const year = editionYear(now);
    const events = await this.events.find().sort({ startDate: -1 }).exec();
    const votedEventIds = new Set(
      (await this.votes.distinct('eventId', { voterId: user._id }).exec()).map(
        (id: Types.ObjectId) => id.toHexString(),
      ),
    );
    const snapshot = await this.snapshots.latest();
    const availableYears = Object.keys(snapshot?.editions ?? {}).map(Number);
    const rankingYear = availableYears.length
      ? Math.max(...availableYears)
      : year;
    const standings = snapshot?.editions?.[rankingYear] ?? [];
    return {
      year,
      rankingYear,
      serverTime: now.toISOString(),
      calculatedAt: snapshot?.calculatedAt?.toISOString() ?? null,
      standings: standings.map((entry) => ({ ...entry, rank: entry.position })),
      events: events
        .filter((event) => {
          const start = this.start(event);
          return start && editionYear(start) === year;
        })
        .map((event) => ({
          id: event._id.toHexString(),
          name: event.name,
          image: event.image ?? null,
          startDate: this.start(event).toISOString(),
          endDate: event.endDate?.toISOString() ?? null,
          status: event.status,
          participantCount: event.participants.length,
          canVote: event.participants.some((id) => id.equals(user._id)),
          hasVoted: votedEventIds.has(event._id.toHexString()),
        })),
    };
  }

  async results(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Event not found');
    await this.eventsService.closeExpired();
    const event = await this.events.findById(id).exec();
    if (
      !event ||
      !this.start(event) ||
      editionYear(this.start(event)) !== editionYear(new Date())
    )
      throw new NotFoundException('Event not found');
    if (event.status === EventStatus.CLOSED) {
      const snapshot = await this.snapshots.forEvent(event._id.toHexString());
      if (!snapshot?.eventRanking)
        throw new ServiceUnavailableException(
          'Event snapshot is not available yet',
        );
      return {
        id,
        name: snapshot.event?.name ?? event.name,
        image:
          snapshot.event?.image === undefined
            ? (event.image ?? null)
            : snapshot.event.image,
        calculatedAt: snapshot.calculatedAt?.toISOString() ?? null,
        standings: snapshot.eventRanking.entries.map((entry) => ({
          ...entry,
          rank: entry.position,
        })),
      };
    }
    throw new ConflictException(
      'Results are only available after the event closes',
    );
  }
}
