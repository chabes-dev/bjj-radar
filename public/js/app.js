// App shell: loads data, keeps state, routes, handles taps and refresh.
import { createStore, EMPTY_STARS } from './lib/store.js';
import { matchVideo } from './lib/match.js';
import { safeTitle } from './lib/safeTitle.js';
import { ago } from './ui/components.js';
import { rotateVisit } from './lib/visit.js';
import { mergeVideos as merge } from './lib/videos.js';
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

async function refresh() {
  const btn = $('refresh');
  if (btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  setStatus('Checking YouTube…');
  try {
    const since = state.data.meta.lastRun;
    const res = await fetch(`/api/refresh?since=${encodeURIComponent(since)}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'upstream');
    const body = await res.json();
    const ctx = { channels: state.data.channels, events: state.data.events, athletes: state.data.athletes, matches: state.data.matches };
    const found = body.videos
      .map((v) => ({ v, r: matchVideo(v, ctx) }))
      .filter(({ r }) => r.status !== 'none')
      .map(({ v, r }) => ({ youtubeId: v.youtubeId, rawTitle: v.title, safeTitle: safeTitle(v.title), channelId: v.channelId, publishedAt: v.publishedAt, addedAt: body.checkedAt, eventId: r.eventId, athleteIds: r.athleteIds, match: r.status }));
    store.set('refreshCache', { checkedAt: body.checkedAt, since, videos: found });
    mergeVideos();
    render();
    const n = found.filter((v) => v.match === 'confirmed').length;
    setStatus(n ? `Found ${n} new full ${n === 1 ? 'match' : 'matches'} since Monday.` : 'Nothing new on YouTube since Monday.');
  } catch (err) {
    const why = err.message === 'no_key' ? ' (the YouTube key isn’t set up yet)' : err.message === 'quota' ? ' (YouTube’s daily limit is used up; try tomorrow)' : '';
    setStatus(`Couldn't check YouTube, showing Monday's data${why}.`);
  } finally {
    btn.setAttribute('aria-busy', 'false');
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
