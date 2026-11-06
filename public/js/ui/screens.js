// All five screens. Each takes (state) and returns HTML.
import { esc, fmtDate, fmtRange, ago, eventRow, videoCard, revealBlock, starButton, formatBadge, streamBadge } from './components.js';
import { digest } from '../lib/digest.js';
import { followedAthleteIds } from '../lib/store.js';

const videosFor = (s, eventId) => s.videos.filter((v) => v.eventId === eventId && v.match === 'confirmed');
const countFor = (s, eventId) => videosFor(s, eventId).length;
const channelName = (s, id) => s.data.channels.find((c) => c.id === id)?.name ?? '';
const followed = (s) => new Set(followedAthleteIds(s.stars, s.data.teams));
const isStarredVideo = (s, v) => (v.athleteIds ?? []).some((a) => followed(s).has(a));

function videoList(s, list) {
  if (!list.length) return '';
  return `<ul class="videos">${list.map((v) => videoCard(v, { isNew: Date.parse(v.addedAt ?? v.publishedAt) > Date.parse(s.since), starred: isStarredVideo(s, v), channelName: channelName(s, v.channelId) })).join('')}</ul>`;
}

function maybeBlock(s) {
  const list = s.videos.filter((v) => v.match === 'maybe' && Date.parse(v.addedAt ?? v.publishedAt) > Date.parse(s.since));
  if (!list.length) return '';
  return `<h2>Maybe new</h2><p class="muted">Full matches we couldn't place for sure. Claude sorts them out on Monday.</p>${videoList(s, list.slice(0, 8))}`;
}

function resultsBlock(s, d) {
  if (d.happened.length) return `<h2>Results are in</h2><ul class="events">${d.happened.map((e) => eventRow(e, countFor(s, e.id))).join('')}</ul>`;
  const today = s.now.toISOString().slice(0, 10);
  const recent = s.data.events.filter((e) => e.end < today).slice(-3).reverse();
  return `<h2>Most recent events</h2><p class="muted">Nothing finished since your last visit, so here are the latest.</p><ul class="events">${recent.map((e) => eventRow(e, countFor(s, e.id))).join('')}</ul>`;
}

export function home(s) {
  const d = digest({ events: s.data.events, videos: s.videos.filter((v) => v.match === 'confirmed') }, s.sinceRaw, s.now);
  const since = s.sinceRaw ? `Since your last visit, ${ago(s.sinceRaw, s.now.getTime())}` : 'The last 30 days';
  return `<h1>Catch up</h1><p class="sub">${esc(since)}.</p>
    <h2>New on YouTube</h2>
    ${d.newVideos.length ? videoList(s, d.newVideos.slice(0, 12)) : '<p class="empty">No new free full matches. Tap the refresh button to check YouTube now.</p>'}
    ${maybeBlock(s)}
    ${resultsBlock(s, d)}
    <h2>Coming up</h2>
    ${d.upcoming.length ? `<ul class="events">${d.upcoming.map((e) => eventRow(e, 0)).join('')}</ul>` : '<p class="empty">Nothing in the next 30 days.</p>'}`;
}

export function calendar(s) {
  const f = s.ui.format; const when = s.ui.when;
  const today = s.now.toISOString().slice(0, 10);
  let list = s.data.events.filter((e) => f === 'all' || e.format === f);
  list = when === 'upcoming' ? list.filter((e) => e.end >= today) : list.filter((e) => e.end < today).reverse();
  const pressed = (k, v) => `aria-pressed="${s.ui[k] === v}"`;
  return `<h1>Calendar</h1>
    <div class="seg" role="group" aria-label="When">
      <button type="button" data-ui="when:upcoming" ${pressed('when', 'upcoming')}>Upcoming</button>
      <button type="button" data-ui="when:past" ${pressed('when', 'past')}>Past</button>
    </div>
    <div class="seg" role="group" aria-label="Format">
      <button type="button" data-ui="format:all" ${pressed('format', 'all')}>All</button>
      <button type="button" data-ui="format:gi" ${pressed('format', 'gi')}>Gi</button>
      <button type="button" data-ui="format:nogi" ${pressed('format', 'nogi')}>No-Gi</button>
    </div>
    ${list.length ? `<ul class="events" style="margin-top:12px">${list.map((e) => eventRow(e, countFor(s, e.id))).join('')}</ul>` : '<p class="empty" style="margin-top:12px">No events here yet. New ones are added every Monday.</p>'}`;
}

