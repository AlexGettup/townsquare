# Project context

Personal fork of the Blood on the Clocktower Townsquare (upstream: nicholas-eden/townsquare),
used privately with friends. Published at https://alexgettup.github.io/townsquare/.
Planned work lives in [ROADMAP.md](ROADMAP.md), released work in [CHANGELOG.md](CHANGELOG.md).

## Stack

- Vue 2.7 + Vuex 3 + Vue CLI 5, vue-i18n 8 (English / Spanish).
- Live game sessions still use upstream's server `wss://clocktower.live:8001` (`src/store/socket.js`).
- Voice and text chat use our own Cloudflare Worker in `voice-server/` (free plan):
  Durable Object `VoiceRoom` per game session + Cloudflare Realtime SFU for audio.
  Its URL is in `.env` (`VUE_APP_VOICE_URL`).

## Where things are

- `src/i18n/locales/{en,es}.json`: UI strings. Game texts (roles, reminders, night order,
  jinxes) come from the official translations in `src/i18n/game/es.json`
  (`npm run update-translations`); corrections go in `src/i18n/game/es.overrides.json`.
  Game state stays in English and is translated at display time (store getters
  `localizeRole`, `localizeReminder`, `localizeJinx`).
- Voice: `src/voice/VoiceClient.js` (WebRTC), `src/store/modules/voice.js` (state and hearing
  rules), `src/store/voice.js` (plugin), components `VoiceCorner`, `VoiceMenu`,
  `VoiceConversations`, `VoicePrompts`.
- Text chat: `src/chat/ChatClient.js`, `src/store/modules/chat.js`, `src/store/chat.js`,
  `src/components/ChatPanel.vue`.
- Server: `voice-server/src/index.js`. It decides who is where (plaza, rooms, private
  conversations), who hears whom (only pulls allowed tracks, force-closes the rest) and who
  reads each chat message. Peer IDs: `host` for the storyteller, the seat's player ID otherwise.

## Workflow

- Never commit on `develop` or `main`. Branch off `develop` as `feature/<name>` or
  `bug/<name>`, commit with Conventional Commits in English, then `git merge --no-ff` into
  `develop`, push and delete the branch. No pull requests.
- `main` only receives tested code from `develop`, and only when the owner asks; pushing
  `main` deploys to GitHub Pages.
- Every deploy to `main` is a release (SemVer from 3.0.0): see CONTRIBUTING.md "Releases".
- Ask the owner before changing any translation wording.
- Deploying the voice server is done by the owner: `cd voice-server && npx wrangler deploy`.

## Checks

- `npm run build` must succeed; `npx prettier --write` on changed files. Lint warnings about
  `␍` are only Windows line endings (`core.autocrlf=true`).
- Voice server changes: run `npx wrangler dev --local` in `voice-server/` and test with
  WebSocket clients (set `SFU_API_URL` to a fake SFU to test audio routing without Cloudflare).
- The microphone needs HTTPS, so phone tests happen on the published site.
