import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventsService } from '../events/events.service';
import { Event, EventDocument } from '../events/schemas/event.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { editionYear } from './edition';
import { pointsPipeline } from './points.pipeline';
import { compareScores, Score } from './score';
import { Vote } from './schemas/vote.schema';

@Injectable()
export class OverviewService {
  constructor(
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Vote.name) private readonly votes: Model<Vote>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly eventsService: EventsService,
    private readonly snapshots: RankingSnapshotsService,
  ) {}

  private start(event: EventDocument) {
    return event.startDate ?? event.date;
  }

  private async ranking(events: EventDocument[]) {
    const participantIds = [
      ...new Map(
        events.flatMap((event) =>
          event.participants.map((id) => [id.toHexString(), id] as const),
        ),
      ).values(),
    ];
    if (!participantIds.length) return [];
    const [counts, participants] = await Promise.all([
      this.votes
        .aggregate<{ _id: Types.ObjectId } & Score>([
          { $match: { eventId: { $in: events.map((event) => event._id) } } },
          ...pointsPipeline(),
        ])
        .exec(),
      this.users
        .find({ _id: { $in: participantIds } })
        .select('_id name avatar')
        .exec(),
    ]);
    const byUser = new Map(
      counts.map((entry) => [entry._id.toHexString(), entry]),
    );
    const sorted = participants
      .map((user) => {
        const score = byUser.get(user._id.toHexString());
        return {
          id: user._id.toHexString(),
          name: user.name,
          avatar: user.avatar ?? null,
          points: score?.points ?? 0,
          fivePointVotes: score?.fivePointVotes ?? 0,
          threePointVotes: score?.threePointVotes ?? 0,
        };
      })
      .sort(
        (a, b) =>
          compareScores(a, b) ||
          a.name.localeCompare(b.name, 'es') ||
          a.id.localeCompare(b.id),
      );
    let rank = 0;
    return sorted.map((entry, index) => {
      if (!index || compareScores(entry, sorted[index - 1]) !== 0)
        rank = index + 1;
      return { ...entry, rank };
    });
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
    return {
      id,
      name: event.name,
      image: event.image ?? null,
      standings: await this.ranking([event]),
    };
  }
}
