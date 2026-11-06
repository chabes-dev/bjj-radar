import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../scripts/validate.js';

const base = () => ({
  meta: { lastRun: '2026-11-02T11:43:00Z', ok: true },
  channels: [{ id: 'UC_FLO', name: 'FloGrappling', uploadsPlaylistId: 'UU_FLO' }],
  teams: [{ id: 'atos', name: 'Atos', aliases: [], athleteIds: ['a1'] }],
  athletes: [
    { id: 'a1', name: 'Ana One', aliases: [], teamId: 'atos', instagram: null, youtube: null, linksVerified: false },
    { id: 'a2', name: 'Bia Two', aliases: [], teamId: null, instagram: 'https://instagram.com/bia', youtube: null, linksVerified: true, linksSourceUrl: 'https://src' },
    { id: 'a3', name: 'Cris Three', aliases: [], teamId: null, instagram: null, youtube: null, linksVerified: false },
  ],
  events: [
    { id: 'e1', name: 'Worlds 2026', org: 'IBJJF', format: 'gi', aliases: ['worlds'], start: '2026-05-28', end: '2026-05-31', location: 'Long Beach', streaming: 'flo', status: 'done', bracketUrl: null, sourceUrl: 'https://src', podiums: [], superfights: [] },
    { id: 'e2', name: 'ADCC 2026', org: 'ADCC', format: 'nogi', aliases: ['adcc'], start: '2026-09-12', end: '2026-09-13', location: 'Krakow', streaming: 'flo', status: 'done', bracketUrl: null, sourceUrl: 'https://src', podiums: [], superfights: [] },
  ],
  videos: [{ youtubeId: 'abc', rawTitle: 'A vs B | FULL MATCH', safeTitle: 'A vs B', channelId: 'UC_FLO', publishedAt: '2026-06-01T00:00:00Z', eventId: 'e1', athleteIds: ['a1'], match: 'confirmed' }],
  matches: [{ id: 'm1', eventId: 'e1', division: 'Adult Black Female Light', round: 'Final', a: { id: 'a1', name: 'Ana One' }, b: { id: null, name: 'Someone' }, winner: 'a', method: 'Points', videoId: 'abc' }],
});

test('valid placeholder data passes', () => {
  assert.deepEqual(validate(base()), []);
});
test('missing format errors', () => {
  const d = base(); delete d.events[0].format;
  assert.ok(validate(d).some((e) => e.includes('format')));
});
test('unknown eventId reference errors', () => {
  const d = base(); d.videos[0].eventId = 'nope';
  assert.ok(validate(d).some((e) => e.includes('nope')));
});
test('linksVerified with no link errors', () => {
  const d = base(); d.athletes[0].linksVerified = true;
  assert.ok(validate(d).some((e) => e.includes('linksVerified')));
});
test('bad video match value errors', () => {
  const d = base(); d.videos[0].match = 'probably';
  assert.ok(validate(d).some((e) => e.includes('match')));
});
test('channel needs handle or uploadsPlaylistId', () => {
  const d = base(); delete d.channels[0].uploadsPlaylistId;
  assert.ok(validate(d).some((e) => e.includes('handle')));
  d.channels[0].handle = '@FloGrappling';
  assert.deepEqual(validate(d), []);
});
test('event without sourceUrl errors', () => {
  const d = base(); delete d.events[0].sourceUrl;
  assert.ok(validate(d).some((e) => e.includes('sourceUrl')));
});
test('verified links need a source', () => {
  const d = base(); delete d.athletes[1].linksSourceUrl;
  assert.ok(validate(d).some((e) => e.includes('linksSourceUrl')));
});
test('duplicate ids error', () => {
  const d = base(); d.athletes[1].id = 'a1';
  assert.ok(validate(d).some((e) => e.includes('duplicate')));
});
test('team roster must reference real athletes', () => {
  const d = base(); d.teams[0].athleteIds.push('ghost');
  assert.ok(validate(d).some((e) => e.includes('ghost')));
});
