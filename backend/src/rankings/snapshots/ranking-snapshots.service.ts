import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Event, EventStatus } from '../../events/schemas/event.schema';
import { User } from '../../users/schemas/user.schema';
import { pointsPipeline } from '../../votes/points.pipeline';
import { Score } from '../../votes/score';
import { Vote } from '../../votes/schemas/vote.schema';
import { Ranking } from '../models/ranking.model';
import {
  RankingSnapshot,
  SnapshotEntry,
  SnapshotRanking,
} from './ranking-snapshot.schema';

@Injectable()
export class RankingSnapshotsService {
  constructor(
    @InjectModel(RankingSnapshot.name)
    private readonly snapshots: Model<RankingSnapshot>,
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Vote.name) private readonly votes: Model<Vote>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async latest(session?: ClientSession) {
    const query = this.snapshots.findOne({
      key: { $ne: '__lock__' },
      'event.editionId': { $exists: true },
    });
    if (session) query.session(session);
    return query.sort({ revision: -1 }).lean().exec();
  }

  async forEvent(eventId: string) {
    const snapshot = await this.snapshots
      .findOne({ key: eventId })
      .lean()
      .exec();
    if (!snapshot) return null;
    return {
      ...snapshot,
      eventRanking: snapshot.eventRanking
        ? await this.withProfiles(snapshot.eventRanking)
        : undefined,
    };
  }

  // Resolve display data on every read; legacy embedded profiles are ignored.
  async withProfiles(ranking: SnapshotRanking): Promise<Ranking> {
    const ids = [...new Set(ranking.entries.map((entry) => entry.id))];
    const users = ids.length
      ? await this.users
          .find({ _id: { $in: ids } })
          .select('_id name avatar')
          .lean()
          .exec()
      : [];
    const profiles = new Map(
      users.map((user) => [user._id.toHexString(), user]),
    );
    return {
      ...ranking,
      entries: ranking.entries.map((entry) => ({
        ...entry,
        name: profiles.get(entry.id)?.name ?? 'Usuario eliminado',
        avatar: profiles.get(entry.id)?.avatar ?? null,
      })),
    };
  }

  // Explicit allowlist also strips profile fields from legacy snapshots.
  withoutProfiles(ranking: SnapshotRanking): SnapshotRanking {
    return {
      ...ranking,
      entries: ranking.entries.map((entry) => ({
        id: entry.id,
        points: entry.points,
        fivePointVotes: entry.fivePointVotes,
        threePointVotes: entry.threePointVotes,
        percentage: entry.percentage,
        position: entry.position,
        ...(entry.eventsParticipated === undefined
          ? {}
          : { eventsParticipated: entry.eventsParticipated }),
      })),
    };
  }

  // Also repairs interrupted writes and backfills events closed before snapshots existed.
  async reconcile() {
    const [closed, saved] = await Promise.all([
      this.events
        .find({ status: EventStatus.CLOSED, editionId: { $exists: true } })
        .sort({ endDate: 1, _id: 1 })
        .select('_id')
        .lean()
        .exec(),
      this.snapshots.distinct('key').exec(),
    ]);
    const keys = new Set(saved);
    for (const event of closed) {
      if (!keys.has(event._id.toHexString()))
        await this.capture(event._id.toHexString());
    }
  }