function placings(p) {
  const rows = [['1', p.gold], ['2', p.silver], ...p.bronze.map((b) => ['3', b])].filter(([, n]) => n);
  return `<ul class="placings">${rows.map(([m, n]) => `<li><span class="medal">${m}</span>${esc(n)}</li>`).join('')}</ul>`;
}

export function event(s, id) {
  const e = s.data.events.find((x) => x.id === id);
  if (!e) return `<h1>Event not found</h1><p class="empty">This event isn't in the list anymore. <a href="#/calendar">Back to the calendar</a>.</p>`;
  const vids = videosFor(s, id).sort((a, b) => (isStarredVideo(s, b) - isStarredVideo(s, a)) || a.publishedAt.localeCompare(b.publishedAt));
  const maybe = s.videos.filter((v) => v.eventId === id && v.match === 'maybe');
  const starredEvent = s.stars.events.includes(id);
  const allKey = `event:${id}`;
  const revealedAll = s.revealed.has(allKey);
  const R = { has: (k) => revealedAll || s.revealed.has(k) };
  const podiums = e.podiums.map((p) => {
    const k = `podium:${id}:${p.gender}:${p.division}`;
    return `<div class="podium"><div class="div">${esc(p.gender === 'male' ? 'Men' : 'Women')}, ${esc(p.division)}</div>${revealBlock(k, R, 'Tap to reveal the podium', placings(p))}</div>`;
  }).join('');
  const supers = e.superfights.map((sf, i) => {
    const k = `super:${id}:${i}`;
    return `<div class="podium"><div class="div">${esc(sf.a)} vs ${esc(sf.b)}</div>${revealBlock(k, R, 'Tap to reveal the result', `<p style="margin:6px 0 0">Winner: ${esc(sf.winner === 'a' ? sf.a : sf.b)}${sf.method ? `, ${esc(sf.method)}` : ''}</p>`)}</div>`;
  }).join('');
  const hasResults = e.podiums.length || e.superfights.length;
  return `<h1>${esc(e.name)}</h1>
    <p class="sub">${esc(fmtRange(e.start, e.end))}, ${esc(e.location ?? '')}</p>
    <div>${formatBadge(e)}${streamBadge(e)}</div>
    <div class="links">${starButton('events', id, starredEvent, e.name)}${e.bracketUrl ? `<a class="btn" href="${esc(e.bracketUrl)}" target="_blank" rel="noopener">Full brackets</a>` : ''}<a class="btn" href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">Source</a></div>
    <h2>Free full matches</h2>
    ${vids.length ? videoList(s, vids) : `<p class="empty">${e.status === 'upcoming' ? 'This event hasn’t happened yet.' : 'None on YouTube yet. They often appear weeks after the event.'}</p>`}
    ${maybe.length ? `<h2>Maybe from this event</h2><p class="muted">Not sure these belong here. Claude checks them on Monday.</p>${videoList(s, maybe)}` : ''}
    <h2>Results</h2>
    ${hasResults ? `${revealedAll ? '' : `<button class="btn" type="button" data-reveal="${allKey}" style="margin-bottom:10px">Reveal all results</button>`}${supers}${podiums}` : `<p class="empty">${e.status === 'upcoming' ? 'Results appear after the event.' : 'Results get added on the next Monday update.'}</p>`}`;
}

