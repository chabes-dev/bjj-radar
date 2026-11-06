// Matches a YouTube video to an event and athletes.
import { normalizeName, nameMatches } from './normalize.js';

const DAY = 86400000;
export const WINDOW_DAYS = 120; // videos may appear up to ~4 months after an event

const FULL = /\b(full\s+match|full\s+fight|complete\s+match|luta\s+completa|lucha\s+completa)\b/i;
const NOT_FULL = /(#shorts|\bhighlights?\b|\bteaser\b|\btrailer\b|\bpreview\b|\brecap\b|\bsupercut\b|\breaction\b)/i;

export function isFullMatch(title) {
  return FULL.test(title) && !NOT_FULL.test(title);
}

function inWindow(event, date) {
  const start = Date.parse(event.start);
  const end = Date.parse(event.end) + WINDOW_DAYS * DAY;
  return date >= start && date <= end;
}

function aliasHit(titleNorm, event) {
  return [event.name, ...(event.aliases ?? [])].some((a) => {
    const n = normalizeName(a).replace(/\b20\d\d\b/g, '').trim();
    return n && (' ' + titleNorm + ' ').includes(' ' + n + ' ');
  });
}

function eventFromName(title, events, date) {
  const t = normalizeName(title);
  const year = (title.match(/\b(20\d\d)\b/) || [])[1];
  const hits = events.filter((e) => aliasHit(t, e));
  if (!hits.length) return { hit: false, id: null };
  // A year in the title is the strongest signal: it overrides the date window.
  const pool = year
    ? hits.filter((e) => e.start.startsWith(year))
    : hits.filter((e) => inWindow(e, date));
  return { hit: true, id: pool.length === 1 ? pool[0].id : null };
}

export function matchVideo(video, ctx) {
  const none = { status: 'none', eventId: null, athleteIds: [] };
  if (!ctx.channels.some((c) => c.id === video.channelId)) return none;
  if (!isFullMatch(video.title)) return none;

  const date = Date.parse(video.publishedAt);
  const full = [];
  let surnameHit = false;
  for (const a of ctx.athletes) {
    const m = nameMatches(video.title, a);
    if (m === 'full') full.push(a.id);
    else if (m === 'surname') surnameHit = true;
  }

  const byName = eventFromName(video.title, ctx.events, date);
  if (byName.id) return { status: 'confirmed', eventId: byName.id, athleteIds: full };

  const windowEvents = ctx.events.filter((e) => inWindow(e, date));
  const onlyEvent = windowEvents.length === 1 ? windowEvents[0].id : null;
  if (full.length >= 2 && onlyEvent) return { status: 'confirmed', eventId: onlyEvent, athleteIds: full };

  if (full.length || surnameHit || byName.hit) {
    return { status: 'maybe', eventId: onlyEvent, athleteIds: full };
  }
  return none;
}
