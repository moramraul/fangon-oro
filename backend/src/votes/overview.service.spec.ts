import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { EventsService } from '../events/events.service';
import { Event } from '../events/schemas/event.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Vote } from './schemas/vote.schema';
import { OverviewService } from './overview.service';

describe('OverviewService', () => {
  const a = new Types.ObjectId();
  const b = new Types.ObjectId();
  const previous = {
    _id: new Types.ObjectId(),
    name: 'Anterior',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-06-02'),
    status: 'closed',
    participants: [a, b],
  };
  const upcoming = {
    _id: new Types.ObjectId(),
    name: 'Nueva edición',
    startDate: new Date('2027-02-01'),
    endDate: new Date('2027-02-02'),
    status: 'open',
    participants: [a],
  };
  const events = { find: jest.fn(), findById: jest.fn() };
  const votes = { aggregate: jest.fn(), distinct: jest.fn() };
  const users = { find: jest.fn() };
  const lifecycle = { closeExpired: jest.fn() };
  const snapshots = { latest: jest.fn() };
  const savedEntry = {
    id: a.toHexString(),
    name: 'Ana',
    avatar: null,
    points: 5,
    fivePointVotes: 1,
    threePointVotes: 0,
    percentage: 100,
    position: 1,
  };
  const snapshot = {
    calculatedAt: new Date('2026-06-02'),
    editions: { 2026: [savedEntry] },
  };
  let service: OverviewService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T00:00:00Z'));
    jest.resetAllMocks();
    snapshots.latest.mockResolvedValue(snapshot);
    votes.distinct.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    events.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([upcoming, previous]),
      }),
    });
    votes.aggregate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue([
          { _id: a, points: 5, fivePointVotes: 1, threePointVotes: 0 },
        ]),
    });
    users.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: a, name: 'Ana' },
          { _id: b, name: 'Bea' },
        ]),
      }),
    });
    service = new OverviewService(
      events as unknown as Model<Event>,
      votes as unknown as Model<Vote>,
      users as unknown as Model<User>,
      lifecycle as unknown as EventsService,
      snapshots as unknown as RankingSnapshotsService,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('reads saved standings and date without aggregating votes', async () => {
    const result = await service.overview({ _id: a } as UserDocument);
    expect(result.year).toBe(2027);
    expect(result.rankingYear).toBe(2026);
    expect(result.calculatedAt).toBe(snapshot.calculatedAt.toISOString());
    expect(result.standings).toEqual([{ ...savedEntry, rank: 1 }]);
    expect(result.events.map((event) => event.id)).toEqual([
      upcoming._id.toHexString(),
    ]);
    expect(votes.aggregate).not.toHaveBeenCalled();
    expect(users.find).not.toHaveBeenCalled();
  });

  it('keeps the latest classification until another event closes, including after deleting original events', async () => {
    jest.setSystemTime(upcoming.startDate);
    events.find.mockReturnValue({
      sort: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    });
    const result = await service.overview({ _id: a } as UserDocument);
    expect(result.rankingYear).toBe(2026);
    expect(result.standings[0].points).toBe(5);
    expect(votes.aggregate).not.toHaveBeenCalled();
  });

  it('returns no standings before the first snapshot', async () => {
    snapshots.latest.mockResolvedValue(null);
    const result = await service.overview({ _id: a } as UserDocument);
    expect(result.standings).toEqual([]);
    expect(result.calculatedAt).toBeNull();
  });

  it('marks voted events for the current user in the overview', async () => {
    votes.distinct.mockReturnValue({
      exec: jest.fn().mockResolvedValue([upcoming._id]),
    });
    const result = await service.overview({ _id: a } as UserDocument);
    expect(result.events[0].hasVoted).toBe(true);
    expect(votes.distinct).toHaveBeenCalledWith('eventId', { voterId: a });
  });

  it('rejects results from old editions and malformed event IDs', async () => {
    events.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(previous),
    });
    await expect(
      service.results(previous._id.toHexString()),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.results('invalid')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
