# Roadmap

Planned features for this fork. Released work is listed in the [CHANGELOG](CHANGELOG.md).
Ideas move from here to a `feature/<name>` branch once we decide to build them.

## Done

- **3.0.0** Spanish (UI and game content), reference sheet button, voice chat phases 1–3
  (voice, night isolation, private conversations and rooms), text chat, own versioning
- **3.1.0** Token click opens the player menu ("Change Character")
- **3.2.0** Server-side audio routing (each player only receives what they may hear);
  one player menu at a time
- **3.3.0** Voice controls and conversations in the top left corner; NPC panel on the right;
  tooltips kept on screen
- **3.3.1** Seat and character restored after a player switches apps on a phone
- **3.4.0** Chat open by default, compact on phones

## Planned

### Voice chat

- [ ] **Push-to-talk**: the microphone only sends while a key or an on-screen button is held.
      Useful with background noise and on phones.
- [ ] **Volume per person**: a slider for each participant (some people sound too loud or too quiet).
- [ ] **Choose microphone and speaker**: pick the input/output device (headphones + separate mic).
- [ ] **Video**: optional camera with thumbnails on the seats. Estimated ~15 GB per hour for
      11 people at ~300 kbps, well inside the Cloudflare Realtime free tier (1,000 GB/month).

### Text chat

- [ ] **Storyteller messages to several players at once** (e.g. all the Minions).
- [ ] **Storyteller reads every chat**, not only the place they are in (to decide).

### Security

- [ ] **Verify identities**: today each client says who it is (`?peer=<playerId>` or `host`),
      so someone tampering with their browser could pose as another player or the storyteller
      on voice and chat. Fix: a secret the storyteller hands out when creating the session.

### Translation

- [ ] Red Herring reminder: official data says "Pista falsa" (token) but "SEÑUELO" (night text).
      "Señuelo" was offered as an override and not confirmed; ask before changing.

## Notes

- Releases follow the process in [CONTRIBUTING.md](CONTRIBUTING.md#releases).
- The voice server (`voice-server/`) must be deployed together with app changes that touch
  its protocol: `cd voice-server && npx wrangler deploy`.
