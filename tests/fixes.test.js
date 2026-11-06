// Tests for the final-review findings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeTitle, parsePair } from '../public/js/lib/safeTitle.js';
import { matchVideo } from '../public/js/lib/match.js';
import { digest } from '../public/js/lib/digest.js';
import { createStore } from '../public/js/lib/store.js';
import { rotateVisit } from '../public/js/lib/visit.js';
import { mergeVideos } from '../public/js/lib/videos.js';
import { validate } from '../scripts/validate.js';
import * as screens from '../public/js/ui/screens.js';
import { ctx } from './fixtures/ctx.js';

// #1 spoiler titles: allow-list, never the raw title
for (const t of [
  'FULL MATCH | Gordon Ryan Submits Felipe Pena',
  'ADCC 2026: Kade Ruotolo Def. Tye Ruotolo | FULL MATCH',
  'Mica Galvao Subs Tainan Dalpra FULL MATCH',
  'Felipe Pena Gets Submitted By Gordon Ryan',
  'How Mica Galvao Won Double Gold | FULL MATCH',
  'Gordon Ryan Heel Hooks Felipe Pena',
  'Mica Galvão finaliza Tainan Dalpra | LUTA COMPLETA',
  'Mica Galvão vence Tainan Dalpra | LUTA COMPLETA',
  'Gordon Ryan vs Felipe Pena | ADCC 2022 Final',
]) {
  test(`#1 no spoiler survives: ${t}`, () => {
    const out = safeTitle(t);
    assert.doesNotMatch(out, /submit|def\\b|def\\.|subs|won|win|heel|finaliza|vence|final|gold/i, out);
    assert.ok(out === 'Full match' || / vs /.test(out), out);
  });
}
test('#1 dash-separated pair parses', () => {
  assert.deepEqual(parsePair('A Name vs. B Name - FULL MATCH'), ['A Name', 'B Name']);
});

// #4/#5 matching
const ctx2 = { ...ctx, events: [...ctx.events,
  { id: 'nogi-worlds-2026', name: 'IBJJF No-Gi Worlds 2026', aliases: ['no gi worlds', 'nogi worlds'], start: '2026-12-10', end: '2026-12-12' },
  { id: 'crown-2026', name: 'IBJJF The Crown 2026', aliases: ['the crown'], start: '2026-11-08', end: '2026-11-08' }],
  athletes: [...ctx.athletes, { id: 'mica', name: 'Mica Galvao', aliases: [] }, { id: 'kennedy', name: 'Kennedy Maciel', aliases: [] }] };
test('#5 longer alias wins over contained alias', () => {
  const r = matchVideo({ title: 'No-Gi Worlds 2026 FULL MATCH Mica Galvao vs Kennedy Maciel', publishedAt: '2026-12-20T00:00:00Z', channelId: 'UC_FLO' }, ctx2);
  assert.equal(r.status, 'confirmed');
  assert.equal(r.eventId, 'nogi-worlds-2026');
});
test('#4 two athletes with several window events: confirmed via recorded match', () => {
  const c = { ...ctx2, matches: [{ eventId: 'crown-2026', a: { id: 'mica' }, b: { id: 'kennedy' } }] };
  const r = matchVideo({ title: 'Mica Galvao vs Kennedy Maciel | FULL MATCH', publishedAt: '2026-12-20T00:00:00Z', channelId: 'UC_FLO' }, c);
  assert.equal(r.status, 'confirmed');
  assert.equal(r.eventId, 'crown-2026');
});
test('#4 two athletes, several window events, no record: maybe but with the latest event', () => {
  const r = matchVideo({ title: 'Mica Galvao vs Kennedy Maciel | FULL MATCH', publishedAt: '2026-12-20T00:00:00Z', channelId: 'UC_FLO' }, ctx2);
  assert.equal(r.status, 'maybe');
  assert.equal(r.eventId, 'nogi-worlds-2026');
});

// #7 digest uses when data arrived
test('#7 video added after last visit counts as new even if published before', () => {
  const d = digest({ events: [], videos: [{ youtubeId: 'x', publishedAt: '2026-10-01T00:00:00Z', addedAt: '2026-11-02T00:00:00Z' }] }, '2026-10-20T00:00:00Z', new Date('2026-11-06T00:00:00Z'));
  assert.equal(d.newVideos.length, 1);
});
test('#7 results added after last visit show as happened', () => {
  const d = digest({ events: [{ id: 'e', start: '2026-10-01', end: '2026-10-02', resultsAddedAt: '2026-11-02T00:00:00Z' }], videos: [] }, '2026-10-20T00:00:00Z', new Date('2026-11-06T00:00:00Z'));
  assert.equal(d.happened.length, 1);
});

// #8 storage getter throws
test('#8 store works when localStorage getter throws', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
  try {
    const s = createStore();
    s.set('k', 1);
    assert.equal(s.get('k', 0), 1);
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc); else delete globalThis.localStorage;
  }
});

