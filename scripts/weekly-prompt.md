# BJJ Radar: weekly Monday update

You maintain the data for BJJ Radar, a personal app that tracks elite BJJ competitions
(gi and no-gi): when they happen, results, and free full matches on YouTube.
Repo: `bjj-radar` (clone it). Data lives in `public/data/*.json`; the schema is enforced
by `node scripts/validate.js`. Spec: `docs/superpowers/specs/2026-11-06-bjj-radar-design.md`.

## Scope (do not widen)
Elite events only: IBJJF majors (Europeans, Pans, Brasileiros, Worlds, Pan No-Gi,
No-Gi Worlds, The Crown, Grand Prix), ADCC Worlds and Trials, WNO, UFC BJJ, CJI,
BJJ Stars, Polaris. Window: the last 12 months plus everything announced through next year.
Results: adult black belt podiums per division and absolute, superfights, and the matches
of followed-roster athletes (athletes in `athletes.json`).

## Steps
1. Events: use web search to add newly announced events and fix dates, locations, and
   `streaming` (flo | free_youtube | other). Set `status` from today's date. Every event
   needs an https `sourceUrl` that points to the original article, not an aggregator.
2. Results: for events that finished since `meta.lastRun`, add `podiums`, `superfights`,
   and a `matches` entry for each final (gold vs silver, winner "a", method if known).
   Set `resultsSourceUrl` and `resultsAddedAt` (now, ISO) so the app shows them as new.
3. Athletes and teams: keep ~30–40 athletes and ~10 teams. Add aliases (nicknames,
   accent-free spellings). Set `linksVerified: true` only when the handle is confirmed by
   a verified badge, the athlete's own site, or an official promoter tagging them; add
   `linksSourceUrl`. Never guess a handle.
4. Videos: find free full matches posted since `meta.lastRun` on the channels in
   `channels.json`. Only add a video when its YouTube ID is confirmed, and set `addedAt` (now, ISO). Set `safeTitle` with
   the spoiler rules in `public/js/lib/safeTitle.js` (never reveal the winner). Use
   `match: "maybe"` when unsure; review last week's "maybe" items and either confirm them
   with an `eventId` or remove them. Link `matches[].videoId` when a final's video exists.
   You may suggest a new channel in your summary, but never add one to `channels.json`.
5. Run `npm test` and `node scripts/validate.js`. If either fails, fix it. If you can't,
   commit nothing and say why in your summary.
6. Set `meta.json` to `{"lastRun": "<now ISO>", "ok": true}`, commit with message
   `data: weekly update <date>`, and push to `main`. Cloudflare redeploys on push.
7. Finish with a 3-line summary: events added or changed, results added, videos added.
