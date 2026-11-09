/**
 * Voice chat state. The WebRTC work happens in src/voice/VoiceClient.js,
 * created by the voice store plugin (src/store/voice.js) and reachable from
 * the actions as this.$voice.
 *
 * Who hears whom:
 * - Day: you hear whoever is in the same place as you: the plaza, a fixed
 *   room (tavern, church, graveyard) or a private conversation. The voice
 *   server decides who may enter a private conversation.
 * - Night: players are isolated. The storyteller wakes players up and only
 *   hears those; awake players only hear the storyteller (not each other).
 *   With "broadcast" on, every player hears the storyteller.
 */
export const STORYTELLER = "host";
export const PLAZA = "plaza";
export const FIXED_ROOMS = ["tavern", "church", "graveyard"];
export const isConversation = (location) =>
  typeof location === "string" && location.startsWith("conv-");

let nextNoticeId = 1;

const state = () => ({
  // voice server configured for this build (VUE_APP_VOICE_URL)
  isAvailable: !!process.env.VUE_APP_VOICE_URL,
  status: "off", // off | connecting | connected | error
  error: "",
  muted: false,
  // peerId -> { muted, location, requesting, awake, broadcast } for everyone
  // else in the room (awake / broadcast are only set on the storyteller)
  peers: {},
  // where we are, and which private conversation we asked to join
  location: PLAZA,
  requesting: null,
  // peerId -> true while that person is talking (includes ourselves)
  speaking: {},
  // storyteller only, the source of the night state shared with players
  awake: [],
  broadcast: false,
  // peerId -> how loud we play them, for those not at 1 (saved on this device)
  volumes: {},
  // the devices chosen, "" is the system's default (saved on this device)
  inputId: "",
  outputId: "",
  // noise suppression (RNNoise) and voice gate, like Discord. Per device
  processing: { denoise: true, auto: true, threshold: -50 },
  // invitations received: [{ from, at }]
  invitations: [],
  // short messages ("X declined your invitation"): [{ id, key, peerId }]
  notices: [],
});

const getters = {
  isConnected: (state) => state.status === "connected",
  // the storyteller is "host", players use their seat's player ID
  selfPeerId: (state, getters, rootState) =>
    rootState.session.isSpectator ? rootState.session.playerId : STORYTELLER,
  isStoryteller: (state, getters) => getters.selfPeerId === STORYTELLER,
  locationOf: (state, getters) => (peerId) => {
    if (peerId === getters.selfPeerId) return state.location;
    return state.peers[peerId] ? state.peers[peerId].location : null;
  },
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
  volumeOf: (state) => (peerId) =>
    state.volumes[peerId] === undefined ? 1 : state.volumes[peerId],
  /** Can we hear this peer right now? */
  canHear: (state, getters, rootState) => (peerId) => {
    if (!rootState.grimoire.isNight) {
      return getters.locationOf(peerId) === state.location;
    }
    if (getters.isStoryteller) return getters.isAwake(peerId);
    if (peerId !== STORYTELLER) return false;
    return getters.night.broadcast || getters.isAwake(getters.selfPeerId);
  },
  /**
   * Should we show that this peer is talking? The storyteller sees everyone;
   * players only see who they can hear.
   */
  showSpeaking: (state, getters) => (peerId) =>
    getters.isStoryteller ||
    peerId === getters.selfPeerId ||
    getters.canHear(peerId),
  /**
   * Everyone in voice grouped by place:
   * { [location]: [peerId, …] }, ourselves included.
   */
  places: (state, getters) => {
    const places = {};
    const add = (peerId, location) => {
      (places[location] = places[location] || []).push(peerId);
    };
    add(getters.selfPeerId, state.location);
    Object.entries(state.peers).forEach(([peerId, { location }]) =>
      add(peerId, location),
    );
    return places;
  },
  // private conversations currently open, in a stable order
  conversations: (state, getters) =>
    Object.keys(getters.places)
      .filter(isConversation)
      .sort()
      .map((location) => ({ location, members: getters.places[location] })),
  // join requests for the conversation we are in
  joinRequests: (state) =>
    isConversation(state.location)
      ? Object.entries(state.peers)
          .filter(([, peer]) => peer.requesting === state.location)
          .map(([peerId]) => peerId)
      : [],
  // invitations that still make sense (the inviter is around, and we aren't
  // already talking with them)
  pendingInvitations: (state, getters) =>
    state.invitations.filter(
      ({ from }) =>
        state.peers[from] &&
        !(
          isConversation(state.location) &&
          getters.locationOf(from) === state.location
        ),
    ),
};