// #6 visit rotation keeps a session window
test('#6 reload within a session keeps the same since', () => {
  const first = rotateVisit({ lastVisit: '2026-10-01T00:00:00Z' }, new Date('2026-11-06T10:00:00Z'));
  assert.equal(first.since, '2026-10-01T00:00:00Z');
  const again = rotateVisit(first.saved, new Date('2026-11-06T11:00:00Z'));
  assert.equal(again.since, '2026-10-01T00:00:00Z');
});
test('#6 a new session after hours starts from the previous visit', () => {
  const first = rotateVisit({ lastVisit: '2026-10-01T00:00:00Z' }, new Date('2026-11-06T10:00:00Z'));
  const later = rotateVisit(first.saved, new Date('2026-11-07T10:00:00Z'));
  assert.equal(later.since, '2026-11-06T10:00:00.000Z');
});
test('#6 first ever visit has null since', () => {
  assert.equal(rotateVisit({}, new Date('2026-11-06T10:00:00Z')).since, null);
});

// #9 refresh cache dropped after a new Monday run
test('#9 cache from an older run is dropped', () => {
  const out = mergeVideos([{ youtubeId: 'a' }], { since: '2026-10-26T00:00:00Z', videos: [{ youtubeId: 'b' }] }, '2026-11-02T00:00:00Z');
  assert.deepEqual(out.map((v) => v.youtubeId), ['a']);
});
test('#9 cache from the current run is merged without duplicates', () => {
  const out = mergeVideos([{ youtubeId: 'a' }], { since: '2026-11-02T00:00:00Z', videos: [{ youtubeId: 'a' }, { youtubeId: 'b' }] }, '2026-11-02T00:00:00Z');
  assert.deepEqual(out.map((v) => v.youtubeId), ['a', 'b']);
});

// #15 https only
test('#15 non-https links are rejected', () => {
  const d = { meta: { lastRun: 'x', ok: true }, channels: [], teams: [], videos: [], matches: [],
    athletes: [{ id: 'a', name: 'A', aliases: [], instagram: 'javascript:alert(1)', linksVerified: true, linksSourceUrl: 'https://s' }],
    events: [{ id: 'e', name: 'E', org: 'O', format: 'gi', aliases: [], start: '2026-01-01', end: '2026-01-01', status: 'done', streaming: 'flo', sourceUrl: 'javascript:x', bracketUrl: null, podiums: [], superfights: [] }] };
  const errs = validate(d);
  assert.ok(errs.some((e) => e.includes('https')));
  assert.ok(errs.filter((e) => e.includes('https')).length >= 2);
});

// #2/#3 spoilers in screens
function uiState(stars) {
  const data = {
    events: [{ id: 'e1', name: 'Worlds', format: 'gi', start: '2026-05-28', end: '2026-05-31', location: 'LB', streaming: 'flo', status: 'done', sourceUrl: 'https://s', bracketUrl: null,
      podiums: [{ gender: 'male', division: 'Open class', gold: 'Ana One', silver: 'Bia Two', bronze: [] }], superfights: [] }],
    athletes: [{ id: 'a1', name: 'Ana One', aliases: [], teamId: null, linksVerified: false }],
    teams: [], channels: [], videos: [],
    matches: [{ id: 'm1', eventId: 'e1', division: 'Male Open class', round: 'Final', a: { id: 'a1', name: 'Ana One' }, b: { id: null, name: 'Bia Two' }, winner: 'a', method: null, videoId: null }],
    meta: { lastRun: '2026-11-02T00:00:00Z' } };
  return { data, videos: [], stars: { events: [], athletes: [], teams: [], ...stars }, revealed: new Set(), ui: {}, now: new Date('2026-11-06T00:00:00Z'), sinceRaw: null, since: '2026-10-07T00:00:00Z', athleteName: (id) => data.athletes.find((a) => a.id === id)?.name };
}
test('#2 podium header has no star for a followed medalist before reveal', () => {
  const html = screens.event(uiState({ athletes: ['a1'] }), 'e1');
  assert.doesNotMatch(html, /★/);
});
test('#3 athlete page hides round and opponent before reveal', () => {
  const html = screens.athlete(uiState({}), 'a1');
  assert.doesNotMatch(html, /Final/);
  assert.doesNotMatch(html, /Bia Two/);
});

test('mixed format is valid and shows under both filters', () => {
  const d = { meta: { lastRun: 'x', ok: true }, channels: [], teams: [], videos: [], matches: [], athletes: [],
    events: [{ id: 'e', name: 'BJJ Stars 20', org: 'BJJ Stars', format: 'mixed', aliases: [], start: '2027-01-01', end: '2027-01-01', status: 'upcoming', streaming: 'flo', sourceUrl: 'https://s', bracketUrl: null, podiums: [], superfights: [] }] };
  assert.deepEqual(validate(d), []);
  const s = { data: { ...d, events: d.events }, videos: [], stars: { events: [], athletes: [], teams: [] }, revealed: new Set(), ui: { format: 'gi', when: 'upcoming' }, now: new Date('2026-11-06T00:00:00Z') };
  assert.match(screens.calendar(s), /BJJ Stars 20/);
  s.ui.format = 'nogi';
  const html = screens.calendar(s);
  assert.match(html, /BJJ Stars 20/);
  assert.match(html, /Gi &amp; No-Gi|Gi & No-Gi/);
});
