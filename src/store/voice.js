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

  // silence locally whoever we must not hear (night rules)
  const applyAudibility = () => {
    const canHear = store.getters["voice/canHear"];
    Object.keys(store.state.voice.peers).forEach((peerId) => {
      client.setAudible(peerId, canHear(peerId));
    });
  };

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
        } else if (store.getters["voice/isStoryteller"]) {
          // share the current night state with whoever is in the room
          const { awake, broadcast } = store.state.voice;
          client.setNight({ awake, broadcast });
        }
        applyAudibility();
        break;
      case "toggleNight":
        // dawn: everyone goes back to sleep for the next night
        if (
          !store.state.grimoire.isNight &&
          store.getters["voice/isStoryteller"] &&
          (store.state.voice.awake.length || store.state.voice.broadcast)
        ) {
          store.dispatch("voice/setNight", { awake: [], broadcast: false });
        }
        applyAudibility();
        break;
      case "voice/setPeers":
      case "voice/setNight":
        applyAudibility();
        break;
    }
  });
};
