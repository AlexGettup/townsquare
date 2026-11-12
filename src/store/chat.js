import ChatClient from "../chat/ChatClient";
import PracticeChat from "../chat/PracticeChat";
import { PLACE_TAB, dmTab, tabOf } from "./modules/chat";
import { STORYTELLER } from "./modules/voice";
import { playChime } from "../voice/sounds";
import { flagTitle, vibrate } from "../alerts";
import { POINTING } from "../cards";
import i18n from "../i18n";

const ERROR_TIMEOUT = 4 * 1000;

/**
 * Store plugin connecting the text chat to Vuex. Everyone in a live session
 * is connected to its chat (no microphone needed). A practice game uses a
 * stand-in on this device instead (PracticeChat): store.$chat is whichever
 * is in use.
 */
export default (store) => {
  const serverUrl = process.env.VUE_APP_VOICE_URL || "";
  const selfPeerId = () => store.getters["voice/selfPeerId"];
  const isStoryteller = () => selfPeerId() === STORYTELLER;
  let errorTimer = null;

  const callbacks = {
    onStatus: (status) => store.commit("chat/setStatus", status),
    onHistory: (messages) => store.commit("chat/setHistory", messages),
    onMessage: (message) => {
      const { isOpen, tab } = store.state.chat;
      const fromOthers = message.from !== selfPeerId();
      const unread = fromOthers && (!isOpen || tab !== tabOf(message));
      store.commit("chat/addMessage", { message, unread });
      // an info card from the storyteller pops up on screen
      if (fromOthers && message.card) {
        store.commit("chat/showCard", message);
        vibrate([200, 100, 200]);
        flagTitle(i18n.t("alerts.newInfo", store.state.grimoire.locale));
      }
      // private messages ring, unless sounds are muted
      if (
        fromOthers &&
        tabOf(message) !== PLACE_TAB &&
        !store.state.grimoire.isMuted
      ) {
        playChime();
      }
    },
    onCleared: () => store.commit("chat/clear"),
    onSeen: (id, seen) => store.commit("chat/updateMessage", { id, seen }),
    onChoice: (id, choice) => {
      store.commit("chat/updateMessage", { id, choice });
      if (!isStoryteller()) {
        // the server has our answer: the square goes back to normal
        const { shownCard } = store.state.chat;
        if (shownCard && shownCard.id === id) store.dispatch("chat/closeCard");
        return;
      }
      // the storyteller is told like a private message
      const message = store.state.chat.messages.find((m) => m.id === id);
      const { isOpen, tab } = store.state.chat;
      if (message && (!isOpen || tab !== message.channel)) {
        store.commit("chat/addUnread", message.channel);
      }
      if (!store.state.grimoire.isMuted) playChime();
    },
    onError: (reason) => {
      store.commit("chat/setError", reason);
      clearTimeout(errorTimer);
      errorTimer = setTimeout(
        () => store.commit("chat/setError", ""),
        ERROR_TIMEOUT,
      );
    },
  };
  const client = new ChatClient({ serverUrl, ...callbacks });
  const practice = new PracticeChat({
    ...callbacks,
    selfPeerId,
    // a made-up player got an info card: the storyteller sees it for them
    onDelivered: (message) =>
      store.commit("practice/receive", {
        playerId: message.channel.slice("dm:".length),
        kind: "card",
        messageId: message.id,
      }),
  });
  store.$chat = client;

  // connect to the chat of the current live session, as ourselves
  let syncTimer = null;
  const sync = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (store.state.practice.active) {
        client.disconnect();
        store.$chat = practice;
        practice.connect();
        return;
      }
      practice.disconnect();
      store.$chat = client;
      const { sessionId } = store.state.session;
      // a player gets their ID a moment after joining: wait for it
      if (!serverUrl || !sessionId || !selfPeerId()) {
        client.disconnect();
        store.commit("chat/clear");
        return;
      }
      const peerId = selfPeerId();
      if (
        client.target &&
        (client.target.channel !== sessionId || client.target.peerId !== peerId)
      ) {
        store.commit("chat/clear");
      }
      client.night = isStoryteller() ? store.state.grimoire.isNight : null;
      client.connect(sessionId, peerId);
      if (!isStoryteller() && store.state.chat.tab !== PLACE_TAB) {
        store.commit("chat/setTab", dmTab(peerId));
      }
    });
  };
  sync();

  store.subscribe(({ type, payload }) => {
    switch (type) {
      // characters really dealt (a mock assignment doesn't come through here)
      case "session/distributeRoles":
        if (payload) store.dispatch("chat/sendRoleCards");
        break;
      // the pointing vote was revealed or is over: its card needs nothing
      case "session/setPointing": {
        const shown = store.getters["chat/shownMessage"];
        if (
          (!payload || payload.pairs) &&
          shown &&
          shown.card &&
          shown.card.phrase === POINTING
        ) {
          store.commit("chat/hideCard");
        }
        break;
      }
      case "practice/setActive":
        // each practice game starts with an empty chat
        practice.messages = [];
        practice.disconnect();
        sync();
        break;
      case "session/setSessionId":
      case "session/setSpectator":
      case "session/setPlayerId":
        sync();
        break;
      case "toggleNight":
        if (isStoryteller()) {
          client.setNight(store.state.grimoire.isNight);
          store.commit("chat/resetCardStatus");
        } else if (store.state.grimoire.isNight) {
          // at night players can only write to the storyteller
          store.commit("chat/setTab", dmTab(selfPeerId()));
        }
        break;
    }
  });
};
