import { pointsPipeline } from '../votes/points.pipeline';
import { EventsService } from '../events/events.service';
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Event, EventStatus } from '../events/schemas/event.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Vote } from '../votes/schemas/vote.schema';
import { VotesService } from '../votes/votes.service';
import { Ranking } from './models/ranking.model';
import { RankingsService } from './rankings.service';

describe('RankingsService', () => {
  const a = new Types.ObjectId();
  const b = new Types.ObjectId();
  const c = new Types.ObjectId();
  const votes = { aggregate: jest.fn() };
  const events = { distinct: jest.fn() };
  const users = { find: jest.fn() };
  const results = { results: jest.fn() };
  const lifecycle = { closeExpired: jest.fn() };
  const closedEventId = new Types.ObjectId();
  let service: RankingsService;

  beforeEach(() => {
    jest.resetAllMocks();
    lifecycle.closeExpired.mockResolvedValue(undefined);
    events.distinct.mockImplementation((field: string) => ({
      exec: jest.fn().mockResolvedValue(field === '_id' ? [closedEventId] : []),
    }));
    service = new RankingsService(
      votes as unknown as Model<Vote>,
      events as unknown as Model<Event>,
      users as unknown as Model<User>,
      results as unknown as VotesService,
      lifecycle as unknown as EventsService,
    );
  });

  it('sums closed events and includes participants with zero votes only once', async () => {
    votes.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: a, points: 3 },
        { _id: b, points: 2 },
      ]),
    });
    events.distinct.mockImplementation((field: string) => ({
      exec: jest
        .fn()
        .mockResolvedValue(field === '_id' ? [closedEventId] : [a, b, c, a]),
    }));
    users.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: a, name: 'Ana' },
          { _id: b, name: 'Bea' },
          { _id: c, name: 'Carlos' },
        ]),
      }),
    });
    const ranking = await service.general();
    expect(ranking.scope).toBe('general');
    expect(ranking.totalPoints).toBe(5);
    expect(
      ranking.entries.map(({ points, position, percentage }) => ({
        points,
        position,
        percentage,
      })),
    ).toEqual([
      { points: 3, position: 1, percentage: 60 },
      { points: 2, position: 2, percentage: 40 },
      { points: 0, position: 3, percentage: 0 },
    ]);
    expect(lifecycle.closeExpired).toHaveBeenCalled();
    expect(events.distinct).toHaveBeenCalledWith('_id', {
      status: EventStatus.CLOSED,
    });
    expect(votes.aggregate).toHaveBeenCalledWith([
      { $match: { eventId: { $in: [closedEventId] } } },
      ...pointsPipeline(),
    ]);
  });

  it('does not count votes while no events are closed', async () => {
    events.distinct.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    votes.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    users.find.mockReturnValue({
      select: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    });
    expect((await service.general()).totalPoints).toBe(0);
    expect(votes.aggregate).toHaveBeenCalledWith([
      { $match: { eventId: { $in: [] } } },
      ...pointsPipeline(),
    ]);
  });

  it('refreshes closed events after expiration processing on every query', async () => {
    const closedIds: Types.ObjectId[] = [];
    lifecycle.closeExpired.mockImplementation(() => {
      closedIds.push(new Types.ObjectId());
      return Promise.resolve();
    });
    events.distinct.mockImplementation((field: string) => ({
      exec: jest.fn().mockResolvedValue(field === '_id' ? [...closedIds] : []),
    }));
    votes.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    users.find.mockReturnValue({
      select: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    });
    await service.general();
    await service.general();
    expect(votes.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { eventId: { $in: [closedIds[0]] } },
    });
    expect(votes.aggregate.mock.calls[1][0][0]).toEqual({
      $match: { eventId: { $in: closedIds } },
    });
  });

  it('provides an event ranking from authorized results', async () => {
    const user = { _id: a } as UserDocument;
    results.results.mockResolvedValue({
      eventId: 'event',
      status: EventStatus.CLOSED,
      totalPoints: 1,
      candidates: [{ id: a.toHexString(), name: 'Ana', points: 1 }],
    });
    const ranking = await service.forEvent('event', user);
    expect(results.results).toHaveBeenCalledWith('event', user);
    expect(ranking).toMatchObject({
      scope: 'event',
      eventId: 'event',
      status: EventStatus.CLOSED,
    });
  });

  it('preserves event access restrictions', async () => {
    results.results.mockRejectedValue(new NotFoundException());
    await expect(
      service.forEvent('event', {} as UserDocument),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('shares positions on ties and skips the following occupied position', () => {
    const ranking = Ranking.from(
      [
        { id: 'c', name: 'C', points: 1 },
        { id: 'b', name: 'B', points: 2 },
        { id: 'a', name: 'A', points: 2 },
      ],
      5,
    );
    expect(ranking.entries.map((entry) => entry.position)).toEqual([1, 1, 3]);
    expect(ranking.leaderIds).toEqual(['a', 'b']);
  });

  it('has no leaders without votes, including empty rankings', () => {
    expect(Ranking.from([], 0).entries).toEqual([]);
    const ranking = Ranking.from([{ id: 'a', name: 'A', points: 0 }], 0);
    expect(ranking.leaderIds).toEqual([]);
    expect(ranking.entries[0].percentage).toBe(0);
  });
  it('breaks equal points by fives first, then threes, and preserves full ties', () => {
    const ranking = Ranking.from(
      [
        {
          id: 'a',
          name: 'A',
          points: 15,
          fivePointVotes: 1,
          threePointVotes: 3,
        },
        {
          id: 'b',
          name: 'B',
          points: 15,
          fivePointVotes: 2,
          threePointVotes: 0,
        },
        {
          id: 'c',
          name: 'C',
          points: 15,
          fivePointVotes: 2,
          threePointVotes: 1,
        },
        {
          id: 'd',
          name: 'D',
          points: 15,
          fivePointVotes: 2,
          threePointVotes: 1,
        },
        {
          id: 'e',
          name: 'E',
          points: 16,
          fivePointVotes: 0,
          threePointVotes: 0,
        },
      ],
      76,
    );
    expect(
      ranking.entries.map(({ id, position }) => ({ id, position })),
    ).toEqual([
      { id: 'e', position: 1 },
      { id: 'c', position: 2 },
      { id: 'd', position: 2 },
      { id: 'b', position: 4 },
      { id: 'a', position: 5 },
    ]);
    expect(ranking.leaderIds).toEqual(['e']);
    const tied = Ranking.from(
      ranking.entries.filter((entry) => entry.id !== 'e'),
      60,
    );
    expect(tied.leaderIds).toEqual(['c', 'd']);
  });
  it('applies the tie-break counts aggregated across all events', async () => {
    votes.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: a, points: 9, fivePointVotes: 0, threePointVotes: 3 },
        { _id: b, points: 9, fivePointVotes: 1, threePointVotes: 1 },
      ]),
    });
    events.distinct.mockReturnValue({
      exec: jest.fn().mockResolvedValue([a, b]),
    });
    users.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: a, name: 'A' },
          { _id: b, name: 'B' },
        ]),
      }),
    });
    const ranking = await service.general();
    expect(ranking.leaderIds).toEqual([b.toHexString()]);
    expect(ranking.entries.map((entry) => entry.position)).toEqual([1, 2]);
    expect(ranking.entries[0].fivePointVotes).toBe(1);
  });
});