export function following(s) {
  const tab = s.ui.followTab;
  const q = s.ui.q.toLowerCase();
  const pressed = (v) => `aria-pressed="${tab === v}"`;
  let body = '';
  if (tab === 'athletes') {
    const list = s.data.athletes.filter((a) => !q || a.name.toLowerCase().includes(q)).sort((a, b) => (s.stars.athletes.includes(b.id) - s.stars.athletes.includes(a.id)) || a.name.localeCompare(b.name));
    body = `<input type="search" placeholder="Search athletes" value="${esc(s.ui.q)}" data-q aria-label="Search athletes">
      <ul class="people">${list.map((a) => `<li class="person"><a href="#/athlete/${esc(a.id)}">${esc(a.name)}<br><span class="team">${esc(s.data.teams.find((t) => t.id === a.teamId)?.name ?? 'No team listed')}</span></a>${starButton('athletes', a.id, s.stars.athletes.includes(a.id), a.name)}</li>`).join('')}</ul>`;
  } else if (tab === 'teams') {
    body = `<p class="muted" style="margin-top:12px">Following a team follows everyone on its roster.</p><ul class="people">${s.data.teams.map((t) => `<li class="person"><span><strong>${esc(t.name)}</strong><br><span class="team">${t.athleteIds.length} athletes</span></span>${starButton('teams', t.id, s.stars.teams.includes(t.id), t.name)}</li>`).join('')}</ul>`;
  } else {
    const list = s.data.events.filter((e) => s.stars.events.includes(e.id));
    body = list.length ? `<ul class="events" style="margin-top:12px">${list.map((e) => eventRow(e, countFor(s, e.id))).join('')}</ul>` : '<p class="empty" style="margin-top:12px">Follow events from their page to keep them here.</p>';
  }
  return `<h1>Following</h1>
    <div class="seg" role="group" aria-label="Show">
      <button type="button" data-ui="followTab:athletes" ${pressed('athletes')}>Athletes</button>
      <button type="button" data-ui="followTab:teams" ${pressed('teams')}>Teams</button>
      <button type="button" data-ui="followTab:events" ${pressed('events')}>Events</button>
    </div>${body}`;
}

export function athlete(s, id) {
  const a = s.data.athletes.find((x) => x.id === id);
  if (!a) return `<h1>Athlete not found</h1><p class="empty"><a href="#/following">Back to Following</a></p>`;
  const team = s.data.teams.find((t) => t.id === a.teamId);
  const matches = s.data.matches.filter((m) => m.a.id === id || m.b.id === id)
    .map((m) => ({ m, e: s.data.events.find((e) => e.id === m.eventId) }))
    .sort((x, y) => y.e.start.localeCompare(x.e.start));
  const vids = s.videos.filter((v) => (v.athleteIds ?? []).includes(id)).sort((x, y) => y.publishedAt.localeCompare(x.publishedAt));
  const links = a.linksVerified ? [a.instagram && `<a class="btn" href="${esc(a.instagram)}" target="_blank" rel="noopener">Instagram</a>`, a.youtube && `<a class="btn" href="${esc(a.youtube)}" target="_blank" rel="noopener">YouTube</a>`].filter(Boolean).join('') : '';
  const byEvent = new Map();
  for (const x of matches) { if (!byEvent.has(x.e.id)) byEvent.set(x.e.id, { e: x.e, list: [] }); byEvent.get(x.e.id).list.push(x.m); }
  const rows = [...byEvent.values()].map(({ e, list }) => {
    const inner = list.map((m) => {
      const opp = m.a.id === id ? m.b : m.a;
      const result = m.winner ? `${(m.winner === 'a') === (m.a.id === id) ? 'Won' : 'Lost'}${m.method ? `, ${esc(m.method)}` : ''}` : 'Result not recorded';
      const video = m.videoId ? ` <a href="https://www.youtube.com/watch?v=${esc(m.videoId)}" target="_blank" rel="noopener">Watch</a>` : '';
      return `<p style="margin:6px 0 0"><strong>vs ${esc(opp.name)}</strong>, ${esc(m.division)}, ${esc(m.round)}. ${result}.${video}</p>`;
    }).join('');
    const label = `${list.length} recorded ${list.length === 1 ? 'match' : 'matches'}. Tap to reveal`;
    return `<div class="matchrow"><div class="mt">${esc(e.name)}</div>${revealBlock(`athlete:${id}:${e.id}`, s.revealed, label, inner)}</div>`;
  }).join('');
  return `<h1>${esc(a.name)}</h1><p class="sub">${esc(team?.name ?? 'No team listed')}</p>
    <div class="links">${starButton('athletes', id, s.stars.athletes.includes(id), a.name)}${links}</div>
    ${a.linksVerified ? '' : '<p class="muted">Profile links show up once they’re confirmed as the athlete’s own.</p>'}
    <h2>Free full matches</h2>${vids.length ? videoList(s, vids) : '<p class="empty">None found yet.</p>'}
    <h2>Matches</h2>${rows || '<p class="empty">No recorded matches yet.</p>'}`;
}
