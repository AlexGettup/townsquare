import { PLAZA, STORYTELLER } from "../store/modules/voice";

// cards the player answers by tapping seats: how many they have to pick
const SEATS_TO_CHOOSE = {
  choosePlayer: 1,
  chooseTwoPlayers: 2,
  // the pointing vote (Boomdandy)
  pointAtPlayer: 1,
};

/**
 * Stands in for ChatClient in a practice game: no server, the messages stay
 * on this device. It answers the storyteller the way the voice server would,
 * and the made-up players act through seenBy, answerAs and writeAs (the
 * storyteller does it for them from the "What Ana sees" window).
 *
 * onDelivered(message): an info card reached a made-up player.
 */
export default class PracticeChat {
  constructor({
    onStatus,
    onHistory,
    onMessage,
    onCleared,
    onSeen,
    onChoice,
    onDelivered,
    selfPeerId,
  }) {
    this.onStatus = onStatus;
    this.onHistory = onHistory;
    this.onMessage = onMessage;
    this.onCleared = onCleared;
    this.onSeen = onSeen;
    this.onChoice = onChoice;
    this.onDelivered = onDelivered;
    // who we are now: the storyteller, or the made-up player being viewed as
    this.selfPeerId = selfPeerId || (() => STORYTELLER);
    this.messages = [];
    this.lastId = 0;
    this.isConnected = false;
  }

  // called again on every sync (viewing as a player too), after the live
  // chat client has said "off": the status has to come back each time
  connect() {
    this.onStatus("connected");
    if (this.isConnected) return;
    this.isConnected = true;
    this.onHistory([...this.messages]);
  }

  disconnect() {
    if (!this.isConnected) return;
    this.isConnected = false;
    this.onStatus("off");
  }

  // the server only uses this to keep players quiet at night
  setNight() {}

  /**
   * Storyteller: write in the plaza, or privately (to = player ID). Viewing
   * as a made-up player, they write as them (privately: to the storyteller).
   */
  sendMessage(text, to = null) {
    const self = this.selfPeerId();
    if (self !== STORYTELLER) {
      this._post(self, to ? "dm:" + self : PLAZA, text);
      return;
    }
    this._post(STORYTELLER, to ? "dm:" + to : PLAZA, text);
  }

  /** Storyteller: send a made-up player an info card. */
  sendCard(to, card) {
    const message = this._post(STORYTELLER, "dm:" + to, "", card);
    this.onDelivered(message);
  }

  // what players do: viewing as a made-up player, the storyteller does it
  markSeen(id) {
    this.seenBy(id);
  }
  answerCard(id, players) {
    this.answerAs(id, players);
  }

  clear() {
    this.messages = [];
    this.onCleared();
  }

  /** A made-up player closed an info card. */
  seenBy(id) {
    const message = this._find(id);
    if (!message || message.seen) return;
    message.seen = Date.now();
    this.onSeen(id, message.seen);
  }

  /** A made-up player answered a "choose a player" card. */
  answerAs(id, players) {
    const message = this._find(id);
    if (!message || message.choice || !message.card) return;
    if (players.length !== SEATS_TO_CHOOSE[message.card.phrase]) return;
    message.choice = [...players];
    this.onChoice(id, message.choice);
  }

  /** A made-up player writes to the storyteller. */
  writeAs(playerId, text) {
    if (!text.trim()) return;
    this._post(playerId, "dm:" + playerId, text.trim());
  }

  _find(id) {
    return this.messages.find((message) => message.id === id);
  }

  _post(from, channel, text, card = null) {
    const message = {
      id: ++this.lastId,
      at: Date.now(),
      from,
      channel,
      text,
      card: card ? JSON.parse(JSON.stringify(card)) : null,
      seen: null,
      choice: null,
    };
    this.messages = [...this.messages, message].slice(-500);
    this.onMessage({ ...message });
    return message;
  }
}
