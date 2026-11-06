// Small HTML builders shared by the screens.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
export function fmtRange(start, end) {
  if (start === end) return fmtDate(start);
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${MONTHS[m1 - 1]} ${d1}–${d2}, ${y1}`;
  if (y1 === y2) return `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}, ${y1}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}
export function ago(iso, now = Date.now()) {
  const days = Math.floor((now - Date.parse(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function formatBadge(e) {
  if (e.format === 'mixed') return '<span class="badge gi">Gi &amp; No-Gi</span>';
  return e.format === 'gi' ? '<span class="badge gi">Gi</span>' : '<span class="badge nogi">No-Gi</span>';
}
export function streamBadge(e) {
  if (e.status === 'upcoming') return e.streaming === 'free_youtube' ? '<span class="badge free">Free live on YouTube</span>' : '<span class="badge upcoming">Upcoming</span>';
  if (e.streaming === 'free_youtube') return '<span class="badge free">Free on YouTube</span>';
  return '<span class="badge flo">Paywalled (Flo)</span>';
}

// The belt tip: white stripes = free full matches (max 4, like belt degrees).
function beltTip(count, e) {
  if (e.status === 'upcoming') return `<span class="tip"><span class="tiplabel">${esc(fmtShort(e.start))}</span></span>`;
  if (!count) return `<span class="tip"><span class="tiplabel">No free<br>videos</span></span>`;
  const stripes = '<span class="stripe"></span>'.repeat(Math.min(count, 4));
  return `<span class="tip free" title="${count} on YouTube">${stripes}</span>`;
}
const fmtShort = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}`; };

export function eventRow(e, videoCount) {
  const yt = videoCount ? `${videoCount} full ${videoCount === 1 ? 'match' : 'matches'} on YouTube` : '';
  return `<li><a class="event ${e.format}" href="#/event/${esc(e.id)}">
    <span class="edge" aria-hidden="true"></span>
    <span class="body"><h3>${esc(e.name)}</h3>
      <div class="meta">${esc(fmtRange(e.start, e.end))}, ${esc(e.location ?? '')}</div>
      <div class="meta">${formatBadge(e)}${streamBadge(e)}${yt ? `<span>${yt}</span>` : ''}</div></span>
    ${beltTip(videoCount, e)}</a></li>`;
}

export function videoCard(v, { isNew = false, starred = false, channelName = '' } = {}) {
  return `<li><a class="video" href="https://www.youtube.com/watch?v=${esc(v.youtubeId)}" target="_blank" rel="noopener">
    <img src="https://i.ytimg.com/vi/${esc(v.youtubeId)}/mqdefault.jpg" alt="" loading="lazy">
    <span><span class="vt">${isNew ? '<span class="dot" aria-label="New"></span>' : ''}${starred ? '<span class="star" aria-label="Followed athlete">★ </span>' : ''}${esc(v.safeTitle)}</span>
    <span class="vm" style="display:block">${esc(channelName)}${channelName ? ', ' : ''}${esc(fmtDate(v.publishedAt))}</span></span></a></li>`;
}

export function revealBlock(key, revealed, label, inner) {
  if (revealed.has(key)) return inner;
  return `<button class="reveal" type="button" data-reveal="${esc(key)}">${esc(label)}</button>`;
}

export function starButton(kind, id, on, name) {
  return `<button class="starbtn" type="button" data-star="${kind}:${esc(id)}" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(name)}">${on ? '★ Following' : '☆ Follow'}</button>`;
}
