import ChatClient from "../chat/ChatClient";
import { PLACE_TAB, dmTab, tabOf } from "./modules/chat";
import { STORYTELLER } from "./modules/voice";
import { playChime } from "../voice/sounds";
import { flagTitle, vibrate } from "../alerts";
import i18n from "../i18n";

const ERROR_TIMEOUT = 4 * 1000;

/**
 * Store plugin connecting the text chat to Vuex. Everyone in a live session
 * is connected to its chat (no microphone needed).
 */
export default (store) => {
  const serverUrl = process.env.VUE_APP_VOICE_URL || "";
  const selfPeerId = () => store.getters["voice/selfPeerId"];
  const isStoryteller = () => selfPeerId() === STORYTELLER;
  let errorTimer = null;

  const client = new ChatClient({
    serverUrl,
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
    onSeen: (id, seen) => store.commit("chat/setSeen", { id, seen }),
    onError: (reason) => {
      store.commit("chat/setError", reason);
      clearTimeout(errorTimer);
      errorTimer = setTimeout(
        () => store.commit("chat/setError", ""),
        ERROR_TIMEOUT,
      );
    },
  });
  store.$chat = client;

  // connect to the chat of the current live session, as ourselves
  let syncTimer = null;
  const sync = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
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

  store.subscribe(({ type }) => {
    switch (type) {
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
