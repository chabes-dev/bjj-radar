// Combines Monday's videos with this device's refresh results.
// Refresh results belong to one Monday run; a newer run replaces them.
export function mergeVideos(dataVideos, cache, lastRun) {
  if (!cache || cache.since !== lastRun) return [...dataVideos];
  const known = new Set(dataVideos.map((v) => v.youtubeId));
  const extra = [];
  for (const v of cache.videos ?? []) if (!known.has(v.youtubeId)) { known.add(v.youtubeId); extra.push(v); }
  return [...dataVideos, ...extra];
}

// Past events (ended within the last year) that still have no confirmed free matches.
export function backfillTargets(events, videos, now = new Date()) {
  const has = new Set(videos.filter((v) => v.match === 'confirmed').map((v) => v.eventId));
  const t = now.getTime();
  return events.filter((e) => {
    const end = Date.parse(e.end);
    return end < t && t - end < 365 * 86400000 && !has.has(e.id);
  });
}
