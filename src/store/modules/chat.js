/**
 * Text chat state. The connection lives in src/chat/ChatClient.js, created by
 * the chat store plugin (src/store/chat.js) and reachable as this.$chat.
 *
 * Messages arrive with a channel: the place they were written in (plaza,
 * a room or a private conversation) or "dm:<playerId>", the private channel
 * between a player and the storyteller. The panel shows them in tabs:
 * "place" (everything said around us) and one tab per private channel.
 */
import { PLAZA, STORYTELLER } from "./voice";

export const PLACE_TAB = "place";
export const dmTab = (playerId) => "dm:" + playerId;
export const tabOf = (message) =>
  message.channel.startsWith("dm:") ? message.channel : PLACE_TAB;
// a card telling a player their character: the latest one is the valid one
export const isRoleCard = ({ card }) => !!card && card.phrase === "youAre";
// cards the player answers by tapping seats: how many they have to pick
const SEATS_TO_CHOOSE = { choosePlayer: 1, chooseTwoPlayers: 2 };
const seatsToChoose = ({ card }) => (card && SEATS_TO_CHOOSE[card.phrase]) || 0;
// without an answer from the server by then, the player can try again
const ANSWER_TIMEOUT = 5 * 1000;
let answerTimer = null;

const state = () => ({
  status: "off", // off | connecting | connected | error
  messages: [],
  isOpen: true,
  tab: PLACE_TAB,
  // tab -> number of messages not read yet
  unread: {},
  // last error from the server ("night"), shown for a few seconds
  error: "",
  // info card on screen (a chat message with a card)
  shownCard: null,
  // player answering a "choose a player" card: names picked so far, and
  // what happened to the answer: "" | "sending" | "failed"
  picked: [],
  answerStatus: "",
  // storyteller: player ID we are writing an info card for
  composingFor: null,
  // storyteller: card ticks only show for cards sent after this (each
  // nightfall and dawn starts afresh)
  cardsSince: 0,
});

const getters = {
  isConnected: (state) => state.status === "connected",
  // where we are for the chat: our voice place, or the plaza without voice
  currentPlace: (state, getters, rootState, rootGetters) =>
    rootGetters["voice/isConnected"] ? rootState.voice.location : PLAZA,
  // the place tab only shows what was said where we are now (the plaza, a
  // room or a private conversation), not the places we were before
  messagesOf: (state, getters) => (tab) =>
    state.messages.filter((message) =>
      tab === PLACE_TAB
        ? tabOf(message) === PLACE_TAB &&
          message.channel === getters.currentPlace
        : tabOf(message) === tab,
    ),
  /**
   * Private tabs: a player only talks with the storyteller; the storyteller
   * has one per seated player (and anyone else who wrote to them).
   */
  privateTabs: (state, getters, rootState, rootGetters) => {
    const self = rootGetters["voice/selfPeerId"];
    if (self !== STORYTELLER) return [dmTab(self)];
    const tabs = rootState.players.players
      .filter((player) => player.id)
      .map((player) => dmTab(player.id));
    state.messages.forEach((message) => {
      const tab = tabOf(message);
      if (tab !== PLACE_TAB && !tabs.includes(tab)) tabs.push(tab);
    });
    return tabs;
  },
  /**
   * Storyteller: the last info card sent to a player in this phase:
   * "sent" (not seen yet), "seen", "answered" or null (none).
   */
  cardStatusOf: (state) => (playerId) => {
    const channel = dmTab(playerId);
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const message = state.messages[i];
      if (message.at < state.cardsSince) return null;
      if (message.channel === channel && message.card) {
        if (message.choice) return "answered";
        return message.seen ? "seen" : "sent";
      }
    }
    return null;
  },
  // the card on screen, up to date with its answer
  shownMessage: (state) =>
    state.shownCard
      ? state.messages.find(({ id }) => id === state.shownCard.id) || null
      : null,
  seatsToPick: (state, getters) =>
    getters.shownMessage ? seatsToChoose(getters.shownMessage) : 0,
  // player: the card on screen is answered on the seats, not in a window
  isAnswering: (state, getters, rootState, rootGetters) =>
    !!getters.seatsToPick &&
    !getters.shownMessage.choice &&
    rootGetters["voice/selfPeerId"] !== STORYTELLER,
  // the seats take the taps, except during a vote: it comes first
  isPicking: (state, getters, rootState) =>
    getters.isAnswering && !rootState.session.nomination,
  // player: the last "choose a player" card, if it still needs an answer
  pendingChoice: (state, getters, rootState, rootGetters) => {
    if (rootGetters["voice/selfPeerId"] === STORYTELLER) return null;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const message = state.messages[i];
      if (seatsToChoose(message)) return message.choice ? null : message;
    }
    return null;
  },
  totalUnread: (state) =>
    Object.values(state.unread).reduce((total, count) => total + count, 0),
};

const addUnread = (state, tab) => {
  state.unread = { ...state.unread, [tab]: (state.unread[tab] || 0) + 1 };
};

