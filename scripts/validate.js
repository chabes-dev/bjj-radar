// Validates the JSON files in public/data. CLI exits 1 on any error.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILES = ['meta', 'channels', 'teams', 'athletes', 'events', 'videos', 'matches'];
const DATE = /^\d{4}-\d{2}-\d{2}/;

export function validate(d) {
  const errs = [];
  const err = (m) => errs.push(m);
  const need = (obj, keys, where) => keys.forEach((k) => { if (obj[k] === undefined || obj[k] === '') err(`${where}: missing ${k}`); });
  const ids = (list, key, where) => {
    const seen = new Set();
    for (const x of list) { if (seen.has(x[key])) err(`${where}: duplicate id ${x[key]}`); seen.add(x[key]); }
    return seen;
  };

  for (const f of FILES) if (d[f] === undefined) err(`missing file ${f}`);
  if (errs.length) return errs;

  need(d.meta, ['lastRun', 'ok'], 'meta');

  const channelIds = ids(d.channels, 'id', 'channels');
  d.channels.forEach((c) => {
    need(c, ['id', 'name'], `channel ${c.id}`);
    if (!c.handle && !c.uploadsPlaylistId) err(`channel ${c.id}: needs handle or uploadsPlaylistId`);
  });

  const athleteIds = ids(d.athletes, 'id', 'athletes');
  const teamIds = ids(d.teams, 'id', 'teams');
  const eventIds = ids(d.events, 'id', 'events');
  const videoIds = ids(d.videos, 'youtubeId', 'videos');
  ids(d.matches, 'id', 'matches');

  for (const t of d.teams) {
    need(t, ['id', 'name'], `team ${t.id}`);
    for (const a of t.athleteIds ?? []) if (!athleteIds.has(a)) err(`team ${t.id}: unknown athlete ${a}`);
  }
  for (const a of d.athletes) {
    need(a, ['id', 'name'], `athlete ${a.id}`);
    if (!Array.isArray(a.aliases)) err(`athlete ${a.id}: aliases must be an array`);
    if (a.teamId && !teamIds.has(a.teamId)) err(`athlete ${a.id}: unknown team ${a.teamId}`);
    if (a.linksVerified && !a.instagram && !a.youtube) err(`athlete ${a.id}: linksVerified true but no link`);
    if (a.linksVerified && !a.linksSourceUrl) err(`athlete ${a.id}: linksVerified needs linksSourceUrl`);
  }
  for (const e of d.events) {
    const w = `event ${e.id}`;
    need(e, ['id', 'name', 'org', 'format', 'start', 'end', 'status', 'streaming', 'sourceUrl'], w);
    if (e.format && !['gi', 'nogi'].includes(e.format)) err(`${w}: format must be gi|nogi`);
    if (!['upcoming', 'live', 'done'].includes(e.status)) err(`${w}: bad status ${e.status}`);
    if (!['flo', 'free_youtube', 'other'].includes(e.streaming)) err(`${w}: bad streaming ${e.streaming}`);
    if (!DATE.test(e.start ?? '') || !DATE.test(e.end ?? '')) err(`${w}: bad dates`);
    if (!Array.isArray(e.aliases)) err(`${w}: aliases must be an array`);
    if (!Array.isArray(e.podiums) || !Array.isArray(e.superfights)) err(`${w}: podiums/superfights must be arrays`);
  }
  for (const v of d.videos) {
    const w = `video ${v.youtubeId}`;
    need(v, ['youtubeId', 'rawTitle', 'safeTitle', 'channelId', 'publishedAt'], w);
    if (!['confirmed', 'maybe'].includes(v.match)) err(`${w}: match must be confirmed|maybe`);
    if (v.eventId && !eventIds.has(v.eventId)) err(`${w}: unknown event ${v.eventId}`);
    if (!channelIds.has(v.channelId)) err(`${w}: unknown channel ${v.channelId}`);
    for (const a of v.athleteIds ?? []) if (!athleteIds.has(a)) err(`${w}: unknown athlete ${a}`);
  }
  for (const m of d.matches) {
    const w = `match ${m.id}`;
    if (!eventIds.has(m.eventId)) err(`${w}: unknown event ${m.eventId}`);
    for (const side of ['a', 'b']) {
      if (!m[side]?.name) err(`${w}: side ${side} needs a name`);
      if (m[side]?.id && !athleteIds.has(m[side].id)) err(`${w}: unknown athlete ${m[side].id}`);
    }
    if (m.winner && !['a', 'b'].includes(m.winner)) err(`${w}: winner must be a|b`);
    if (m.videoId && !videoIds.has(m.videoId)) err(`${w}: unknown video ${m.videoId}`);
  }
  return errs;
}

export function loadData(dir) {
  return Object.fromEntries(FILES.map((f) => [f, JSON.parse(readFileSync(join(dir, `${f}.json`), 'utf8'))]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
  const errs = validate(loadData(dir));
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log('data ok');
}
