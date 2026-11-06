// App shell: loads data, keeps state, routes, handles taps and refresh.
import { createStore, EMPTY_STARS } from './lib/store.js';
import { matchVideo } from './lib/match.js';
import { safeTitle } from './lib/safeTitle.js';
import { ago } from './ui/components.js';
import { rotateVisit } from './lib/visit.js';
import { mergeVideos as merge, backfillTargets } from './lib/videos.js';
import * as screens from './ui/screens.js';

const FILES = ['events', 'athletes', 'teams', 'videos', 'matches', 'channels', 'meta'];
const store = createStore();
const $ = (id) => document.getElementById(id);

const state = {
  data: null,
  videos: [],
  stars: { ...EMPTY_STARS, ...store.get('stars', {}) },
  revealed: new Set(store.get('revealed', [])),
  ui: { format: 'all', when: 'upcoming', followTab: 'athletes', q: '' },
  now: new Date(),
  sinceRaw: null,
  get since() { return this.sinceRaw ?? new Date(this.now.getTime() - 30 * 86400000).toISOString(); },
  athleteName(id) { return this.data.athletes.find((a) => a.id === id)?.name; },
};
// "Since" is fixed per session (6h), and only rotated once data has loaded.
function startVisit() {
  state.now = new Date();
  const legacy = store.get('lastVisit', null);
  const saved = store.get('visit', legacy ? { lastVisit: legacy } : {});
  const r = rotateVisit(saved, state.now);
  state.sinceRaw = r.since;
  store.set('visit', r.saved);
}

async function loadData() {
  const entries = await Promise.all(FILES.map(async (f) => [f, await (await fetch(`/data/${f}.json`)).json()]));
  state.data = Object.fromEntries(entries);
  mergeVideos();
}

function mergeVideos() {
  state.videos = merge(state.data.videos, store.get('refreshCache', null), state.data.meta.lastRun);
}

function setStatus(text) { $('status').textContent = text; }

function baseStatus() {
  const m = state.data.meta;
  const cache = store.get('refreshCache', null);
  const parts = [`Updated ${ago(m.lastRun, state.now.getTime())}`];
  if (cache?.checkedAt) parts.push(`YouTube checked ${ago(cache.checkedAt, state.now.getTime())}`);
  return parts.join('. ') + '.';
}

const LOOKBACK_DAYS = 60;

function toVideo(v, r, addedAt) {
  return { youtubeId: v.youtubeId, rawTitle: v.title, safeTitle: safeTitle(v.title), channelId: v.channelId, publishedAt: v.publishedAt, addedAt, eventId: r.eventId, athleteIds: r.athleteIds, match: r.status };
}

async function refresh() {
  const btn = $('refresh');
  if (btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  setStatus('Checking YouTube…');
  const ctx = { channels: state.data.channels, events: state.data.events, athletes: state.data.athletes, matches: state.data.matches };
  const lastRun = state.data.meta.lastRun;
  const prev = store.get('refreshCache', null);
  const found = new Map((prev?.since === lastRun ? prev.videos : []).map((v) => [v.youtubeId, v]));
  const before = [...found.values()].filter((v) => v.match === 'confirmed').length;
  let checkedAt = new Date().toISOString();
  let failed = null;
  try {
    // 1. Recent uploads from the whitelisted channels.
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const res = await fetch(`/api/refresh?since=${encodeURIComponent(since)}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'upstream');
    const body = await res.json();
    checkedAt = body.checkedAt;
    for (const v of body.videos) {
      const r = matchVideo(v, ctx);
      if (r.status !== 'none' && !found.has(v.youtubeId)) found.set(v.youtubeId, toVideo(v, r, checkedAt));
    }
    // 2. Past events still empty: search YouTube for each (cached a week on the server).
    const targets = backfillTargets(state.data.events, [...state.data.videos, ...found.values()], new Date());
    for (const [i, e] of targets.entries()) {
      setStatus(`Searching past events on YouTube… ${i + 1}/${targets.length}`);
      const r2 = await fetch(`/api/event-videos?id=${encodeURIComponent(e.id)}`);
      if (r2.status === 429) { failed = 'quota'; break; }
      if (!r2.ok) continue;
      for (const v of (await r2.json()).videos) {
        if (found.has(v.youtubeId)) continue;
        const r = matchVideo(v, ctx);
        if (r.status === 'none') continue;
        if (!r.eventId) r.eventId = e.id;
        found.set(v.youtubeId, toVideo(v, r, checkedAt));
      }
    }
  } catch (err) {
    failed = err.message;
  }
  store.set('refreshCache', { checkedAt, since: lastRun, videos: [...found.values()] });
  mergeVideos();
  render();
  btn.setAttribute('aria-busy', 'false');
  const n = [...found.values()].filter((v) => v.match === 'confirmed').length - before;
  if (failed && !n) {
    const why = failed === 'no_key' ? ' (the YouTube key isn’t set up yet)' : failed === 'quota' ? ' (YouTube’s daily limit is used up; try tomorrow)' : '';
    setStatus(`Couldn't check YouTube, showing what's saved${why}.`);
  } else {
    setStatus(n ? `Found ${n} free full ${n === 1 ? 'match' : 'matches'}.` : 'No new free full matches.');
  }
}

function route() {
  const [, name = '', id] = location.hash.replace(/^#/, '').split('/');
  return { name: name || 'home', id: id && decodeURIComponent(id) };
}

function render() {
  if (!state.data) return;
  const r = route();
  const view = { home: () => screens.home(state), calendar: () => screens.calendar(state), event: () => screens.event(state, r.id), following: () => screens.following(state), athlete: () => screens.athlete(state, r.id) }[r.name] ?? (() => screens.home(state));
  $('app').innerHTML = view();
  const tab = { event: 'calendar', athlete: 'following' }[r.name] ?? r.name;
  document.querySelectorAll('.tabs a').forEach((a) => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const newCount = state.videos.filter((v) => v.match === 'confirmed' && Date.parse(v.addedAt ?? v.publishedAt) > Date.parse(state.since)).length;
  $('newcount').hidden = !newCount;
  $('newcount').textContent = newCount;
}

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-reveal],[data-star],[data-ui]');
  if (!t) return;
  if (t.dataset.reveal) {
    state.revealed.add(t.dataset.reveal);
    store.set('revealed', [...state.revealed]);
  } else if (t.dataset.star) {
    const [kind, id] = t.dataset.star.split(':');
    const list = state.stars[kind];
    state.stars[kind] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    store.set('stars', state.stars);
  } else if (t.dataset.ui) {
    const [k, v] = t.dataset.ui.split(':');
    state.ui[k] = v;
  }
  render();
});

document.addEventListener('input', (ev) => {
  if (!ev.target.matches('[data-q]')) return;
  state.ui.q = ev.target.value;
  const pos = ev.target.selectionStart;
  render();
  const input = document.querySelector('[data-q]');
  input.focus(); input.setSelectionRange(pos, pos);
});

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
$('refresh').addEventListener('click', refresh);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !state.data) return;
  if (Date.now() - state.now.getTime() < 3600000) return;
  loadData().then(() => { startVisit(); render(); setStatus(baseStatus()); }).catch(() => {});
});

loadData()
  .then(() => { startVisit(); render(); setStatus(baseStatus()); })
  .catch(() => { $('app').innerHTML = '<h1>Can’t load the data</h1><p class="empty">Check your connection and open the app again.</p>'; });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
