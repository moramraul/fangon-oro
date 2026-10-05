import { editionYear, standingsYear } from './edition';

describe('annual editions in Madrid', () => {
  it('changes edition at midnight in Madrid, before UTC midnight', () => {
    expect(editionYear(new Date('2026-12-31T22:59:59Z'))).toBe(2026);
    expect(editionYear(new Date('2026-12-31T23:00:00Z'))).toBe(2027);
  });

  it('retains the previous standings while the new first event is in the future', () => {
    expect(
      standingsYear(
        [new Date('2026-06-01T10:00:00Z'), new Date('2027-02-01T10:00:00Z')],
        new Date('2027-01-01T00:00:00Z'),
      ),
    ).toBe(2026);
  });

  it('switches when the first event starts, without waiting for the first vote', () => {
    const first = new Date('2027-02-01T10:00:00Z');
    expect(standingsYear([new Date('2026-06-01'), first], first)).toBe(2027);
  });

  it('keeps the last played edition across a year without events', () => {
    expect(
      standingsYear([new Date('2025-06-01')], new Date('2027-01-01')),
    ).toBe(2025);
  });

  it('uses the current edition if no event has ever started', () => {
    expect(
      standingsYear([new Date('2028-06-01')], new Date('2027-01-01')),
    ).toBe(2027);
  });
});
