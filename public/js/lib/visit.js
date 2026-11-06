// "Since your last visit" with a session window, so reloads don't eat the catch-up.
export const SESSION_HOURS = 6;

// saved: { lastVisit?, sessionSince?, sessionStart? } → { since: ISO|null, saved: next saved object }
export function rotateVisit(saved, now = new Date()) {
  const t = now.getTime();
  const start = Date.parse(saved?.sessionStart ?? '');
  if (!Number.isNaN(start) && t - start < SESSION_HOURS * 3600000) {
    return { since: saved.sessionSince ?? null, saved: { ...saved, lastVisit: now.toISOString() } };
  }
  const since = saved?.lastVisit ?? null;
  return { since, saved: { lastVisit: now.toISOString(), sessionSince: since, sessionStart: now.toISOString() } };
}
