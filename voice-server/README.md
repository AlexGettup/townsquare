# Townsquare voice server

Backend for the in-app voice chat. It runs for free on Cloudflare:

- **Cloudflare Realtime SFU** carries the audio: every player uploads their
  microphone once and downloads the others.
- **This Worker** (with one Durable Object per game session) tells each client
  who is in the voice room, and proxies the SFU API so its secret never
  reaches the browser.

```
browser ──WebSocket──► Worker /rooms/<session>/ws   (who is in voice)
browser ──HTTPS─────► Worker /sfu/...  ──► Cloudflare Realtime API
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
