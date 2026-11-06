import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digest } from '../public/js/lib/digest.js';
import { createStore, followedAthleteIds } from '../public/js/lib/store.js';

const now = new Date('2026-11-06T12:00:00Z');
const data = {
  events: [
    { id: 'old', start: '2025-01-10', end: '2025-01-12' },
    { id: 'recent', start: '2026-10-20', end: '2026-10-21' },
    { id: 'soon', start: '2026-11-20', end: '2026-11-21' },
    { id: 'far', start: '2027-02-01', end: '2027-02-02' },
  ],
  videos: [
    { youtubeId: 'v-old', publishedAt: '2025-02-01T00:00:00Z' },
    { youtubeId: 'v-new', publishedAt: '2026-10-25T00:00:00Z' },
  ],
};

test('first visit uses a 30-day window', () => {
  const d = digest(data, null, now);
  assert.deepEqual(d.happened.map((e) => e.id), ['recent']);
  assert.deepEqual(d.newVideos.map((v) => v.youtubeId), ['v-new']);
  assert.equal(d.newCount, 2);
});
test('400-day absence is capped and does not throw', () => {
  const d = digest(data, '2025-10-01T00:00:00Z', now);
  assert.ok(d.happened.some((e) => e.id === 'recent'));
  assert.ok(!d.happened.some((e) => e.id === 'old'));
});
test('upcoming is next 30 days', () => {
  assert.deepEqual(digest(data, null, now).upcoming.map((e) => e.id), ['soon']);
});
test('recent visit shows nothing new', () => {
  assert.equal(digest(data, '2026-11-05T00:00:00Z', now).newCount, 0);
});
test('invalid lastVisit falls back to 30 days', () => {
  assert.equal(digest(data, 'garbage', now).newCount, 2);
});
test('starring a team follows its roster', () => {
  const teams = [{ id: 'nw', athleteIds: ['x', 'y'] }];
  assert.deepEqual(followedAthleteIds({ athletes: ['z', 'x'], teams: ['nw'], events: [] }, teams).sort(), ['x', 'y', 'z']);
});
test('store survives a throwing storage', () => {
  const bad = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  const s = createStore(bad);
  s.set('k', { a: 1 });
  assert.deepEqual(s.get('k', null), { a: 1 });
  assert.equal(s.get('missing', 7), 7);
});
