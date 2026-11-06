import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { fetchUploads } from '../worker/index.js';

const item = (id, publishedAt, title = 'A vs B | FULL MATCH') => ({
  snippet: { title, publishedAt, channelId: 'UC_FLO', resourceId: { videoId: id } },
});
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const assets = { fetch: async () => json([{ id: 'UC_FLO', name: 'Flo', uploadsPlaylistId: 'UU_FLO' }]) };
const req = (q = '?since=2026-11-02T00:00:00Z') => new Request('https://x.dev/api/refresh' + q);

test('fetchUploads keeps only items newer than since, max 50 requested', async () => {
  let url;
  const f = async (u) => { url = u; return json({ items: [item('new', '2026-11-04T00:00:00Z'), item('old', '2026-10-01T00:00:00Z')] }); };
  const out = await fetchUploads('UU_FLO', '2026-11-02T00:00:00Z', 'KEY', f);
  assert.deepEqual(out.map((v) => v.youtubeId), ['new']);
  assert.match(String(url), /maxResults=50/);
  assert.deepEqual(Object.keys(out[0]).sort(), ['channelId', 'publishedAt', 'title', 'youtubeId']);
});

test('missing key → 503 no_key', async () => {
  const res = await worker.fetch(req(), { ASSETS: assets });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'no_key' });
});

test('quotaExceeded → 429 quota', async () => {
  const yt = async () => json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403);
  const res = await worker.fetch(req(), { ASSETS: assets, YT_API_KEY: 'k', fetchImpl: yt });
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: 'quota' });
});

test('upstream failure → 502', async () => {
  const yt = async () => json({}, 500);
  const res = await worker.fetch(req(), { ASSETS: assets, YT_API_KEY: 'k', fetchImpl: yt });
  assert.equal(res.status, 502);
});

test('success returns checkedAt and videos', async () => {
  const yt = async () => json({ items: [item('new', '2026-11-04T00:00:00Z')] });
  const res = await worker.fetch(req(), { ASSETS: assets, YT_API_KEY: 'k', fetchImpl: yt });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.checkedAt);
  assert.equal(body.videos[0].youtubeId, 'new');
});

test('non-api paths go to static assets', async () => {
  const res = await worker.fetch(new Request('https://x.dev/'), { ASSETS: { fetch: async () => new Response('home') } });
  assert.equal(await res.text(), 'home');
});
