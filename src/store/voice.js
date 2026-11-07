import VoiceClient from "../voice/VoiceClient";

/**
 * Store plugin connecting the voice chat client to Vuex.
 * The client is exposed to the voice module's actions as store.$voice.
 */
export default (store) => {
  const client = new VoiceClient({
    serverUrl: process.env.VUE_APP_VOICE_URL || "",
    onStatus: (status, error) =>
      store.commit("voice/setStatus", { status, error }),
    onPeers: (peers) => store.commit("voice/setPeers", peers),
    onSpeaking: (peerId, speaking) =>
      store.commit("voice/setSpeaking", { peerId, speaking }),
    onForceMute: () => {
      if (!store.state.voice.muted) store.dispatch("voice/toggleMute");
    },
  });
  store.$voice = client;

  store.subscribe(({ type }) => {
    switch (type) {
      // leaving (or switching) the live session also leaves its voice room
      case "session/setSessionId":
      case "session/setSpectator":
        if (client.isActive) {
          store.dispatch("voice/leave");
        }
        break;
      case "voice/setStatus":
        if (store.state.voice.status !== "connected") {
          store.commit("voice/clearSpeaking");
        }
        break;
    }
  });
};
