// Cloudflare Worker: serves static assets and /api/refresh (YouTube uploads check).
const API = 'https://www.googleapis.com/youtube/v3/playlistItems';
const DEFAULT_LOOKBACK_MS = 7 * 86400000;

class QuotaError extends Error {}
class UpstreamError extends Error {}

export async function fetchUploads(playlistId, since, key, fetchImpl = fetch) {
  const url = `${API}?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${encodeURIComponent(key)}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    let reason = '';
    try { reason = (await res.json())?.error?.errors?.[0]?.reason ?? ''; } catch { /* non-JSON */ }
    if (res.status === 403 && /quota/i.test(reason)) throw new QuotaError();
    throw new UpstreamError(String(res.status));
  }
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
  const results = await Promise.allSettled(channels.map((c) => fetchUploads(c.uploadsPlaylistId, since, env.YT_API_KEY, fetchImpl)));

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