const mutations = {
  setStatus(state, { status, error = "" }) {
    state.status = status;
    state.error = error;
  },
  setMuted(state, muted) {
    state.muted = muted;
  },
  setPeers(state, { peers, self }) {
    state.peers = Object.fromEntries(
      peers.map(({ peerId, muted, awake, broadcast, location, requesting }) => [
        peerId,
        {
          muted,
          awake: awake || [],
          broadcast: !!broadcast,
          location: location || PLAZA,
          requesting: requesting || null,
        },
      ]),
    );
    state.location = self ? self.location : PLAZA;
    state.requesting = self ? self.requesting : null;
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
  setInputId(state, deviceId) {
    state.inputId = deviceId;
  },
  setOutputId(state, deviceId) {
    state.outputId = deviceId;
  },
  /** Change some of { denoise, auto, threshold }. */
  setProcessing(state, changes) {
    state.processing = { ...state.processing, ...changes };
  },
  setVolumes(state, volumes) {
    state.volumes = volumes;
  },
  setVolume(state, { peerId, volume }) {
    const volumes = { ...state.volumes, [peerId]: volume };
    if (volume === 1) delete volumes[peerId];
    state.volumes = volumes;
  },
  addInvitation(state, from) {
    state.invitations = [
      ...state.invitations.filter((invitation) => invitation.from !== from),
      { from, at: Date.now() },
    ];
  },
  removeInvitation(state, from) {
    state.invitations = state.invitations.filter(
      (invitation) => invitation.from !== from,
    );
  },
  clearInvitations(state) {
    state.invitations = [];
  },
  addNotice(state, notice) {
    state.notices = [...state.notices, { id: nextNoticeId++, ...notice }];
  },
  removeNotice(state, id) {
    state.notices = state.notices.filter((notice) => notice.id !== id);
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
  leave({ commit }) {
    commit("clearInvitations");
    return this.$voice.leave();
  },
  // both say if it worked, and otherwise leave things as they were
  async setInputDevice({ commit }, deviceId) {
    try {
      await this.$voice.setInputDevice(deviceId);
      commit("setInputId", deviceId);
      return true;
    } catch (error) {
      console.warn("Voice chat: can't use that microphone", error);
      commit("addNotice", { key: "voice.deviceFailed" });
      return false;
    }
  },
  async setOutputDevice({ commit, state }, deviceId) {
    const previousId = state.outputId;
    try {
      await this.$voice.setOutputDevice(deviceId);
      commit("setOutputId", deviceId);
      return true;
    } catch (error) {
      console.warn("Voice chat: can't use that speaker", error);
      this.$voice.setOutputDevice(previousId).catch(() => {});
      commit("addNotice", { key: "voice.deviceFailed" });
      return false;
    }
  },
  setProcessing({ commit, state }, changes) {
    commit("setProcessing", changes);
    this.$voice.setProcessing(state.processing);
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
  setNight({ commit, state, rootState }, night) {
    commit("setNight", night);
    this.$voice.setNight({
      awake: state.awake,
      broadcast: state.broadcast,
      isNight: rootState.grimoire.isNight,
    });
  },

  // --- private conversations and rooms --------------------------------------

  /** Invite someone to talk in private (or into our conversation). */
  invite(context, peerId) {
    this.$voice.send({ type: "invite", to: peerId });
  },
  acceptInvitation({ commit }, from) {
    commit("removeInvitation", from);
    this.$voice.send({ type: "accept-invite", from });
  },
  declineInvitation({ commit }, from) {
    commit("removeInvitation", from);
    this.$voice.send({ type: "decline-invite", from });
  },
  /** Ask the members of a private conversation to let us in. */
  requestToJoin(context, location) {
    this.$voice.send({ type: "request", location });
  },
  cancelRequest() {
    this.$voice.send({ type: "cancel-request" });
  },
  acceptRequest(context, from) {
    this.$voice.send({ type: "accept-request", from });
  },
  declineRequest(context, from) {
    this.$voice.send({ type: "decline-request", from });
  },
  /** Go to the plaza or a fixed room (the storyteller can go anywhere). */
  moveTo(context, location) {
    this.$voice.send({ type: "move", location });
  },
  /** Storyteller only: bring everyone back to the plaza. */
  gather({ getters }, { sound = true } = {}) {
    if (!getters.isStoryteller) return;
    this.$voice.send({ type: "gather", sound });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
