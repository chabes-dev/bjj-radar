// "Since your last visit" digest.
const DAY = 86400000;
export const FIRST_VISIT_DAYS = 30;
export const MAX_LOOKBACK_DAYS = 365;
export const UPCOMING_DAYS = 30;

export function digest(data, lastVisit, now = new Date()) {
  const t = now.getTime();
  let since = Date.parse(lastVisit ?? '');
  if (Number.isNaN(since)) since = t - FIRST_VISIT_DAYS * DAY;
  since = Math.max(since, t - MAX_LOOKBACK_DAYS * DAY);

  const happened = data.events
    .filter((e) => { const end = Date.parse(e.end) + DAY; return end > since && end <= t; })
    .sort((a, b) => b.end.localeCompare(a.end));
  const newVideos = data.videos
    .filter((v) => { const p = Date.parse(v.publishedAt); return p > since && p <= t; })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const upcoming = data.events
    .filter((e) => { const s = Date.parse(e.start); return s > t && s <= t + UPCOMING_DAYS * DAY; })
    .sort((a, b) => a.start.localeCompare(b.start));

  return { since: new Date(since).toISOString(), happened, newVideos, upcoming, newCount: happened.length + newVideos.length };
}
