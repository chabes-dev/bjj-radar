import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFullMatch, matchVideo } from '../public/js/lib/match.js';
import { ctx } from './fixtures/ctx.js';

const v = (title, publishedAt = '2026-05-12T00:00:00Z', channelId = 'UC_FLO') => ({ title, publishedAt, channelId });

test('isFullMatch accepts full match markers', () => {
  for (const t of [
    'Rerrison Gabriel vs Diego Pato | FULL MATCH | 2026 IBJJF Brasileiros',
    'A x B | LUTA COMPLETA',
    'Musumeci vs Mitchell | Full Fight | UFC BJJ 11',
  ]) assert.equal(isFullMatch(t), true, t);
});
test('isFullMatch rejects highlights, shorts, teasers', () => {
  for (const t of [
    'JT Torres teaches his CRUSHING Top Pressure 😤',
    'SUPERCUT: Haisam Rida\'s Explosive Run At ADCC Trials',
    '3 Submissions From Yigit Hanay At ADCC European Trials',
    'Full match teaser #shorts',
    'Worlds highlights | full match recap',
  ]) assert.equal(isFullMatch(t), false, t);
});
test('non-whitelisted channel is none', () => {
  assert.equal(matchVideo(v('Meregali vs Pena | FULL MATCH | 2026 IBJJF Brasileiros', undefined, 'UC_FAN'), ctx).status, 'none');
});
test('highlight is none', () => {
  assert.equal(matchVideo(v('Meregali vs Pena HIGHLIGHTS | Brasileiros'), ctx).status, 'none');
});
test('event name in window is confirmed', () => {
  const r = matchVideo(v('Rerrison Gabriel vs Diego Pato | FULL MATCH | 2026 IBJJF Brasileiros'), ctx);
  assert.equal(r.status, 'confirmed');
  assert.equal(r.eventId, 'brasileiros-2026');
});
test('known athletes get attached on confirmed', () => {
  const r = matchVideo(v('Nicholas Meregali vs Felipe Pena | FULL MATCH | 2026 IBJJF Brasileiros'), ctx);
  assert.deepEqual(r.athleteIds.sort(), ['meregali', 'pena']);
});
test('two full athletes + exactly one event in window is confirmed', () => {
  const r = matchVideo(v('Mikey Musumeci vs Jeff Mitchell | FULL MATCH', '2026-09-30T00:00:00Z', 'UC_UFCBJJ'), ctx);
  assert.equal(r.status, 'confirmed');
  assert.equal(r.eventId, 'ufcbjj-11');
});
test('one athlete only is maybe', () => {
  const r = matchVideo(v('Gordon Ryan vs Some Newcomer | FULL MATCH', '2027-03-01T00:00:00Z'), ctx);
  assert.equal(r.status, 'maybe');
});
test('surname only (twins) is at most maybe and attaches nobody', () => {
  const r = matchVideo(v('Ruotolo vs Ryan | FULL MATCH', '2027-03-01T00:00:00Z'), ctx);
  assert.equal(r.status, 'maybe');
  assert.deepEqual(r.athleteIds, []);
});
test('recurring event name matches the edition in window', () => {
  const r = matchVideo(v('Meregali vs Pena | FULL MATCH | IBJJF Worlds', '2026-07-10T00:00:00Z'), ctx);
  assert.equal(r.eventId, 'worlds-2026');
});
test('year in title disambiguates', () => {
  const r = matchVideo(v('Meregali vs Pena | FULL MATCH | 2025 IBJJF Worlds', '2026-07-10T00:00:00Z'), ctx);
  assert.notEqual(r.eventId, 'worlds-2026');
});
test('nothing known is none', () => {
  assert.equal(matchVideo(v('Joe Bloggs vs Jim Bloggs | FULL MATCH', '2027-03-01T00:00:00Z'), ctx).status, 'none');
});
