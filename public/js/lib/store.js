// Device storage. Every access is guarded; falls back to memory.
export function createStore(storageArg) {
  let storage = null;
  try { storage = storageArg ?? globalThis.localStorage ?? null; } catch { storage = null; }
  const mem = new Map();
  const PREFIX = 'bjjradar:';
  return {
    get(key, fallback) {
      try {
        const raw = storage?.getItem(PREFIX + key);
        if (raw != null) return JSON.parse(raw);
      } catch { /* storage unavailable */ }
      return mem.has(key) ? mem.get(key) : fallback;
    },
    set(key, value) {
      mem.set(key, value);
      try { storage?.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* memory only */ }
    },
  };
}

export const EMPTY_STARS = { events: [], athletes: [], teams: [] };

// Following a team means following its roster.
export function followedAthleteIds(stars, teams) {
  const ids = new Set(stars.athletes ?? []);
  for (const t of teams) if ((stars.teams ?? []).includes(t.id)) t.athleteIds.forEach((a) => ids.add(a));
  return [...ids];
}
