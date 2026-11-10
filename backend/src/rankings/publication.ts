import type { Edition } from '../editions/edition.schema';

const INTERVAL = 30 * 60 * 1000;
const POSITIONS_PER_BATCH = 5;

// Use the frozen final positions, never a ranking recomputed from partial data.
export function publication(edition: Edition | null, now = Date.now()) {
  const positions = [
    ...new Set(
      edition?.finalRanking?.entries.map((entry) => entry.position) ?? [],
    ),
  ].sort((a, b) => b - a);
  const start = edition?.closedAt?.getTime();
  const started = edition?.status === 'closed' && start !== undefined;
  const batches = started
    ? Math.max(0, Math.floor((now - start) / INTERVAL) + 1)
    : 0;
  const count = batches * POSITIONS_PER_BATCH;
  const complete = !!started && count >= positions.length;
  return {
    state: !started ? 'hidden' : complete ? 'published' : 'revealing',
    positions: positions.slice(0, count),
    nextRevealAt:
      started && !complete
        ? new Date(start + batches * INTERVAL).toISOString()
        : null,
  };
}
