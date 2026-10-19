import { SnapshotRanking } from '../rankings/snapshots/ranking-snapshot.schema';

// Podium ties share an award; Calzón de Oro always has a single winner.
export function editionAwards(ranking: SnapshotRanking, random = Math.random) {
  const entries = ranking.entries;
  // Points = 5a + 3b + c; received votes = a + b + c.
  const receivedVotes = (entry: (typeof entries)[number]) =>
    entry.points - 4 * entry.fivePointVotes - 2 * entry.threePointVotes;
  const compareLast = (
    a: (typeof entries)[number],
    b: (typeof entries)[number],
  ) =>
    a.points - b.points ||
    receivedVotes(a) - receivedVotes(b) ||
    (b.eventsParticipated ?? 0) - (a.eventsParticipated ?? 0);
  const sorted = [...entries].sort(compareLast);
  const tied = sorted.filter((entry) => compareLast(entry, sorted[0]) === 0);
  const last = tied.length
    ? tied[Math.floor(random() * tied.length)]
    : undefined;
  return {
    gold: entries.filter((entry) => entry.position === 1),
    silver: entries.filter((entry) => entry.position === 2),
    bronze: entries.filter((entry) => entry.position === 3),
    goldenUnderpants: last ? [last] : [],
  };
}
