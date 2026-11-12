/**
 * The player's diary: what happened in the game as seen from this device, to
 * read it back night by night and day by day (components/modals/DiaryModal).
 * The cards and private messages come from the chat; this keeps what the chat
 * doesn't: when each night and day began, deaths, the grimoire being shown to
 * you, and the votes (players lose the vote history on a reload). Saved on
 * this device, one diary per game session (store/diary.js).
 */

// a death undone this soon was a slip of the storyteller's finger
export const UNDO_WINDOW = 30 * 1000;
// a phase changed again this soon was still being set
const PHASE_SETTLE = 2 * 1000;

const state = () => ({
  // { at, night, isNight }: night is the day and night count
  phases: [],
  // { at, kind: "death" | "revive" | "grimoire", name }
  events: [],
  // { at, nominator, nominee, type: "Execution" | "Exile", count, majority,
  // votes: [names] }, as in the vote history
  votes: [],
});

const getters = {
  isEmpty: (state) =>
    !state.phases.length && !state.events.length && !state.votes.length,
};

const mutations = {
  load(state, diary) {
    state.phases = (diary && diary.phases) || [];
    state.events = (diary && diary.events) || [];
    state.votes = (diary && diary.votes) || [];
  },
  clear(state) {
    state.phases = [];
    state.events = [];
    state.votes = [];
  },
  /** A new night or day (or its count corrected), unless it's the same. */
  addPhase(state, { at, night, isNight }) {
    const same = (phase) =>
      phase && phase.night === night && phase.isNight === isNight;
    let phases = state.phases;
    // a reload starts at setup until the game syncs: not a new phase
    if (!night && !isNight && phases.some((phase) => phase.night > 0)) return;
    // nightfall comes in two steps (night, then its count): one phase
    const last = phases[phases.length - 1];
    if (last && !same(last) && at - last.at < PHASE_SETTLE) {
      phases = phases.slice(0, -1);
    }
    if (same(phases[phases.length - 1])) {
      state.phases = phases;
      return;
    }
    const at0 = phases.length < state.phases.length ? last.at : at;
    state.phases = [...phases, { at: at0, night, isNight }];
  },
  addEvent(state, event) {
    // dead and back again at once: neither happened
    const opposite = { death: "revive", revive: "death" }[event.kind];
    const last = state.events[state.events.length - 1];
    if (
      opposite &&
      last &&
      last.kind === opposite &&
      last.name === event.name &&
      event.at - last.at < UNDO_WINDOW
    ) {
      state.events = state.events.slice(0, -1);
      return;
    }
    state.events = [...state.events, event];
  },
  addVote(state, vote) {
    state.votes = [...state.votes, vote];
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
};
