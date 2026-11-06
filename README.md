# BJJ Radar

A personal iPhone web app that follows elite BJJ competitions (gi and no-gi): when they
happen, results (behind spoiler taps), and which full matches are free on YouTube.

- **Hosting:** a Cloudflare Worker serves `public/` and `/api/refresh`.
- **Data:** `public/data/*.json`, updated every Monday by a Claude scheduled task
  (`scripts/weekly-prompt.md`), which commits and triggers a redeploy.
- **Refresh button:** checks the whitelisted YouTube channels; uses the YouTube Data API,
  not Claude.

## Develop
```
npm install
npm test                 # unit tests
node scripts/validate.js # data check
npx wrangler dev         # local app + API (put YT_API_KEY in .dev.vars)
```

## Icon
`node scripts/export-icons.js design/icon-options/b.svg` re-exports every icon size.

## Setup (one time)
1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Import a repository → pick
   `bjj-radar`. Build command: none. Deploy command: `npx wrangler deploy`.
3. YouTube key: Google Cloud Console → new project → enable "YouTube Data API v3" →
   Credentials → Create API key (restrict it to that API).
4. Cloudflare → the `bjj-radar` Worker → Settings → Variables and secrets → add a secret
   `YT_API_KEY`.
5. Open the workers.dev URL on the iPhone → Share → Add to Home Screen.
