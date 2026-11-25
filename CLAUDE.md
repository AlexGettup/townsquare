# Townsquare (fork)

## Talking to the owner

- Reply in **Spanish**, always. Write repository text (code, comments, commits, docs, PRs) in
  English, and every UI text in both `src/i18n/locales/en.json` and `es.json`.
- Plain words over jargon: explain what happened and what the owner has to do, step by step.

## What to build next

`ROADMAP.md` is the single source: its ranking criteria (instinctive use, UX clarity, phones and
computers count the same), "Next steps" and "Not planned". Read it before proposing work; a
decision recorded there stands until the owner changes it (e.g. the Drunk and the Marionette
never go in the bag: it should feel like a real table).

## Game rules

Take setup and ability rules from the official wiki's "How to Run". Its pages refuse automated
reads (HTTP 418); its API answers:
`https://wiki.bloodontheclocktower.com/api.php?action=parse&page=<Name>&prop=wikitext&format=json`.

## Checking a change

- UI changes: build (`npm run build` the first time, it downloads the icons) and look at the
  real app with Playwright, on a computer viewport **and** a phone (`devices["iPhone 13"]`).
  Read the screenshots. The store is reachable as `document.querySelector("#app").__vue__.$store`.
- Simulated finger swipes don't scroll anything in this headless browser: verify scrolling with
  the wheel or `scrollTop`, and say that the swipe itself wasn't tested.
- `voice-server/` (voice, text chat and the live session, one Cloudflare Worker): test with
  `npx wrangler dev` and real WebSocket clients. Wrangler needs Node 22.

## Publishing (cloud sessions)

A cloud session can push only to its own branch. Releases follow `CONTRIBUTING.md` through pull
requests: session branch → `develop`, then `develop` → `main`. Merge them yourself only when the
owner asks to publish, once their checks are green. A push to `main` deploys the Worker, checks
it serves `/live/`, publishes the app and tags `vX.Y.Z` by itself; follow the run in GitHub
Actions and report the result.

Every PR to `develop` or `main` must touch `CHANGELOG.md` (a CI check). A change merged before its
release (one with nothing for players, say) goes under `### Next version` at the top, which the
release folds into its entry.
