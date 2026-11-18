/**
 * Storyteller: when each night began and ended, and whom the grimoire was
 * shown to, for the night summary (NightSummaryModal). What was sent and
 * answered comes from the private chats; this only marks the nights.
 *
 * nights: [{ night, start, end (null while it lasts), grimoire: { playerId:
 * "sent" | "seen" } }], oldest first. Filled by the store/nightLog.js plugin
 * and saved with the hosted game (store/persistence.js).
 */
const state = () => ({
  nights: [],
});

const last = (state) => state.nights[state.nights.length - 1];

const mutations = {
  set(state, nights) {
    state.nights = Array.isArray(nights) ? nights : [];
  },
  start(state, { night, at }) {
    state.nights = [
      ...state.nights,
      { night, start: at, end: null, grimoire: {} },
    ];
  },
  /** The night count changed during the night (it goes up after nightfall). */
  number(state, night) {
    const current = last(state);
    if (current && current.end === null) current.night = night;
  },
  end(state, at) {
    const current = last(state);
    if (current && current.end === null) current.end = at;
  },
  grimoire(state, { playerId, status }) {
    const current = last(state);
    if (!current || current.end !== null) return;
    current.grimoire = { ...current.grimoire, [playerId]: status };
  },
};

export default {
  namespaced: true,
  state,
  mutations,
};
