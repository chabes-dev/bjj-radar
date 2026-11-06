# BJJ Radar — Design Spec

Date: 2026-11-06 · Owner: Chabes · Status: draft for review

## 1. Purpose
A personal, nice-to-have iPhone web app to follow top-level BJJ competitions (gi and no-gi):
when they happen, who won, and whether full matches are free on YouTube. Opened occasionally
(days or weeks apart), so it must be cheap to run and catch up well after long gaps.

### Success looks like
- Opening the app after 3 weeks shows everything new since the last visit, without spoilers.
- Finding a starred athlete's path through an event and jumping to the YouTube match takes ≤3 taps.
- Running cost: $0 infrastructure, one weekly Claude run.

## 2. Scope
**In (v1)**
- Elite events only: IBJJF majors (Europeans, Pans, Brasileiros, Worlds, Pan No-Gi, Worlds No-Gi, Crown, GPs), ADCC Worlds + Trials, WNO, UFC BJJ, CJI, BJJ Stars, Polaris.
- Window: last 12 months + everything scheduled through 2027.
- Follow events, athletes (~30 seeded), and teams (~10 seeded; following a team = following its roster).
- Results: adult black belt podiums per division + absolute, superfight results, and the full match path of starred athletes. "Full brackets" links out to the official page.
- Athlete Instagram / YouTube links (only when verified).
- Spoiler protection.

**Out (v1)**
- Notifications (push, email, Telegram) and the home-screen icon badge.
- Local/regional events, kids/masters/colored belts.
- In-app full bracket trees.
- Flo replays.
- Sync between devices (phone only).

## 3. Screens
1. **Since your last visit (home)** — catch-up digest covering everything since the last open: events that happened, new YouTube matches, upcoming events in the next 30 days. Shows the "N new" count.
2. **Calendar** — past and upcoming events. Each has a Gi (blue) / No-Gi (orange) tag and a status badge: Upcoming · Paywalled (Flo) · Free live · X matches on YouTube.
3. **Event page** — YouTube matches (starred athletes pinned first), podiums (behind a tap), a "Maybe" section for uncertain video matches, and a link to the official brackets.
4. **Following** — starred events, athletes, and teams. The athlete page shows their matches across events (with video links), plus Instagram/YouTube buttons.
5. **Refresh button** — available on every screen; also shows "last updated X days ago".

**Look:** light background (no grey), restrained color used only to aid scanning, mobile-first, installable to the home screen.

**App icon (required):** an original mark that reads at 60px on the iPhone home screen. Direction: a radar sweep merged with a belt bar, using the gi blue / no-gi orange accents on a light ground. No logos, federation marks, or athlete likenesses. Chabes picks from 2–3 options before the build ships. Deliverables: a 1024px master SVG, `apple-touch-icon` 180px, PWA icons at 192/512px, and a favicon.

## 4. Spoilers
- Podiums and match outcomes are hidden behind "Tap to reveal", per item. The reveal is remembered on the device.
- Video titles that reveal the winner (e.g. "X SUBMITS Y", "beats", "defeats", "wins") are shown as "X vs Y".
- "New" markers never show who won.

## 5. Architecture
- **App:** static site (HTML/CSS/JS + PWA manifest) served by a Cloudflare Worker with static assets; the same Worker handles `/api/refresh`. GitHub repo `bjj-radar`, auto-deployed by Cloudflare Workers Builds on each commit (free plan).
- **Data:** JSON files in the repo under `/data` (events, athletes, teams, videos, matches). No database.
- **Weekly Claude run (Monday 1×):** a scheduled task that, using web search:
  1. updates events (dates, status, streaming)
  2. adds results (podiums, superfights, starred-athlete paths)
  3. updates rosters and verified profile links
  4. pulls new YouTube videos and matches them, resolving the "Maybe" items
  5. commits to the repo → Cloudflare redeploys.
  On failure, nothing is committed and the old data stays live.
- **Refresh button:** calls `/api/refresh`, which reads the uploads list of each whitelisted channel via the YouTube Data API. This costs about 1 quota unit per channel, against a free quota of 10k/day, so it is effectively unlimited. It returns videos newer than the last Monday run. Matching runs in the browser against the local athlete/event lists; results are cached on the device until the next deploy. **No Claude usage.**
- **Device storage:** stars, last-visit timestamp, revealed spoilers, refresh cache.
- **Setup required from Chabes:** one free YouTube API key (guided, about 5 minutes), stored as a Cloudflare Worker secret; plus a one-time Cloudflare dashboard step to connect the GitHub repo.

## 6. Data model (summary)
- `events`: id, name, org, format (gi/nogi), dates, location, streaming (flo/free_youtube/other), status, bracketUrl, podiums[], superfights[]
- `athletes`: id, name, aliases[], teamId, instagram?, youtube?, linksVerified
- `teams`: id, name, aliases[], athleteIds[]
- `videos`: youtubeId, rawTitle, safeTitle, channel, publishedAt, eventId?, athleteIds[], match (confirmed/maybe)
- `matches`: eventId, division, round, athleteA, athleteB, winner, method, videoId?

## 7. Video matching rules
- Only whitelisted channels: FloGrappling, IBJJF, UFC BJJ, CJI, BJJ Stars, Polaris, ADCC, WNO. The Monday run may suggest new channels but never adds them automatically.
- The title must signal a full match ("full match", "FULL MATCH", "luta completa", or similar). Highlights, shorts and teasers are skipped.
- **Confirmed:** event name + date window fit, or two known athletes are in the title within an event's date window.
- **Maybe:** only one of those signals. Shown separately; Claude decides on Monday.
- Names are compared accent-insensitively, case-insensitively, and against aliases (e.g. Meregali/Meregalli).

## 8. Failure handling
- Monday run fails → app keeps last good data; the "last updated" stamp ages visibly.
- Refresh fails (quota, network) → a quiet "Couldn't check YouTube, showing Monday's data" message.
- Unverified profile link → the button is hidden rather than guessed.

## 9. Testing
- Unit tests for title matching, spoiler-title cleaning, and name normalization, using real title samples (positive, negative, and "maybe" cases).
- Data-file schema validation runs before every commit; the Monday run aborts on invalid data.
- Manual check on iPhone: install to home screen, open offline, refresh, reveal a spoiler.
