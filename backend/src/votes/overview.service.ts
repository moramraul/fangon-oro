import { EditionsService } from '../editions/editions.service';
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
import { Vote } from './schemas/vote.schema';

@Injectable()
export class OverviewService {
  constructor(
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Vote.name) private readonly votes: Model<Vote>,
    private readonly eventsService: EventsService,
    private readonly snapshots: RankingSnapshotsService,
    private readonly editions: EditionsService,
  ) {}

  private start(event: EventDocument) {
    return event.startDate ?? event.date;
  }

  async overview(user: UserDocument, selection?: string) {
    await this.eventsService.closeExpired();
    const scope = selection === 'global' ? 'global' : 'edition';
    const edition =
      scope === 'global'
        ? null
        : selection
          ? await this.editions.find(selection)
          : await this.editions.current();
    const editionId = edition?._id.toHexString();
    const events = await this.events
      .find(
        scope === 'global'
          ? { status: EventStatus.CLOSED, editionId: { $exists: true } }
          : { editionId: edition?._id },
      )
      .sort({ startDate: -1 })
      .exec();
    const votedEventIds = new Set(
      (await this.votes.distinct('eventId', { voterId: user._id }).exec()).map(
        (id: Types.ObjectId) => id.toHexString(),
      ),
    );
    const snapshot = await this.snapshots.latest();
    const standings =
      scope === 'global'
        ? (snapshot?.generalRanking?.entries ?? [])
        : edition?.status === 'closed'
          ? (edition.finalRanking?.entries ?? [])
          : (snapshot?.editions?.[editionId!] ?? []);
    return {
      scope,
      edition: edition ? this.editions.summary(edition) : null,
      editions: await this.editions.list(),
      year: edition?.number ?? null,
      rankingYear: edition?.number ?? null,
      serverTime: new Date().toISOString(),
      calculatedAt:
        edition?.status === 'closed'
          ? (edition.closedAt?.toISOString() ?? null)
          : scope === 'global' || (editionId && snapshot?.editions?.[editionId])
            ? (snapshot?.calculatedAt?.toISOString() ?? null)
            : null,
      standings: standings.map((entry) => ({ ...entry, rank: entry.position })),
      events: events.map((event) => ({
        id: event._id.toHexString(),
        editionId: event.editionId.toHexString(),
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
    if (!event || !event.editionId)
      throw new NotFoundException('Event not found');
    if (event.status === EventStatus.CLOSED) {
      const snapshot = await this.snapshots.forEvent(event._id.toHexString());
      if (!snapshot?.eventRanking)
        throw new ServiceUnavailableException(
          'Event snapshot is not available yet',
        );
      return {
        id,
        editionId: event.editionId.toHexString(),
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
