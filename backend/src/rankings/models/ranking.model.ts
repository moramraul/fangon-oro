import { EventSummaryStatus } from '../../events/schemas/event.schema';
import { compareScores, Score } from '../../votes/score';

export interface RankingEntry {
  id: string;
  name: string;
  avatar?: string | null;
  points: number;
  fivePointVotes: number;
  threePointVotes: number;
  percentage: number;
  position: number;
  eventsParticipated?: number;
}

// A read model derived from votes, so totals cannot drift from the source data.
export class Ranking {
  scope!: 'event' | 'general';
  eventId?: string;
  status?: EventSummaryStatus;
  totalPoints!: number;
  entries!: RankingEntry[];
  leaderIds!: string[];

  static from(
    candidates: (Score & {
      id: string;
      name: string;
      eventsParticipated?: number;
    })[],
    totalPoints: number,
    event?: { id: string; status: EventSummaryStatus },
  ): Ranking {
    const compare = (
      a: (typeof candidates)[number],
      b: (typeof candidates)[number],
    ) =>
      a.points === b.points && !event
        ? (b.eventsParticipated ?? 0) - (a.eventsParticipated ?? 0) ||
          compareScores(a, b)
        : compareScores(a, b);
    const sorted = [...candidates].sort(
      (a, b) => compare(a, b) || a.id.localeCompare(b.id),
    );
    let position = 0;
    const entries = sorted.map((candidate, index) => {
      if (index === 0 || compare(candidate, sorted[index - 1]) !== 0) {
        position = index + 1;
      }
      return {
        ...candidate,
        fivePointVotes: candidate.fivePointVotes ?? 0,
        threePointVotes: candidate.threePointVotes ?? 0,
        position,
        percentage: totalPoints
          ? Math.round((candidate.points / totalPoints) * 10000) / 100
          : 0,
      };
    });
    return Object.assign(new Ranking(), {
      scope: event ? 'event' : 'general',
      ...(event ? { eventId: event.id, status: event.status } : {}),
      totalPoints,
      entries,
      leaderIds: entries[0]?.points
        ? entries
            .filter((entry) => compare(entry, entries[0]) === 0)
            .map((entry) => entry.id)
        : [],
    });
  }
}
