// Real titles returned by the live search on 2026-11-06.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchVideo } from '../public/js/lib/match.js';
import { readFileSync } from 'node:fs';
const D = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const ctx = { channels: D('channels'), events: D('events'), athletes: D('athletes'), matches: D('matches') };
const v = (title, publishedAt) => ({ title, publishedAt, channelId: 'flo' });
const cases = [
  ['Janaina Lebre vs Sarah Galvao | FULL MATCH | 2026 IBJJF World Championship', '2026-06-16T15:00:15Z', 'worlds-2026'],
  ['Khaled Alshehhi vs Diego Pato | FULL MATCH | 2026 IBJJF World Championship', '2026-06-03T16:55:16Z', 'worlds-2026'],
  ['Mayssa Bastos vs Jessica Caroline | FULL FINAL | 2026 IBJJF World Championship', '2026-06-04T16:15:54Z', 'worlds-2026'],
  ['Felipe Costa vs Pawel Jaworski | FULL MATCH | 2026 ADCC World Championships', '2026-09-23T16:00:52Z', 'adcc-worlds-2026'],
  ['Diego Pato vs Jakub Wiklacz | FULL MATCH | 2026 ADCC World Championships', '2026-10-13T15:49:21Z', 'adcc-worlds-2026'],
  ['Declan Moody vs Achilles Rocha | FULL MATCH | 2026 ADCC World Championships', '2026-10-17T21:50:51Z', 'adcc-worlds-2026'],
];
for (const [t, at, ev] of cases) test(`real: ${t}`, () => {
  const r = matchVideo(v(t, at), ctx);
  assert.equal(r.status, 'confirmed', t);
  assert.equal(r.eventId, ev, t);
});
for (const t of ['Every Match From Tainan Dalpra At The 2026 IBJJF World Championship', 'LIVE: 2026 IBJJF World Championships | Black Belt Day 2 Preview', 'The Ultimate 2026 ADCC World Championship Highlight', '25 Submissions From Day One Of The 2026 ADCC World Championships'])
  test(`real non-match: ${t}`, () => assert.equal(matchVideo(v(t, '2026-06-02T00:00:00Z'), ctx).status, 'none'));
