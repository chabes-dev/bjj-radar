// Matches a YouTube video to an event and athletes.
import { normalizeName, nameMatches } from './normalize.js';

const DAY = 86400000;
export const WINDOW_DAYS = 120; // videos may appear up to ~4 months after an event

const FULL = /\b(full\s+match|full\s+final|full\s+fight|complete\s+match|luta\s+completa|lucha\s+completa)\b/i;
const NOT_FULL = /(#shorts|\bhighlights?\b|\bteaser\b|\btrailer\b|\bpreview\b|\brecap\b|\bsupercut\b|\breaction\b)/i;

export function isFullMatch(title) {
  return FULL.test(title) && !NOT_FULL.test(title);
}

function inWindow(event, date) {
  const start = Date.parse(event.start);
  const end = Date.parse(event.end) + WINDOW_DAYS * DAY;
  return date >= start && date <= end;
}

// Longest alias of `event` found in the title (year stripped), or null.
function aliasHit(titleNorm, event) {
  let best = null;
  for (const a of [event.name, ...(event.aliases ?? [])]) {
    const n = normalizeName(a).replace(/\b20\d\d\b/g, '').replace(/\s+/g, ' ').trim();
    if (n && (' ' + titleNorm + ' ').includes(' ' + n + ' ') && (!best || n.length > best.length)) best = n;
  }
  return best;
}

function eventFromName(title, events, date) {
  const t = normalizeName(title);
  const year = (title.match(/\b(20\d\d)\b/) || [])[1];
  let hits = events.map((e) => ({ e, alias: aliasHit(t, e) })).filter((h) => h.alias);
  if (!hits.length) return { hit: false, id: null };
  // "worlds" is inside "no gi worlds": a hit contained in a longer hit loses.
  hits = hits.filter((h) => !hits.some((o) => o.alias.length > h.alias.length && (' ' + o.alias + ' ').includes(' ' + h.alias + ' ')));
  // A year in the title is the strongest signal: it overrides the date window.
  const pool = year
    ? hits.filter((h) => h.e.start.startsWith(year))
    : hits.filter((h) => inWindow(h.e, date));
  return { hit: true, id: pool.length === 1 ? pool[0].e.id : null };
}

const latestEnded = (list) => list.slice().sort((a, b) => b.end.localeCompare(a.end))[0]?.id ?? null;

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
  if (full.length >= 2 && windowEvents.length) {
    if (windowEvents.length === 1) return { status: 'confirmed', eventId: windowEvents[0].id, athleteIds: full };
    // Several events overlap: confirm only if a recorded match pairs these athletes at one of them.
    const ids = new Set(windowEvents.map((e) => e.id));
    const recorded = [...new Set((ctx.matches ?? [])
      .filter((m) => ids.has(m.eventId) && full.includes(m.a?.id) && full.includes(m.b?.id))
      .map((m) => m.eventId))];
    if (recorded.length === 1) return { status: 'confirmed', eventId: recorded[0], athleteIds: full };
  }

  if (full.length || surnameHit || byName.hit) {
    return { status: 'maybe', eventId: latestEnded(windowEvents.filter((e) => Date.parse(e.end) <= date)) ?? latestEnded(windowEvents), athleteIds: full };
  }
  return none;
}
