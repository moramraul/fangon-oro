import { EventsService } from '../events/events.service';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { EventStatus } from '../events/schemas/event.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { Ranking } from './models/ranking.model';
import { RankingsService } from './rankings.service';
import { RankingSnapshotsService } from './snapshots/ranking-snapshots.service';

describe('RankingsService', () => {
  const a = new Types.ObjectId();
  const snapshots = { latest: jest.fn(), forEvent: jest.fn() };
  const events = { getDetail: jest.fn() };
  let service: RankingsService;
  beforeEach(() => {
    jest.resetAllMocks();
    events.getDetail.mockResolvedValue({
      id: 'event',
      status: EventStatus.OPEN,
    });
    service = new RankingsService(
      snapshots as unknown as RankingSnapshotsService,
      events as unknown as EventsService,
    );
  });
  it('reads the latest saved ranking with its date without recalculating votes', async () => {
    const generalRanking = Ranking.from(
      [{ id: 'a', name: 'Ana', points: 9 }],
      9,
    );
    const calculatedAt = new Date('2026-10-06T10:00:00Z');
    snapshots.latest.mockResolvedValue({ generalRanking, calculatedAt });
    expect(await service.general()).toEqual({
      ...generalRanking,
      calculatedAt: calculatedAt.toISOString(),
    });
  });
  it('returns an empty ranking before the first closure', async () => {
    snapshots.latest.mockResolvedValue(null);
    expect(await service.general()).toEqual(Ranking.from([], 0));
  });
  it('rejects open event rankings without reading snapshots', async () => {
    await expect(
      service.forEvent('event', { _id: a } as UserDocument),
    ).rejects.toMatchObject({ status: 409 });
    expect(snapshots.forEvent).not.toHaveBeenCalled();
  });

  it('preserves event access restrictions', async () => {
    events.getDetail.mockRejectedValue(new NotFoundException());
    await expect(
      service.forEvent('event', {} as UserDocument),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the immutable event snapshot after a participant is deleted', async () => {
    events.getDetail.mockResolvedValue({
      id: 'event',
      status: EventStatus.CLOSED,
      participants: [],
    });
    const eventRanking = Ranking.from(
      [{ id: a.toHexString(), name: 'Ana original', points: 9 }],
      9,
      { id: 'event', status: EventStatus.CLOSED },
    );
    snapshots.forEvent.mockResolvedValue({ eventRanking });
    const user = { _id: a } as UserDocument;
    expect(await service.forEvent('event', user)).toEqual(eventRanking);
    expect(events.getDetail).toHaveBeenCalledWith('event', user);
  });

  it('does not expose a snapshot to unauthorized users', async () => {
    events.getDetail.mockRejectedValue(new NotFoundException());
    await expect(
      service.forEvent('event', {} as UserDocument),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(snapshots.forEvent).not.toHaveBeenCalled();
  });

  it('does not recalculate a closed event while its snapshot is missing', async () => {
    events.getDetail.mockResolvedValue({
      id: 'event',
      status: EventStatus.CLOSED,
    });
    snapshots.forEvent.mockResolvedValue(null);
    await expect(
      service.forEvent('event', {} as UserDocument),
    ).rejects.toMatchObject({ status: 503 });
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
});
