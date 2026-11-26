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
- **3.23.0** Practice game; info cards like the official app; audio settings in the menu
- **3.24.0** Guided night for the storyteller; info cards built line by line
- **3.25.0** Info cards that fill themselves and quick answers; edit the grimoire before
  showing it; secret and pointing votes, vote value from reminders, ghost votes back; dim
  who can't hear you; random nominations and answers in the practice game
- **3.26.0** Practice game with automatic players and "view as a player"; reminders in the
  card window; votes to tie; characters right after picking the edition
- **3.27.0** Ghost votes spent by themselves and moved to the menu; shorter player menu
  ("More", "My seat"); the dead vote less in practice games
- **3.28.0** Game diary for players with each day's summary (on the block, votes to tie);
  clearer ghost vote warning; "Change character" under "More"
- **3.28.1** One majority in the vote overlay; guided night clear of the circle on phones
- **3.28.2** The town square's middle (logo, counters, vote) moves up with the seats too
- **3.29.0** Storyteller announcements to the town; voice chat survives dropped connections
  (30 s grace on the server, automatic recovery on the client) and logs what goes wrong
- **3.30.0** "New game" with the same seats; automatic "Time's up" announcement; second and
  last call for nominations
- **3.30.1** Voice chat receives again anyone whose audio stopped arriving
- **3.31.0** Voice chat problems button (receive again, reconnect, report); players hear
  whoever the voice server allows
- **3.32.0** Send one player their new character and alignment; Storyteller's night
  summary; the Toymaker in the guided night
- **3.33.0** Own live session server (in our Cloudflare Worker); traveller exiles in the vote
  overlay
- **3.34.0** Character selection rules (counters, copies, notes per character); the reminder
  window scrolls on phones; releases tagged by the deploy
- **3.35.0** Portrait layout: on upright phones and tablets the bluffs, NPCs and chat share a
  strip with tabs at the bottom instead of floating over the seats

## Planned

The goal: play a whole game without Discord, as comfortably on a phone or tablet as on a
computer. Ideas are ranked by **instinctive use** (it works where people already look or tap)
and **UX clarity** (it removes doubts instead of adding a place to check), then by value and
cost. **Computers and phones count the same**: about half the players use each. Marked
_(official)_ when botc.app has something similar. Details of what is done are in the
[CHANGELOG](CHANGELOG.md).

### Next steps

None chosen yet: the owner picks the next one (the portrait layout shipped in 3.35.0).

### Night without talking

- [ ] **Open eyes at night** _(official)_ (Wraith): one player keeps their eyes open at night
      and sees who is awake and the cards sent.

### Day and votes

- [ ] **Quiet during the defence, without forcing it**: some way for the nominator and the
      nominee to be heard during the defence without muting anyone. To think about.
- [ ] **Ambient sounds**: dusk, dawn, executions.
- [ ] **Public reminders** _(official)_: some characters' reminders are seen by every player.
- [ ] **Voudon vote** (rare traveller): only the Voudon and the dead vote, with no majority
      needed. No priority.

### Storyteller setup

- [ ] **"Adjust" button in the character selector**: swaps Townsfolk and Outsiders at random
      until the counters fit what the chosen characters call for (Baron, Godfather…). The
      counters and notes are done (3.34.0).

### Voice and text chat

- [ ] **Voice and text chat together**: one panel with each place's people and messages,
      instead of two. To analyse.
- [ ] **Push-to-talk**: the microphone only sends while a key or a button is held. Optional.
- [ ] **Block private conversations** (Matron, rare traveller): a storyteller switch. No
      priority.
- [ ] **Video** _(official)_: optional camera with thumbnails on the seats, hidden at night.
      Fits the Cloudflare free tier; heavy on phones' data and battery.
- [ ] **Storyteller reads every chat**, not only the place they are in. To decide.

### Robustness and security

- [ ] **Verify identities**: each client says who it is, so someone tampering with their
      browser could pose as another player or the storyteller. Parked: we trust the players.

## Not planned

- **Minion and demon info in one button** _(official)_: given by hand with info cards, since
  characters like the Lunatic make an automatic version misleading.
- **Drunk features**: the Drunk's token is never dealt.
- **Practice game as an exam**: no review of the storyteller's night, no "mistakes" pointed
  out, no graded scenarios. The practice game is a simulator of a game seen from the
  storyteller's seat: the made-up players play and the storyteller reacts.
- "Thinks they are…" for the Lunatic, Drunk and Marionette; whispers only between neighbours;
  the end-of-game reveal from a reminder; panels you can drag around.
- A forced speaking queue and forced quiet nominations; marks on the night order sheet; the
  guided night waking dead players who act; a key to call everyone to the plaza; claims on
  the reference sheet.

Scripts reviewed: Trouble Brewing (2026-11-09), Bad Moon Rising and Sects & Violets
(2026-11-10). Everything else they need is covered by info cards, choices, votes and the
storyteller's grimoire.
