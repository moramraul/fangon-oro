import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Event, EventStatus } from '../../events/schemas/event.schema';
import { User } from '../../users/schemas/user.schema';
import { Vote } from '../../votes/schemas/vote.schema';
import { RankingSnapshot, SnapshotEntry } from './ranking-snapshot.schema';
import { RankingSnapshotsService } from './ranking-snapshots.service';

function query(value: unknown) {
  const result = {
    exec: jest.fn().mockResolvedValue(value),
    session: jest.fn(),
    select: jest.fn(),
    sort: jest.fn(),
    lean: jest.fn(),
  };
  for (const method of ['session', 'select', 'sort', 'lean'] as const)
    result[method].mockReturnValue(result);
  return result;
}

describe('RankingSnapshotsService', () => {
  const id = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const session = {} as ClientSession;
  const snapshots = {
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
    find: jest.fn(),
    create: jest.fn<
      Promise<unknown>,
      [RankingSnapshot[], { session: ClientSession }]
    >(),
    findOne: jest.fn(),
    distinct: jest.fn(),
  };
  const events = { findOne: jest.fn(), find: jest.fn() };
  const votes = { aggregate: jest.fn(), countDocuments: jest.fn() };
  const users = { find: jest.fn() };
  let service: RankingSnapshotsService;
  beforeEach(() => {
    jest.resetAllMocks();
    votes.countDocuments.mockReturnValue(query(1));
    snapshots.findOneAndUpdate.mockReturnValue(query({ revision: 2 }));
    snapshots.exists.mockReturnValue(query(null));
    snapshots.find.mockReturnValue(query([]));
    events.findOne.mockReturnValue(
      query({
        _id: id,
        name: 'Evento',
        status: EventStatus.CLOSED,
        startDate: new Date('2026-10-01'),
        participants: [userId],
      }),
    );
    votes.aggregate.mockReturnValue(
      query([
        { _id: userId, points: 9, fivePointVotes: 1, threePointVotes: 1 },
      ]),
    );
    users.find.mockReturnValue(
      query([{ _id: userId, name: 'Ana', avatar: 'avatar.png' }]),
    );
    service = new RankingSnapshotsService(
      snapshots as unknown as Model<RankingSnapshot>,
      events as unknown as Model<Event>,
      votes as unknown as Model<Vote>,
      users as unknown as Model<User>,
      {} as Connection,
    );
  });

  it('stores the final event, general and edition classifications with date in the same session', async () => {
    await service.capture(id.toHexString(), session);
    const saved = snapshots.create.mock.calls[0][0][0];
    expect(saved.calculatedAt).toBeInstanceOf(Date);
    expect(saved.event).toMatchObject({
      id: id.toHexString(),
      name: 'Evento',
      year: 2026,
    });
    expect(saved.eventRanking?.entries[0]).toMatchObject({
      name: 'Ana',
      avatar: 'avatar.png',
      points: 9,
      position: 1,
    });
    expect(saved.generalRanking?.totalPoints).toBe(9);
    expect(saved.editions?.['2026'][0].points).toBe(9);
    expect(snapshots.create.mock.calls[0][1]).toEqual({ session });
    expect(snapshots.findOneAndUpdate).toHaveBeenCalledWith(
      { key: '__lock__' },
      { $inc: { revision: 1 } },
      { session, new: true },
    );
  });

  it('includes previous saved contributions even when their events and ballots no longer exist', async () => {
    const prior = {
      id: userId.toHexString(),
      name: 'Nombre antiguo',
      avatar: null,
      points: 5,
      fivePointVotes: 1,
      threePointVotes: 0,
      percentage: 100,
      position: 1,
    };
    snapshots.find.mockReturnValue(
      query([
        {
          event: { year: 2026 },
          eventRanking: { entries: [prior] },
          generalRanking: {
            totalPoints: 9999,
            entries: [{ ...prior, points: 9999 }],
          },
        },
      ]),
    );
    await service.capture(id.toHexString(), session);
    const saved = snapshots.create.mock.calls[0][0][0];
    expect(saved.generalRanking?.entries[0]).toMatchObject({
      points: 14,
      fivePointVotes: 2,
      threePointVotes: 1,
    });
    expect(saved.editions?.['2026'][0].points).toBe(14);
    expect(events.findOne).toHaveBeenCalledTimes(1);
    // Only the new event's ballots are read; historical totals come from its
    // event snapshot, never from the previous general ranking or live ballots.
    expect(votes.aggregate).toHaveBeenCalledTimes(1);
  });

  it('does not save or count an event twice', async () => {
    snapshots.exists.mockReturnValue(query({ _id: id }));
    await service.capture(id.toHexString(), session);
    expect(snapshots.create).not.toHaveBeenCalled();
    expect(votes.aggregate).not.toHaveBeenCalled();
  });

  it('backfills only missing closed events', async () => {
    const missing = new Types.ObjectId();
    events.find.mockReturnValue(query([{ _id: id }, { _id: missing }]));
    snapshots.distinct.mockReturnValue(query([id.toHexString()]));
    const capture = jest.spyOn(service, 'capture').mockResolvedValue();
    await service.reconcile();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(missing.toHexString());
  });

  it('orders snapshots by serialized revision, excluding the lock document', async () => {
    const chain = query({ revision: 7 });
    snapshots.findOne.mockReturnValue(chain);
    expect(await service.latest()).toEqual({ revision: 7 });
    expect(snapshots.findOne).toHaveBeenCalledWith({
      key: { $ne: '__lock__' },
    });
    expect(chain.sort).toHaveBeenCalledWith({ revision: -1 });
  });

  it('loads a specific event snapshot without accessing events, users or ballots', async () => {
    const saved = { key: id.toHexString(), eventRanking: { entries: [] } };
    snapshots.findOne.mockReturnValue(query(saved));
    expect(await service.forEvent(id.toHexString())).toEqual(saved);
    expect(snapshots.findOne).toHaveBeenCalledWith({ key: id.toHexString() });
    expect(events.findOne).not.toHaveBeenCalled();
    expect(users.find).not.toHaveBeenCalled();
    expect(votes.aggregate).not.toHaveBeenCalled();
  });

  it('preserves sporting ties when adding saved scores', () => {
    const entries = ['a', 'b'].map((id) => ({
      id,
      name: id,
      avatar: null,
      points: 9,
      fivePointVotes: 1,
      threePointVotes: 1,
      position: 0,
      percentage: 0,
    })) as SnapshotEntry[];
    expect(
      service.combine(entries).entries.map((entry) => entry.position),
    ).toEqual([1, 1]);
    expect(service.combine(entries).leaderIds).toEqual(['a', 'b']);
  });
});
