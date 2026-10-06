import { Types } from 'mongoose';
import { EditionsService } from '../editions/editions.service';
import { Ranking } from './models/ranking.model';
import { RankingSnapshotsService } from './snapshots/ranking-snapshots.service';
import { StatsService } from './stats.service';
describe('StatsService with explicit editions', () => {
  const currentId = new Types.ObjectId();
  const previousId = new Types.ObjectId();
  const person = (
    id: string,
    points: number,
    fivePointVotes = 0,
    threePointVotes = 0,
  ) => ({
    id,
    name: id,
    avatar: id + '.jpg',
    points,
    fivePointVotes,
    threePointVotes,
    percentage: 0,
    position: 1,
  });
  const snapshots = { latest: jest.fn() };
  const editions = { current: jest.fn(), find: jest.fn(), list: jest.fn() };
  let service: StatsService;
  beforeEach(() => {
    jest.resetAllMocks();
    editions.current.mockResolvedValue({
      _id: currentId,
      name: 'Current',
      status: 'open',
    });
    editions.list.mockResolvedValue([
      { id: currentId.toHexString(), name: 'Current' },
      { id: previousId.toHexString(), name: 'Previous' },
    ]);
    service = new StatsService(
      snapshots as unknown as RankingSnapshotsService,
      editions as unknown as EditionsService,
    );
  });
  it('has no awards for a newly opened edition despite previous snapshots', async () => {
    snapshots.latest.mockResolvedValue({
      editions: { [previousId.toHexString()]: [person('old', 9, 1, 1)] },
    });
    expect((await service.get()).awards).toEqual([]);
    expect((await service.get()).editionId).toBe(currentId.toHexString());
  });
  it('calculates each type from fixed scores and keeps original photos', async () => {
    snapshots.latest.mockResolvedValue({
      editions: {
        [currentId.toHexString()]: [
          person('a', 13, 2, 1),
          person('b', 13, 0, 4),
          person('c', 4),
        ],
      },
    });
    const stats = await service.get();
    expect(
      stats.awards.map((award) => ({
        votes: award.votes,
        ids: award.people.map((entry) => entry.id),
      })),
    ).toEqual([
      { votes: 2, ids: ['a'] },
      { votes: 4, ids: ['b'] },
      { votes: 4, ids: ['c'] },
      { votes: 3, ids: ['a'] },
    ]);
    expect(stats.awards[0].people[0].avatar).toBe('a.jpg');
  });
  it('uses the immutable final ranking for a closed edition even without event snapshots', async () => {
    editions.find.mockResolvedValue({
      _id: previousId,
      name: 'Previous',
      status: 'closed',
      finalRanking: Ranking.from([person('original', 5, 1)], 5),
    });
    snapshots.latest.mockResolvedValue(null);
    expect(
      (await service.get(previousId.toHexString())).awards[0].people[0].id,
    ).toBe('original');
  });
  it('uses the historical snapshot for global stats', async () => {
    snapshots.latest.mockResolvedValue({
      generalRanking: Ranking.from([person('historical', 10, 2)], 10),
    });
    const stats = await service.get('global');
    expect(stats.scope).toBe('global');
    expect(stats.awards[0].votes).toBe(2);
    expect(editions.current).not.toHaveBeenCalled();
  });
  it('shares ties including zero-vote anti titles and leaves zero maxima unassigned', async () => {
    snapshots.latest.mockResolvedValue({
      editions: {
        [currentId.toHexString()]: [
          person('a', 5, 1),
          person('b', 5, 1),
          person('c', 0),
          person('d', 0),
        ],
      },
    });
    const stats = await service.get();
    expect(stats.awards[0].people.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(stats.awards[1].people).toEqual([]);
    expect(stats.awards[3].people.map((entry) => entry.id)).toEqual(['c', 'd']);
  });
  it('counts received votes rather than points for the anti title, including legacy ones', async () => {
    snapshots.latest.mockResolvedValue({
      editions: {
        [currentId.toHexString()]: [person('a', 5, 1), person('b', 3)],
      },
    });
    const stats = await service.get();
    expect(stats.awards[2].votes).toBe(3);
    expect(stats.awards[3].people[0].id).toBe('a');
  });
  it.each(['invalid', '2026', '', '2026.5'])(
    'rejects invalid edition ID %s',
    async (id) => {
      await expect(service.get(id)).rejects.toMatchObject({ status: 400 });
    },
  );
});
