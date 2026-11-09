/**
 * What you noted about each player. Only yours: it lives apart from the players,
 * which are shared with the session, and stays on this device (store/notes.js).
 * By name, as seats can move during a game.
 */
const state = () => ({
  // player name -> text
  notes: {},
});

const getters = {
  noteOf: (state) => (name) =>
    Object.prototype.hasOwnProperty.call(state.notes, name)
      ? state.notes[name]
      : "",
  hasNotes: (state) => Object.keys(state.notes).length > 0,
};

const mutations = {
  set(state, { name, text }) {
    const notes = { ...state.notes };
    if (text.trim()) notes[name] = text;
    else delete notes[name];
    state.notes = notes;
  },
  rename(state, { from, to }) {
    const notes = { ...state.notes, [to]: state.notes[from] };
    delete notes[from];
    state.notes = notes;
  },
  load(state, notes) {
    state.notes = notes;
  },
  clear(state) {
    state.notes = {};
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
};
