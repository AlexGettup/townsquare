/**
 * Voice chat state. The WebRTC work happens in src/voice/VoiceClient.js,
 * created by the voice store plugin (src/store/voice.js) and reachable from
 * the actions as this.$voice.
 *
 * Who hears whom:
 * - Day: everyone hears everyone.
 * - Night: players are isolated. The storyteller wakes players up and only
 *   hears those; awake players only hear the storyteller (not each other).
 *   With "broadcast" on, every player hears the storyteller.
 */
const STORYTELLER = "host";

const state = () => ({
  // voice server configured for this build (VUE_APP_VOICE_URL)
  isAvailable: !!process.env.VUE_APP_VOICE_URL,
  status: "off", // off | connecting | connected | error
  error: "",
  muted: false,
  // peerId -> { muted, awake, broadcast } for everyone else in the room
  // (awake / broadcast are only set on the storyteller's entry)
  peers: {},
  // peerId -> true while that person is talking (includes ourselves)
  speaking: {},
  // storyteller only, the source of the night state shared with players
  awake: [],
  broadcast: false,
});

const getters = {
  isConnected: (state) => state.status === "connected",
  // the storyteller is "host", players use their seat's player ID
  selfPeerId: (state, getters, rootState) =>
    rootState.session.isSpectator ? rootState.session.playerId : STORYTELLER,
  isStoryteller: (state, getters) => getters.selfPeerId === STORYTELLER,
  // night state: our own as storyteller, otherwise the storyteller's
  night: (state, getters) => {
    if (getters.isStoryteller) {
      return { awake: state.awake, broadcast: state.broadcast };
    }
    const storyteller = state.peers[STORYTELLER];
    return storyteller
      ? { awake: storyteller.awake, broadcast: storyteller.broadcast }
      : { awake: [], broadcast: false };
  },
  isAwake: (state, getters) => (peerId) => getters.night.awake.includes(peerId),
  /** Can we hear this peer right now? */
  canHear: (state, getters, rootState) => (peerId) => {
    if (!rootState.grimoire.isNight) return true;
    if (getters.isStoryteller) return getters.isAwake(peerId);
    if (peerId !== STORYTELLER) return false;
    return getters.night.broadcast || getters.isAwake(getters.selfPeerId);
  },
  /**
   * Should we show that this peer is talking? The storyteller sees everyone;
   * players only see who they can hear, so the night stays secret.
   */
  showSpeaking: (state, getters) => (peerId) =>
    getters.isStoryteller ||
    peerId === getters.selfPeerId ||
    getters.canHear(peerId),
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
      peers.map(({ peerId, muted, awake, broadcast }) => [
        peerId,
        { muted, awake: awake || [], broadcast: !!broadcast },
      ]),
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
  setNight(state, { awake, broadcast }) {
    state.awake = awake;
    state.broadcast = broadcast;
  },
};

const actions = {
  /** Join the voice room of the current live session (needs a user click). */
  join({ rootState, getters, state }) {
    const { session } = rootState;
    if (!state.isAvailable || !session.sessionId) return;
    return this.$voice.join({
      channel: session.sessionId,
      peerId: getters.selfPeerId,
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
  mutePeer({ getters }, peerId) {
    if (!getters.isStoryteller) return;
    this.$voice.muteRemote(peerId);
  },
  /** Storyteller only: wake a player up at night, or put them back to sleep. */
  toggleAwake({ dispatch, getters, state }, peerId) {
    if (!getters.isStoryteller) return;
    const awake = state.awake.includes(peerId)
      ? state.awake.filter((id) => id !== peerId)
      : [...state.awake, peerId];
    dispatch("setNight", { awake, broadcast: state.broadcast });
  },
  /** Storyteller only: talk to every player at night. */
  toggleBroadcast({ dispatch, getters, state }) {
    if (!getters.isStoryteller) return;
    dispatch("setNight", { awake: state.awake, broadcast: !state.broadcast });
  },
  setNight({ commit, state }, night) {
    commit("setNight", night);
    this.$voice.setNight({ awake: state.awake, broadcast: state.broadcast });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
