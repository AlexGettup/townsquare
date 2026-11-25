# Townsquare voice server

Backend for the in-app voice chat, the text chat and the live session (the
game's sync between the storyteller and the players). It runs for free on
Cloudflare:

- **Cloudflare Realtime SFU** carries the audio: every player uploads their
  microphone once and downloads the people they may hear.
- **This Worker** (with one Durable Object per game session) tells each client
  who is in the voice room and runs the text chat. It proxies the SFU API so
  its secret never reaches the browser, and decides who receives whose
  microphone: clients pull tracks by peerId (SFU sessions are never shared),
  the room refuses pulls the hearing rules do not allow, and force-closes the
  tracks someone may no longer hear (a private conversation, the night…).

- **The live session** (`src/live.js`, one `LiveRoom` Durable Object per game
  session) relays the game between the storyteller and the players, as the
  original project's server (`clocktower.live`) did: player pings go to the
  storyteller, `direct` messages only to their player, everything else to the
  whole session. It checks player secrets and allows one storyteller per
  session (taking over one silent for more than 65 seconds). Clients measure
  their own latency with `["rtt"]`, which the room answers without waking up.

```
browser ──WebSocket──► Worker /live/<session>/<player> (the game itself)
browser ──WebSocket──► Worker /rooms/<session>/ws    (who is in voice)
browser ──WebSocket──► Worker /rooms/<session>/chat  (text chat)
browser ──HTTPS─────► Worker /rooms/<session>/sfu/... ──► Cloudflare Realtime API
browser ◄──WebRTC───► Cloudflare Realtime SFU      (the audio itself)
```

## Setup (once)

1. Create a free Cloudflare account and, in the dashboard, a **Realtime SFU**
   application. Note its **App ID** and **App Token** (the token is secret).
2. From this folder:

   ```sh
   npm install
   npx wrangler login            # opens the browser
   npx wrangler deploy           # prints the Worker URL (…workers.dev)
   npx wrangler secret put CF_APP_ID
   npx wrangler secret put CF_APP_TOKEN
   ```

3. Put the Worker URL in the app's `.env` (repository root):

   ```
   VUE_APP_VOICE_URL=https://townsquare-voice.<your-account>.workers.dev
   ```

## Automatic deploys

Every push to `main` deploys this Worker first and then the app
(`.github/workflows/deploy.yml`), so the app never goes out before the server
it needs. It only needs two repository secrets (GitHub: Settings → Secrets and
variables → Actions → New repository secret):

- `CLOUDFLARE_API_TOKEN`: in the Cloudflare dashboard, My Profile → API
  Tokens → Create Token → the **Edit Cloudflare Workers** template, limited
  to your account.
- `CLOUDFLARE_ACCOUNT_ID`: on the Workers & Pages overview, right column.

Without them the Worker isn't deployed (a warning says so), and the app is
only published if the Worker out there already has the live session; if it
doesn't, the deploy stops, so players never get an app that can't connect.
`CF_APP_ID` and `CF_APP_TOKEN` stay in the Worker: a deploy doesn't touch them.

## Allowed sites

Only pages listed in `ALLOWED_ORIGINS` (`wrangler.toml`) can use the server,
plus `localhost` and local network addresses for development.

## Local development

`npm run dev` starts the Worker on http://localhost:8787. Voice rooms work
locally; audio additionally needs the secrets in a `.dev.vars` file:

```
CF_APP_ID=...
CF_APP_TOKEN=...
```

## Free plan usage

10 players talking for 4 hours use roughly 5 GB of the 1,000 GB/month that
Cloudflare Realtime includes for free. The Worker itself stays far below the
free plan's 100,000 requests/day.
