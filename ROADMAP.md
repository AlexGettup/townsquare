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

The goal: play a whole game without Discord, as comfortably on a phone or tablet as on a
computer. Suggested order: phone basics (wake lock, PWA) → night info cards and choosing
targets on screen → player notes → own live session server. Marked *(official)* when
botc.app has something similar.

### Phones and tablets

- [x] **Keep the screen on** (Screen Wake Lock API) during a game, so phones don't lock and
      players don't drop from their seats.
- [x] **Install as an app (PWA)**: home screen icon and full screen, without the browser bar.
- [ ] **Vibration** when you are woken up, receive an info card or a vote starts.
- [ ] **Long press instead of hover** on touch screens: see a token's ability or night order.
- [ ] **Portrait layout**: bigger town square, and the panels (bluffs, NPCs, chat) as tabs at
      the bottom instead of floating over the seats.

### Night without talking

- [x] **Info cards** *(official)*: the storyteller sends a player a screen with what they learn —
      characters ("these are your minions", "not in play"), a number (Empath "1"), yes/no
      (Fortune Teller), players. Shown on the player's device and kept in their history.
- [ ] **Choose targets on screen** *(official)*: the storyteller asks "choose a player" (or two)
      and the player taps the seats on their device (Monk, Poisoner, Demon…).
- [ ] **Guided night for the storyteller**: step through the night order; each step wakes the
      player, shows the card, collects the choice and puts them back to sleep in one tap each.
- [ ] **Minion and demon info** *(official)*: one button gives the Demon their bluffs and
      minions, and the minions each other.

### Day and votes

- [ ] **Speaking queue**: raise your hand to talk in the plaza; the storyteller sees the queue.
- [ ] **Quiet nominations**: during the defence only the nominator and the nominee can talk
      (with a timer); everyone is muted when the vote starts.
- [ ] **Day timer** *(official)*: a countdown everyone sees ("5 minutes of discussion left"),
      with a sound when it ends.
- [ ] **Ambient sounds**: dusk, dawn, executions.

### For players

- [ ] **Notes per player** *(official)*: free text on each seat ("claims Chef, saw a 1"), only
      visible to you and saved on your device.
- [ ] **Game diary**: everything you learnt, night by night, in one list.
- [ ] **End of game and grimoire reveal** *(official)*: the storyteller ends the game and
      declares the winning team (Good or Evil); everyone sees the result and the full
      grimoire, and voice brings everyone back to the plaza to talk about it.

### Robustness

- [ ] **Own live session server**: games still sync through upstream's server
      (`clocktower.live`); if it goes away the app stops working. Move the game sync to our
      Cloudflare Worker, like voice and chat.
- [ ] **Storyteller reloads without losing anything**: keep the dealt characters and the info
      cards sent across a page reload.

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
