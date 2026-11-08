/**
 * Text chat state. The connection lives in src/chat/ChatClient.js, created by
 * the chat store plugin (src/store/chat.js) and reachable as this.$chat.
 *
 * Messages arrive with a channel: the place they were written in (plaza,
 * a room or a private conversation) or "dm:<playerId>", the private channel
 * between a player and the storyteller. The panel shows them in tabs:
 * "place" (everything said around us) and one tab per private channel.
 */
import { STORYTELLER } from "./voice";

export const PLACE_TAB = "place";
export const dmTab = (playerId) => "dm:" + playerId;
export const tabOf = (message) =>
  message.channel.startsWith("dm:") ? message.channel : PLACE_TAB;

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
  // storyteller: player ID we are writing an info card for
  composingFor: null,
  // storyteller: card ticks only show for cards sent after this (each
  // nightfall and dawn starts afresh)
  cardsSince: 0,
});

const getters = {
  isConnected: (state) => state.status === "connected",
  messagesOf: (state) => (tab) =>
    state.messages.filter((message) => tabOf(message) === tab),
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
   * "sent" (not seen yet), "seen" or null (none).
   */
  cardStatusOf: (state) => (playerId) => {
    const channel = dmTab(playerId);
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const message = state.messages[i];
      if (message.at < state.cardsSince) return null;
      if (message.channel === channel && message.card) {
        return message.seen ? "seen" : "sent";
      }
    }
    return null;
  },
  totalUnread: (state) =>
    Object.values(state.unread).reduce((total, count) => total + count, 0),
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
    if (unread) {
      const tab = tabOf(message);
      state.unread = { ...state.unread, [tab]: (state.unread[tab] || 0) + 1 };
    }
  },
  setSeen(state, { id, seen }) {
    state.messages = state.messages.map((message) =>
      message.id === id ? { ...message, seen } : message,
    );
  },
  resetCardStatus(state) {
    state.cardsSince = Date.now();
  },
  clear(state) {
    state.messages = [];
    state.unread = {};
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
  },
  hideCard(state) {
    state.shownCard = null;
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
  /** Player: close an info card, telling the storyteller we saw it. */
  closeCard({ state, commit, rootGetters }) {
    const message = state.shownCard;
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
