/**
 * Practice game: the storyteller rehearses alone, with made-up players and no
 * live session. What would reach a player (an info card, the grimoire shown
 * to them) pops up for the storyteller instead, as "What Ana sees", and the
 * storyteller answers for them. See src/store/practice.js and
 * src/chat/PracticeChat.js.
 */

// made-up players get IDs like these, so cards and the grimoire can go to them
export const PRACTICE_ID = "practice-";
export const isPracticeId = (id) => !!id && id.startsWith(PRACTICE_ID);

let nextItem = 1;

const state = () => ({
  active: false,
  // what the made-up players received and haven't closed yet, oldest first:
  // { id, playerId, kind: "card" | "grimoire", messageId }
  inbox: [],
});

const getters = {
  current: (state) => state.inbox[0] || null,
};

const mutations = {
  setActive(state, active) {
    state.active = active;
    if (!active) state.inbox = [];
  },
  receive(state, item) {
    state.inbox = [...state.inbox, { id: nextItem++, ...item }];
  },
  close(state, id) {
    state.inbox = state.inbox.filter((item) => item.id !== id);
  },
  // drop what matches, e.g. { kind: "grimoire" } at dawn
  dropAll(state, filter = {}) {
    state.inbox = state.inbox.filter((item) =>
      Object.keys(filter).some((key) => item[key] !== filter[key]),
    );
  },
};

const actions = {
  /** Start a practice game with this many made-up players. */
  start({ commit, rootState }, { count, names }) {
    commit("session/setSessionId", "", { root: true });
    commit("session/setSpectator", false, { root: true });
    commit("session/clearVoteHistory", null, { root: true });
    commit("session/setGameOver", null, { root: true });
    commit("session/setGrimoireView", null, { root: true });
    commit("chat/clear", null, { root: true });
    commit("players/clear", null, { root: true });
    for (let n = 1; n <= count; n++) {
      commit("players/add", names[n - 1] || `${n}`, { root: true });
    }
    rootState.players.players.forEach((player, index) => {
      commit(
        "players/update",
        { player, property: "id", value: PRACTICE_ID + (index + 1) },
        { root: true },
      );
      commit(
        "players/update",
        { player, property: "connected", value: true },
        { root: true },
      );
    });
    commit("setActive", true);
  },
  /** Leave the practice game: back to the first screen. */
  stop({ commit, rootState }) {
    if (rootState.session.nomination) {
      commit("session/nomination", undefined, { root: true });
    }
    commit("setActive", false);
    commit("session/setGameOver", null, { root: true });
    commit("session/setGrimoireView", null, { root: true });
    commit("session/clearVoteHistory", null, { root: true });
    commit("chat/clear", null, { root: true });
    commit("players/clear", null, { root: true });
    commit("setBluff", undefined, { root: true });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
