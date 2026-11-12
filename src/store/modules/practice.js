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

export const pickAtRandom = (list) =>
  list[Math.floor(Math.random() * list.length)];

/**
 * Who can nominate (alive, hasn't nominated today) and who can be nominated
 * (not nominated today), as seat indexes.
 */
const nominationOptions = (players) => {
  const seats = players.map((player, index) => ({ player, index }));
  return {
    nominators: seats.filter(
      ({ player }) => !player.isDead && !player.hasNominated,
    ),
    nominees: seats.filter(({ player }) => !player.wasNominated),
  };
};

const state = () => ({
  active: false,
  // the made-up players answer by themselves, at random
  auto: false,
  // what the made-up players received and haven't closed yet, oldest first:
  // { id, playerId, kind: "card" | "grimoire", messageId }
  inbox: [],
});

const getters = {
  current: (state) => state.inbox[0] || null,
  // a random nomination can be made: by day, no nomination going on, and
  // someone left who can nominate someone else
  canNominate: (state, getters, rootState) => {
    const { session, grimoire, players } = rootState;
    if (!state.active || grimoire.isNight || session.gameOver) return false;
    if (session.nomination) return false;
    const { nominators, nominees } = nominationOptions(players.players);
    return nominators.some(({ index }) =>
      nominees.some((nominee) => nominee.index !== index),
    );
  },
};

const mutations = {
  setActive(state, active) {
    state.active = active;
    if (!active) {
      state.inbox = [];
      state.auto = false;
    }
  },
  setAuto(state, auto) {
    state.auto = auto;
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
  /** A made-up player nominates another, both picked at random. */
  randomNomination({ getters, dispatch, rootState }) {
    if (!getters.canNominate) return;
    const { nominators, nominees } = nominationOptions(
      rootState.players.players,
    );
    const from = pickAtRandom(
      nominators.filter(({ index }) =>
        nominees.some((nominee) => nominee.index !== index),
      ),
    ).index;
    const to = pickAtRandom(
      nominees.filter(({ index }) => index !== from),
    ).index;
    dispatch("session/nominate", [from, to], { root: true });
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
