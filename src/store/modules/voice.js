/**
 * Voice chat state. The WebRTC work happens in src/voice/VoiceClient.js,
 * created by the voice store plugin (src/store/voice.js) and reachable from
 * the actions as this.$voice.
 */
const state = () => ({
  // voice server configured for this build (VUE_APP_VOICE_URL)
  isAvailable: !!process.env.VUE_APP_VOICE_URL,
  status: "off", // off | connecting | connected | error
  error: "",
  muted: false,
  // peerId -> { muted } for everyone else in the voice room
  peers: {},
  // peerId -> true while that person is talking (includes ourselves)
  speaking: {},
});

const getters = {
  isConnected: (state) => state.status === "connected",
};

const mutations = {
  setStatus(state, { status, error = "" }) {
    state.status = status;
    state.error = error;
  },
  setMuted(state, muted) {
    state.muted = muted;
  },
  setPeers(state, peers) {
    state.peers = Object.fromEntries(
      peers.map(({ peerId, muted }) => [peerId, { muted }]),
    );
  },
  setSpeaking(state, { peerId, speaking }) {
    if (speaking) {
      state.speaking = { ...state.speaking, [peerId]: true };
    } else if (state.speaking[peerId]) {
      const rest = { ...state.speaking };
      delete rest[peerId];
      state.speaking = rest;
    }
  },
  clearSpeaking(state) {
    state.speaking = {};
  },
};

const actions = {
  /** Join the voice room of the current live session (needs a user click). */
  join({ rootState, rootGetters, state }) {
    const { session } = rootState;
    if (!state.isAvailable || !session.sessionId) return;
    return this.$voice.join({
      channel: session.sessionId,
      peerId: rootGetters["voice/selfPeerId"],
      muted: state.muted,
    });
  },
  leave() {
    return this.$voice.leave();
  },
  toggleMute({ commit, state }) {
    commit("setMuted", !state.muted);
    this.$voice.setMuted(state.muted);
  },
  /** Storyteller only: mute another player's microphone. */
  mutePeer({ rootState }, peerId) {
    if (rootState.session.isSpectator) return;
    this.$voice.muteRemote(peerId);
  },
};

export default {
  namespaced: true,
  state,
  getters: {
    ...getters,
    // the storyteller is "host", players use their seat's player ID
    selfPeerId: (state, getters, rootState) =>
      rootState.session.isSpectator ? rootState.session.playerId : "host",
  },
  mutations,
  actions,
};
