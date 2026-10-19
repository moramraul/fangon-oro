import { editionAwards } from './awards';
import { Ranking } from '../rankings/models/ranking.model';

describe('editionAwards', () => {
  const ranking = (points: number[]) =>
    Ranking.from(
      points.map((value, index) => ({
        id: String(index),
        name: '',
        points: value,
        fivePointVotes: 0,
        threePointVotes: 0,
      })),
      points.reduce((sum, value) => sum + value, 0),
    );

  it('assigns the podium and the last position from the final edition ranking', () => {
    const awards = editionAwards(ranking([20, 12, 8, 0]));
    expect(awards.gold.map((entry) => entry.id)).toEqual(['0']);
    expect(awards.silver.map((entry) => entry.id)).toEqual(['1']);
    expect(awards.bronze.map((entry) => entry.id)).toEqual(['2']);
    expect(awards.goldenUnderpants.map((entry) => entry.id)).toEqual(['3']);
  });

  it('shares tied awards and leaves skipped positions empty', () => {
    const awards = editionAwards(ranking([20, 20, 0, 0]));
    expect(awards.gold).toHaveLength(2);
    expect(awards.silver).toHaveLength(0);
    expect(awards.bronze).toHaveLength(2);
    expect(awards.goldenUnderpants).toHaveLength(1);
    expect(['2', '3']).toContain(awards.goldenUnderpants[0].id);
  });

  it('breaks a last-place points tie by fewer received votes, before participation', () => {
    const result = ranking([5, 5]);
    result.entries[0].eventsParticipated = 10;
    result.entries[1].fivePointVotes = 1;
    expect(editionAwards(result).goldenUnderpants[0].id).toBe('1');
  });

  it('breaks equal points and received votes by more events attended', () => {
    const result = ranking([5, 5]);
    result.entries[1].eventsParticipated = 3;
    expect(editionAwards(result).goldenUnderpants[0].id).toBe('1');
  });

  it('randomly selects one of the remaining tied candidates only', () => {
    const result = ranking([0, 0, 10]);
    expect(editionAwards(result, () => 0).goldenUnderpants[0].id).toBe('0');
    expect(editionAwards(result, () => 0.99).goldenUnderpants[0].id).toBe('1');
  });

  it('leaves every award empty for an edition without participants', () => {
    expect(
      Object.values(editionAwards(ranking([]))).every(
        (entries) => !entries.length,
      ),
    ).toBe(true);
  });
});
