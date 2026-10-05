const yearFormat = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  timeZone: 'Europe/Madrid',
});

export function editionYear(date: Date): number {
  return Number(yearFormat.format(date));
}

export function standingsYear(dates: Date[], now: Date): number {
  const current = editionYear(now);
  const started = dates.filter((date) => date <= now).map(editionYear);
  return started.length ? Math.max(...started) : current;
}
