import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const files = {
  '/data/events.json': [{ id: 'worlds-2026', name: 'IBJJF Worlds 2026', start: '2026-05-28', end: '2026-05-31' }],
  '/data/channels.json': [{ id: 'flo', name: 'FloGrappling', handle: '@FloGrappling' }],
};
const ASSETS = { fetch: async (req) => json(files[new URL(req.url ?? req).pathname]) };
const kv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; };
const req = (id = 'worlds-2026') => new Request(`https://x.dev/api/event-videos?id=${id}`);
let searches = 0;
const yt = async (u) => {
  u = String(u);
  if (u.includes('/channels?')) return json({ items: [{ id: 'UC_FLO_REAL' }] });
  if (u.includes('/search?')) {
    searches++;
    return json({ items: [
      { id: { videoId: 'v1' }, snippet: { channelId: 'UC_FLO_REAL', title: 'A vs B | FULL MATCH | 2026 IBJJF Worlds', publishedAt: '2026-06-10T00:00:00Z' } },
      { id: { videoId: 'v2' }, snippet: { channelId: 'UC_FAN', title: 'A vs B reupload', publishedAt: '2026-06-11T00:00:00Z' } },
    ] });
  }
  return json({}, 404);
};

test('event-videos: no key → 503', async () => {
  assert.equal((await worker.fetch(req(), { ASSETS })).status, 503);
});
test('event-videos: unknown event → 404', async () => {
  assert.equal((await worker.fetch(req('nope'), { ASSETS, YT_API_KEY: 'k', fetchImpl: yt, CACHE: kv() })).status, 404);
});
test('event-videos: returns only whitelisted channel videos tagged with our id, and searches by event name', async () => {
  let url;
  const f = async (u) => { if (String(u).includes('/search?')) url = String(u); return yt(u); };
  const body = await (await worker.fetch(req(), { ASSETS, YT_API_KEY: 'k', fetchImpl: f, CACHE: kv() })).json();
  assert.deepEqual(body.videos.map((v) => [v.youtubeId, v.channelId]), [['v1', 'flo']]);
  assert.match(decodeURIComponent(url), /IBJJF Worlds 2026 full match/);
  assert.match(url, /publishedAfter=2026-05-28/);
});
test('event-videos: second call within 7 days is served from cache (no new search)', async () => {
  const c = kv(); searches = 0;
  await worker.fetch(req(), { ASSETS, YT_API_KEY: 'k', fetchImpl: yt, CACHE: c });
  const body = await (await worker.fetch(req(), { ASSETS, YT_API_KEY: 'k', fetchImpl: yt, CACHE: c })).json();
  assert.equal(searches, 1);
  assert.equal(body.cached, true);
  assert.equal(body.videos.length, 1);
});
test('event-videos: works without a cache binding', async () => {
  assert.equal((await worker.fetch(req(), { ASSETS, YT_API_KEY: 'k', fetchImpl: yt })).status, 200);
});
test('event-videos: quota → 429', async () => {
  const q = async () => json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403);
  assert.equal((await worker.fetch(req(), { ASSETS, YT_API_KEY: 'k', fetchImpl: q, CACHE: kv() })).status, 429);
});

test('event-videos: cache resets when the channel list changes', async () => {
  const c = kv(); searches = 0;
  await worker.fetch(req(), { ASSETS, YT_API_KEY: 'k', fetchImpl: yt, CACHE: c });
  files['/data/channels.json'] = [{ id: 'flo', name: 'FloGrappling', handle: '@FloGrappling' }, { id: 'bjjstars', name: 'BJJ Stars', handle: '@bjjstarsoficial' }];
  const body = await (await worker.fetch(req(), { ASSETS, YT_API_KEY: 'k', fetchImpl: yt, CACHE: c })).json();
  assert.equal(searches, 2);
  assert.equal(body.cached, false);
});
