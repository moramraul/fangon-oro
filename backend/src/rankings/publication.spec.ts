import { Edition } from '../editions/edition.schema';
import { publication } from './publication';

describe('ranking publication', () => {
  const start = Date.parse('2026-11-10T12:00:00Z');
  const edition = {
    status: 'closed',
    closedAt: new Date(start),
    finalRanking: {
      entries: [
        { position: 1 },
        { position: 2 },
        { position: 2 },
        { position: 4 },
        ...Array.from({ length: 9 }, (_, index) => ({ position: index + 5 })),
      ],
    },
  } as Edition;

  it('keeps open editions and global totals hidden', () => {
    expect(publication(null, start).state).toBe('hidden');
    expect(
      publication({ ...edition, status: 'open' }, start).positions,
    ).toEqual([]);
  });

  it('reveals five positions immediately and five more at thirty minutes', () => {
    expect(publication(edition, start)).toMatchObject({
      state: 'revealing',
      positions: [13, 12, 11, 10, 9],
      nextRevealAt: '2026-11-10T12:30:00.000Z',
    });
    expect(publication(edition, start + 30 * 60000 - 1).positions).toEqual([13, 12, 11, 10, 9]);
    expect(publication(edition, start + 30 * 60000).positions).toEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
  });

  it('publishes a short ranking immediately without splitting ties', () => {
    const short = {
      ...edition,
      finalRanking: { ...edition.finalRanking!, entries: edition.finalRanking!.entries.slice(0, 4) },
    };
    expect(publication(short, start)).toEqual({
      state: 'published', positions: [4, 2, 1], nextRevealAt: null,
    });
  });

  it('publishes the winners last and stays published after a restart', () => {
    expect(publication(edition, start + 60 * 60000)).toEqual({
      state: 'published',
      positions: [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 2, 1],
      nextRevealAt: null,
    });
    expect(publication(edition, start + 86400000).state).toBe('published');
  });
});
