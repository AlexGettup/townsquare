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
- **3.5.0** Screen kept on during a game; installable app (PWA)
- **3.6.0** Info cards (and choice cards) with seen receipts on the storyteller's tokens
- **3.7.0** "What's New" in the menu, Settings tab, day/night button, session code to copy
- **3.8.0** Nomination marks on the tokens, tap/double tap on touch screens, reorganized
  player menu
- **3.9.0** Player menu as a bottom panel on touch screens; no keyboard when picking a
  reminder or character
- **3.10.0** "Your vote" panel for players; alerts when woken up and for info cards
- **3.11.0** Vote value per player (Banshee x2, Bureaucrat x3, Thief -1)
- **3.12.0** Create or join a game from the first screen
- **3.13.0** One voice panel, with people grouped by place; people joining voice are heard
  straight away
- **3.14.0** "You are" card when dealing; volume per person; menus close on a click or tap
  outside; private conversations listed below the voice button on phones
- **3.15.0** Choose players by tapping the seats
- **3.16.0** The game survives the storyteller reloading or losing the connection; "Send
  characters" always in the menu
- **3.17.0** Token size from the players and the screen; double click to kill on computers;
  trash button in the character selector; less lag at night and adding reminders
- **3.18.0** Notes per player; choose microphone and speaker; ability in the player menu on
  touch screens; small x to close the bottom panels; no "+" on the seats on touch screens
- **3.19.0** Day and night counter; day timer
- **3.20.0** End of game with the grimoire revealed to everyone; one info card to several
  players; tap the night order number on touch screens
- **3.21.0** Show the grimoire to a player at night (Spy)
- **3.22.0** Background noise suppression and voice gate in voice chat, like Discord

## Planned

The goal: play a whole game without Discord, as comfortably on a phone or tablet as on a
computer. Marked *(official)* when botc.app has something similar.

### Next steps

The order to build in, across all the sections below (which are the full catalogue). Ranked by
**instinctive use** (it works where people already look or tap, with nothing to learn) and
**UX clarity** (it removes doubts instead of adding a new place to check), then by value for a
game without Discord and by cost. **Computers and phones count the same**: about half the
players use each, so a feature that only helps one of them is worth half as much.

Nothing planned yet. Candidates: analyse joining voice and text chat, game diary, push-to-talk,
guided night, own live session server, and the rest of the catalogue.

### Phones and tablets

- [x] **Keep the screen on** (Screen Wake Lock API) during a game, so phones don't lock and
      players don't drop from their seats.
- [x] **Install as an app (PWA)**: home screen icon and full screen, without the browser bar.
- [x] **Night order on touch screens** (3.20.0): tap the night order number next to a token to
      read its text (no hover there). Chosen over a long press, which nobody would find. A
      token's ability is covered by "Ability in the player menu" (For players).
- [ ] **Portrait layout**: bigger town square, and the panels (bluffs, NPCs, chat) as tabs at
      the bottom instead of floating over the seats.

### Night without talking

- [x] **Info cards** *(official)*: the storyteller sends a player a screen with what they learn —
      characters ("these are your minions", "not in play"), a number (Empath "1"), yes/no
      (Fortune Teller), players. Shown on the player's device and kept in their private chat.
- [x] **Role card when dealing** (3.14.0): when the storyteller really deals the characters (sending them
      to the players, not a mock assignment), each seated player also gets an info card in
      their private chat with the storyteller: "You are" plus their character. It stays there
      to check later, and shows the storyteller whether they have seen it. Dealing again sends
      a new card to everyone, even with the same character (it's how they know), and the old
      one is struck through.
- [x] **Choose targets on screen** *(official)* (3.15.0): the storyteller asks "choose a player" (or two)
      and the player taps the seats on their device (Monk, Poisoner, Demon…).
- [ ] **Guided night for the storyteller**: step through the night order; each step wakes the
      player, shows the card, collects the choice and puts them back to sleep in one tap each.
- [x] **Show the grimoire** (3.21.0) (Spy, Widow): at night, "Show the grimoire" in any seated
      player's menu sends only them a snapshot of the grimoire (characters, reminders, bluffs),
      shown on their town square until they close it or day comes. A book on their seat tells
      the storyteller it was sent (grey) and closed (gold).

Trouble Brewing reviewed (2026-11-09): every other character is covered by info cards,
choosing players and the vote. The Drunk's token is never dealt (the storyteller seats the
Townsfolk they think they are, with a Drunk reminder), so no feature for it. A dawn summary of
who died at night was proposed and declined.

Not planned: **Minion and demon info** *(official)* (one button giving the Demon their bluffs
and minions, and the minions each other). The storyteller prefers to give it by hand with info
cards, because characters like the Lunatic make an automatic version misleading.

### Day and votes

- [ ] **Speaking queue**: raise your hand to talk in the plaza; the storyteller sees the queue.
- [ ] **Quiet nominations**: during the defence only the nominator and the nominee can talk
      (with a timer); everyone is muted when the vote starts.
- [x] **Day timer** *(official)* (3.19.0): a countdown everyone sees ("5 minutes of discussion left"),
      with a sound when it ends.
- [ ] **Ambient sounds**: dusk, dawn, executions.
- [x] **End of game and grimoire reveal** *(official)* (3.20.0): the storyteller ends the game and
      declares the winning team (Good or Evil); everyone sees the result and the full
      grimoire (real characters, reminders and demon bluffs), and voice brings everyone back to
      the plaza to talk about it.

