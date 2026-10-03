export interface Score {
  points: number;
  fivePointVotes?: number;
  threePointVotes?: number;
}

// Zero means a sporting tie; IDs only stabilize display order.
export function compareScores(a: Score, b: Score): number {
  return (
    b.points - a.points ||
    (b.fivePointVotes ?? 0) - (a.fivePointVotes ?? 0) ||
    (b.threePointVotes ?? 0) - (a.threePointVotes ?? 0)
  );
}
