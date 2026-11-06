// Cloudflare Worker: serves static assets and /api/refresh (YouTube uploads check).
const API = 'https://www.googleapis.com/youtube/v3/playlistItems';
const DEFAULT_LOOKBACK_MS = 7 * 86400000;

class QuotaError extends Error {}
class UpstreamError extends Error {}

async function assertOk(res) {
  if (res.ok) return;
  let reason = '';
  try { reason = (await res.json())?.error?.errors?.[0]?.reason ?? ''; } catch { /* non-JSON */ }
  if (res.status === 403 && /quota/i.test(reason)) throw new QuotaError();
  throw new UpstreamError(String(res.status));
}

const CHANNELS_API = 'https://www.googleapis.com/youtube/v3/channels';

async function resolveUploads(channel, key, fetchImpl) {
  if (channel.uploadsPlaylistId) return channel.uploadsPlaylistId;
  const res = await fetchImpl(`${CHANNELS_API}?part=contentDetails&forHandle=${encodeURIComponent(channel.handle)}&key=${encodeURIComponent(key)}`);
  await assertOk(res);
  const id = (await res.json())?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new UpstreamError(`unknown handle ${channel.handle}`);
  return id;
}

async function channelVideos(channel, since, key, fetchImpl) {
  const playlistId = await resolveUploads(channel, key, fetchImpl);
  const videos = await fetchUploads(playlistId, since, key, fetchImpl);
  return videos.map((v) => ({ ...v, channelId: channel.id }));
}

export async function fetchUploads(playlistId, since, key, fetchImpl = fetch) {
  const url = `${API}?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${encodeURIComponent(key)}`;
  const res = await fetchImpl(url);
  await assertOk(res);
  const body = await res.json();
  const cutoff = Date.parse(since);
  return (body.items ?? [])
    .map(({ snippet: s }) => ({ youtubeId: s.resourceId.videoId, title: s.title, channelId: s.channelId, publishedAt: s.publishedAt }))
    .filter((v) => Date.parse(v.publishedAt) > cutoff);
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function refresh(request, env) {
  if (!env.YT_API_KEY) return json({ error: 'no_key' }, 503);
  const url = new URL(request.url);
  let since = url.searchParams.get('since');
  if (Number.isNaN(Date.parse(since ?? ''))) since = new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();

  const chRes = await env.ASSETS.fetch(new Request(new URL('/data/channels.json', url)));
  const channels = await chRes.json();
  const fetchImpl = env.fetchImpl ?? fetch;
  const results = await Promise.allSettled(channels.map((c) => channelVideos(c, since, env.YT_API_KEY, fetchImpl)));

  if (results.some((r) => r.status === 'rejected' && r.reason instanceof QuotaError)) return json({ error: 'quota' }, 429);
  const ok = results.filter((r) => r.status === 'fulfilled');
  if (channels.length && !ok.length) return json({ error: 'upstream' }, 502);
  const videos = ok.flatMap((r) => r.value).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return json({ checkedAt: new Date().toISOString(), videos });
}

const SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';
const EVENT_CACHE_MS = 7 * 86400000;

async function readAsset(env, url, path) {
  const res = await env.ASSETS.fetch(new Request(new URL(path, url)));
  return res.json();
}

// YouTube channel id for a whitelisted channel (cached forever in KV).
async function channelId(channel, env, fetchImpl) {
  const key = `ch:${channel.handle ?? channel.id}`;
  const hit = await env.CACHE?.get(key);
  if (hit) return hit;
  if (!channel.handle) return null;
  const res = await fetchImpl(`${CHANNELS_API}?part=id&forHandle=${encodeURIComponent(channel.handle)}&key=${encodeURIComponent(env.YT_API_KEY)}`);
  await assertOk(res);
  const id = (await res.json())?.items?.[0]?.id ?? null;
  if (id) await env.CACHE?.put(key, id);
  return id;
}

// Full matches for one past event, via YouTube search, limited to whitelisted channels.
async function eventVideos(request, env) {
  if (!env.YT_API_KEY) return json({ error: 'no_key' }, 503);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const events = await readAsset(env, url, '/data/events.json');
  const event = events.find((e) => e.id === id);
  if (!event) return json({ error: 'unknown_event' }, 404);

  const cacheKey = `ev:${id}`;
  const cached = await env.CACHE?.get(cacheKey);
  if (cached) {
    const c = JSON.parse(cached);
    if (Date.now() - Date.parse(c.at) < EVENT_CACHE_MS) return json({ cached: true, at: c.at, videos: c.videos });
  }
  const fetchImpl = env.fetchImpl ?? fetch;
  try {
    const channels = await readAsset(env, url, '/data/channels.json');
    const ids = new Map();
    for (const c of channels) {
      try { const yid = await channelId(c, env, fetchImpl); if (yid) ids.set(yid, c.id); }
      catch (e) { if (e instanceof QuotaError) throw e; }
    }
    const q = `${event.name} full match`;
    const res = await fetchImpl(`${SEARCH_API}?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(q)}&publishedAfter=${event.start}T00:00:00Z&key=${encodeURIComponent(env.YT_API_KEY)}`);
    await assertOk(res);
    const videos = ((await res.json()).items ?? [])
      .filter((it) => ids.has(it.snippet?.channelId) && it.id?.videoId)
      .map((it) => ({ youtubeId: it.id.videoId, title: it.snippet.title, channelId: ids.get(it.snippet.channelId), publishedAt: it.snippet.publishedAt }));
    const at = new Date().toISOString();
    await env.CACHE?.put(cacheKey, JSON.stringify({ at, videos }), { expirationTtl: EVENT_CACHE_MS / 1000 });
    return json({ cached: false, at, videos });
  } catch (e) {
    if (e instanceof QuotaError) return json({ error: 'quota' }, 429);
    return json({ error: 'upstream' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/refresh') return refresh(request, env);
    if (pathname === '/api/event-videos') return eventVideos(request, env);
    return env.ASSETS.fetch(request);
  },
};