### For players

Ranked with the same criteria as the [next steps](#next-steps).

| # | Feature | Instinctive | Clarity | Value | Cost |
|---|---------|:-----------:|:-------:|:-----:|:----:|
| 1 | Notes per player | ●●●○○ | ●●●●○ | ●●●●● | Medium |
| 2 | Ability in the player menu | ●●●●● | ●●●●● | ●●○○○ | Low |
| 3 | Day and night counter | ●●●●● | ●●●●○ | ●●○○○ | Low |
| 4 | Game diary | ●●●○○ | ●●●●○ | ●●●○○ | Medium |
| 5 | Claims on the reference sheet | ●●○○○ | ●●●○○ | ●●○○○ | Medium |

- [x] **Alerts** (3.10.0): when the storyteller wakes you up, a notice on screen and a sound
   unless muted; phones also vibrate (not iPhones: their browser doesn't support it), and the
   tab title flags it while the game is in the background. Info cards also flag the tab title.
   No alerts for nominations or votes, on purpose: the countdown is enough, and the "Your vote"
   panel makes voting clear.

1. [x] **Notes per player** (3.18.0) *(official)*: a "Notes" entry in the player menu with free text
   ("claims Chef, saw a 1"), and a small icon on the token when it has a note, so they are
   found again at a glance. Only visible to you and saved on your device. The biggest gap for
   playing without paper, but it has to be discovered.
2. [x] **Ability in the player menu** (3.18.0): the bottom panel on touch screens already shows the name
   and character; add the ability text. Tapping your own token answers "what does my
   character do?" right where you look, and tapping another token explains the character you
   think they are. Only for touch screens: computers already show it on hover.
3. [x] **Day and night counter** (3.19.0): "Day 3" / "Night 2" instead of only day or night, synced from
   the storyteller. Passive and clear; also gives the diary and the notes a reference.
4. [ ] **Game diary**: everything you learnt, night by night ("Night 1: you are the Empath;
   Night 2: you learn 1"), in one list. Info cards are kept in the private chat today, mixed
   with the messages. Another place to look, so it goes after the counter, which labels it.
5. [ ] **Claims on the reference sheet**: tap a character on the reference sheet and note who
   claims it, so a double claim stands out. Hard to find and overlaps with the notes: better
   as a later extension of them than as a separate feature.

### Robustness

- [ ] **Own live session server**: games still sync through upstream's server
      (`clocktower.live`); if it goes away the app stops working. Move the game sync to our
      Cloudflare Worker, like voice and chat.
- [x] **Storyteller reloads without losing anything** (3.16.0): seats, dealt characters, night,
      who is awake, the vote under way, vote history and card ticks survive a page reload or a
      lost connection. A game saved more than 12 hours ago counts as a new one.

### Voice chat

- [x] **One voice panel, people grouped by place** (3.13.0): your own controls on top; below,
      the places (plaza, private conversations, rooms), each listing who is in it with the
      speaking indicator. Tap a name to invite them to talk; enter or ask to join from each
      place; at night the same list wakes and puts to sleep. A side panel that folds on
      computers, the bottom panel on touch screens. Volume goes in a name's options, and
      the choice of microphone and speaker in the controls on top.
- [ ] **Voice and text chat together** (to analyse after the voice panel): text chat also
      follows the places (a private conversation has its own chat), so one communication
      panel with each place's people and messages may be clearer than two panels. Decide
      once the voice panel is in use.
- [x] **Background noise, like Discord** (3.22.0): RNNoise noise suppression plus a voice
      gate that sends silence while nobody talks, with automatic sensitivity or a manual
      threshold on a live meter in the voice panel (saved per device). Errs on the side of
      letting noise through: a soft voice must never be cut. Firefox may fall back to the gate
      alone. Untested with real voices and phones.
- [ ] **Push-to-talk**: the microphone only sends while a key or an on-screen button is held.
      Useful with background noise; optional, since it has to be learnt (and holding a button
      while talking is awkward on a phone).
- [x] **Volume per person** (3.14.0): a slider for each participant (some people sound too loud or too quiet).
      iPhones don't let a web page change an audio element's volume: route it through Web Audio.
- [x] **Choose microphone and speaker** (3.18.0, computers): pick the input/output device (headphones + separate mic).
- [ ] **Video**: optional camera with thumbnails on the seats. Estimated ~15 GB per hour for
      11 people at ~300 kbps, well inside the Cloudflare Realtime free tier (1,000 GB/month).

### Text chat

- [x] **Info cards to several players at once** (3.20.0) (e.g. all the Minions): a "To" row in the
      card window; each one gets it in their private chat.
- [ ] **Storyteller reads every chat**, not only the place they are in (to decide).

### Security

- [ ] **Verify identities**: today each client says who it is (`?peer=<playerId>` or `host`),
      so someone tampering with their browser could pose as another player or the storyteller
      on voice and chat. Fix: a secret the storyteller hands out when creating the session.

### Translation

- [x] Red Herring reminder: official data says "Pista falsa" (token) but "SEÑUELO" (night text).
      Decided to keep the official translations as they are.

## Notes

- Releases follow the process in [CONTRIBUTING.md](CONTRIBUTING.md#releases).
- The voice server (`voice-server/`) must be deployed together with app changes that touch
  its protocol: `cd voice-server && npx wrangler deploy`.
