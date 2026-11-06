// Combines Monday's videos with this device's refresh results.
// Refresh results belong to one Monday run; a newer run replaces them.
export function mergeVideos(dataVideos, cache, lastRun) {
  if (!cache || cache.since !== lastRun) return [...dataVideos];
  const known = new Set(dataVideos.map((v) => v.youtubeId));
  const extra = [];
  for (const v of cache.videos ?? []) if (!known.has(v.youtubeId)) { known.add(v.youtubeId); extra.push(v); }
  return [...dataVideos, ...extra];
}