const mutations = {
  setStatus(state, status) {
    state.status = status;
  },
  setHistory(state, messages) {
    state.messages = messages;
    state.unread = {};
  },
  addMessage(state, { message, unread }) {
    if (state.messages.some(({ id }) => id === message.id)) return;
    state.messages = [...state.messages, message].slice(-500);
    if (unread) addUnread(state, tabOf(message));
  },
  // a card was seen or answered
  updateMessage(state, { id, ...fields }) {
    state.messages = state.messages.map((message) =>
      message.id === id ? { ...message, ...fields } : message,
    );
  },
  addUnread,
  resetCardStatus(state) {
    state.cardsSince = Date.now();
  },
  setCardsSince(state, cardsSince) {
    state.cardsSince = cardsSince;
  },
  clear(state) {
    state.messages = [];
    state.unread = {};
    state.shownCard = null;
    state.picked = [];
    state.answerStatus = "";
  },
  setOpen(state, isOpen) {
    state.isOpen = isOpen;
    if (isOpen) state.unread = { ...state.unread, [state.tab]: 0 };
  },
  setTab(state, tab) {
    state.tab = tab;
    if (state.isOpen) state.unread = { ...state.unread, [tab]: 0 };
  },
  setError(state, error) {
    state.error = error;
  },
  showCard(state, message) {
    state.shownCard = message;
    state.picked = [];
    state.answerStatus = "";
  },
  hideCard(state) {
    state.shownCard = null;
    state.picked = [];
    state.answerStatus = "";
  },
  setPicked(state, picked) {
    state.picked = picked;
  },
  setAnswerStatus(state, answerStatus) {
    state.answerStatus = answerStatus;
  },
  composeCard(state, playerId) {
    state.composingFor = playerId;
  },
};

const actions = {
  /** Write in the open tab. */
  send({ state, rootGetters }, text) {
    if (!text.trim()) return;
    if (state.tab === PLACE_TAB) {
      this.$chat.sendMessage(text);
    } else if (rootGetters["voice/selfPeerId"] === STORYTELLER) {
      this.$chat.sendMessage(text, state.tab.slice("dm:".length));
    } else {
      this.$chat.sendMessage(text, STORYTELLER);
    }
  },
  /** Storyteller only: send an info card to a player. */
  sendCard({ rootGetters }, { to, card }) {
    if (rootGetters["voice/selfPeerId"] !== STORYTELLER || !to) return;
    this.$chat.sendCard(to, card);
  },
  /**
   * Storyteller only: when dealing, tell each seated player their character.
   * Dealing again sends everyone a new card, also those who got the same
   * character: it's how they know the storyteller dealt again.
   */
  sendRoleCards({ dispatch, rootState }) {
    rootState.players.players.forEach(({ id, role }) => {
      if (!id || !role || !role.id) return;
      dispatch("sendCard", {
        to: id,
        card: {
          phrase: "youAre",
          text: "",
          roles: [role.id],
          players: [],
          number: null,
          answer: null,
        },
      });
    });
  },
  /** Player: tap a seat. Tapping it again unpicks it; the oldest gives way. */
  pickSeat({ state, getters, commit }, name) {
    commit(
      "setPicked",
      state.picked.includes(name)
        ? state.picked.filter((picked) => picked !== name)
        : [...state.picked, name].slice(-getters.seatsToPick),
    );
  },
  /**
   * Player: send the seats picked as the answer to the card on screen. The
   * card closes when the server confirms it (see onChoice in store/chat.js).
   */
  answerCard({ state, getters, commit, rootState }) {
    if (
      !getters.isPicking ||
      !getters.isConnected ||
      state.answerStatus === "sending"
    ) {
      return;
    }
    // the storyteller may have removed a seat in the meantime
    const names = rootState.players.players.map(({ name }) => name);
    const picked = state.picked.filter((name) => names.includes(name));
    commit("setPicked", picked);
    if (picked.length !== getters.seatsToPick) return;
    const { id } = getters.shownMessage;
    commit("setAnswerStatus", "sending");
    this.$chat.answerCard(id, picked);
    clearTimeout(answerTimer);
    answerTimer = setTimeout(() => {
      const { shownCard, answerStatus } = state;
      if (answerStatus === "sending" && shownCard && shownCard.id === id) {
        commit("setAnswerStatus", "failed");
      }
    }, ANSWER_TIMEOUT);
  },
  /** Player: close an info card, telling the storyteller we saw it. */
  closeCard({ getters, commit, rootGetters }) {
    const message = getters.shownMessage;
    commit("hideCard");
    if (
      message &&
      !message.seen &&
      message.from === STORYTELLER &&
      rootGetters["voice/selfPeerId"] !== STORYTELLER
    ) {
      this.$chat.markSeen(message.id);
    }
  },
  /** Storyteller only: empty the chat for everyone. */
  clear({ rootGetters }) {
    if (rootGetters["voice/selfPeerId"] !== STORYTELLER) return;
    this.$chat.clear();
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
