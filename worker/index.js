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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/refresh') return refresh(request, env);
    return env.ASSETS.fetch(request);
  },
};