  async capture(eventId: string, session?: ClientSession): Promise<void> {
    if (!session) {
      await this.initialize();
      await this.connection.transaction((transaction) =>
        this.capture(eventId, transaction),
      );
      return;
    }
    // Every writer touches this document first: concurrent closures retry rather
    // than publishing totals that omit one another's events.
    const lock = await this.snapshots
      .findOneAndUpdate(
        { key: '__lock__' },
        { $inc: { revision: 1 } },
        { session, new: true },
      )
      .exec();
    if (!lock) throw new Error('Snapshot lock has not been initialized');
    if (await this.snapshots.exists({ key: eventId }).session(session).exec())
      return;
    const event = await this.events
      .findOne({ _id: eventId, status: EventStatus.CLOSED })
      .session(session)
      .exec();
    if (!event) return;
    if (!event.editionId) throw new Error('Event has no edition assigned');
    const editionId = event.editionId.toHexString();
    const startDate = event.startDate ?? event.date;
    if (!startDate)
      throw new Error(`Closed event ${eventId} has no start date`);
    const counts = await this.votes
      .aggregate<{ _id: Types.ObjectId } & Score>([
        { $match: { eventId: event._id } },
        ...pointsPipeline(),
      ])
      .session(session)
      .exec();
    const scores = new Map(
      counts.map((score) => [score._id.toHexString(), score]),
    );
    const ids = [
      ...new Set([
        ...event.participants.map((id) => id.toHexString()),
        ...scores.keys(),
      ]),
    ];
    const candidates = ids.map((id) => ({
      id,
      name: '',
      points: scores.get(id)?.points ?? 0,
      fivePointVotes: scores.get(id)?.fivePointVotes ?? 0,
      threePointVotes: scores.get(id)?.threePointVotes ?? 0,
    }));
    const eventRanking = this.withoutProfiles(
      Ranking.from(
        candidates,
        counts.reduce((sum, score) => sum + score.points, 0),
        { id: eventId, status: EventStatus.CLOSED },
      ),
    );
    const totalVotes = await this.votes
      .countDocuments({ eventId: event._id })
      .session(session)
      .exec();
    const previous = await this.snapshots
      .find({ key: { $ne: '__lock__' }, 'event.editionId': { $exists: true } })
      .sort({ revision: 1 })
      .session(session)
      .lean()
      .exec();
    const contributions = [...previous, { event: { editionId }, eventRanking }];
    const generalRanking = this.combine(
      contributions.flatMap((snapshot) => snapshot.eventRanking?.entries ?? []),
    );
    const editions: Record<string, SnapshotEntry[]> = {};
    for (const id of new Set(
      contributions.map((snapshot) => snapshot.event!.editionId),
    )) {
      editions[id] = this.combine(
        contributions
          .filter((snapshot) => snapshot.event!.editionId === id)
          .flatMap((snapshot) => snapshot.eventRanking!.entries),
      ).entries as SnapshotEntry[];
    }
    await this.snapshots.create(
      [
        {
          key: eventId,
          revision: lock.revision,
          calculatedAt: new Date(),
          totalVotes,
          participantCount: event.participants.length,
          event: {
            id: eventId,
            name: event.name,
            image: event.image ?? null,
            startDate,
            endDate: event.endDate,
            editionId,
          },
          eventRanking,
          generalRanking,
          editions,
        },
      ],
      { session },
    );
  }

  // Derive participation from individual closed-event snapshots, including old
  // snapshots that predate the participation field. Never sum cumulative totals.
  async withParticipation(
    entries: SnapshotEntry[],
    editionId?: string,
  ): Promise<Ranking> {
    const contributions = await this.snapshots
      .find({
        key: { $ne: '__lock__' },
        'event.editionId': editionId ?? { $exists: true },
      })
      .select('eventRanking.entries.id')
      .lean()
      .exec();
    const counts = new Map<string, number>();
    for (const snapshot of contributions) {
      for (const id of new Set(
        (snapshot.eventRanking?.entries ?? []).map((entry) => entry.id),
      ))
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return this.withProfiles(
      Ranking.from(
        entries.map((entry) => ({
          ...entry,
          name: '',
          eventsParticipated:
            counts.get(entry.id) ?? entry.eventsParticipated ?? 0,
        })),
        entries.reduce((sum, entry) => sum + entry.points, 0),
      ),
    );
  }

  combine(entries: SnapshotEntry[]): SnapshotRanking {
    const totals = new Map<string, SnapshotEntry>();
    for (const entry of entries) {
      const prior = totals.get(entry.id);
      totals.set(entry.id, {
        ...entry,
        eventsParticipated: (prior?.eventsParticipated ?? 0) + 1,
        points: (prior?.points ?? 0) + entry.points,
        fivePointVotes: (prior?.fivePointVotes ?? 0) + entry.fivePointVotes,
        threePointVotes: (prior?.threePointVotes ?? 0) + entry.threePointVotes,
      });
    }
    return this.withoutProfiles(
      Ranking.from(
        [...totals.values()].map((entry) => ({ ...entry, name: '' })),
        [...totals.values()].reduce((sum, entry) => sum + entry.points, 0),
      ),
    );
  }

  async initialize() {
    await this.snapshots.init();
    await this.snapshots
      .updateOne(
        { key: '__lock__' },
        { $setOnInsert: { revision: 0 } },
        { upsert: true },
      )
      .exec();
  }
}
