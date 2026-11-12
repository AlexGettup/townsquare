/**
 * Practice game: the storyteller rehearses alone, with made-up players and no
 * live session. What would reach a player (an info card, the grimoire shown
 * to them) pops up for the storyteller instead, as "What Ana sees", and the
 * storyteller answers for them. See src/store/practice.js and
 * src/chat/PracticeChat.js.
 */

import { STORYTELLER } from "./voice";
import { dmTab } from "./chat";

// made-up players get IDs like these, so cards and the grimoire can go to them
export const PRACTICE_ID = "practice-";
export const isPracticeId = (id) => !!id && id.startsWith(PRACTICE_ID);

let nextItem = 1;

/**
 * "View as a player": the storyteller sees and acts as one made-up player
 * would on their own device. The grimoire is put away meanwhile (only that
 * player's character stays, and travellers, which are public) and comes
 * back as it was. Kept here with the role objects, and in localStorage by
 * IDs in case the page reloads while viewing.
 */
const VIEW_KEY = "practiceView";
let savedView = null;

const roleById = (rootState, rootGetters, id) =>
  (id &&
    (rootState.roles.get(id) ||
      rootState.otherTravellers.get(id) ||
      rootGetters.rolesJSONbyId.get(id))) ||
  {};

/** Put the grimoire back as it was before viewing as a player. */
export const restoreView = ({ commit, rootState, rootGetters }, view) => {
  const { players } = rootState.players;
  view.players.forEach((saved) => {
    const player = players.find(({ id }) => id === saved.id);
    if (!player) return;
    const role = saved.role || roleById(rootState, rootGetters, saved.roleId);
    [
      ["role", role],
      ["reminders", saved.reminders],
      ["alignmentIndex", saved.alignmentIndex],
    ].forEach(([property, value]) =>
      commit("players/update", { player, property, value }, { root: true }),
    );
  });
  view.bluffs.forEach((bluff, index) => {
    const role =
      typeof bluff === "string"
        ? roleById(rootState, rootGetters, bluff)
        : bluff;
    commit("setBluff", { index, role }, { root: true });
  });
  commit("session/setPlayerId", view.self || "", { root: true });
};

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
  // player ID the storyteller is viewing the game as, or null
  viewAs: null,
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
  setViewAs(state, playerId) {
    state.viewAs = playerId;
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
  /**
   * Storyteller: see the game as this made-up player sees it, and act for
   * them (answer cards by tapping seats, quick answers, the chat). What
   * they had received and not closed yet comes up on their screen.
   */
  viewAs({ state, commit, rootState, rootGetters }, playerId) {
    if (!state.active || state.viewAs || rootState.session.isSpectator) return;
    const { players } = rootState.players;
    if (!players.some(({ id }) => id === playerId)) return;
    const items = state.inbox.filter((item) => item.playerId === playerId);
    const grimoire = items.some(({ kind }) => kind === "grimoire")
      ? rootGetters["session/grimoireSnapshot"]
      : null;
    savedView = {
      playerId,
      self: rootState.session.playerId,
      players: players.map(({ id, role, reminders, alignmentIndex }) => ({
        id,
        role,
        roleId: (role && role.id) || "",
        reminders: reminders.map((reminder) => ({ ...reminder })),
        alignmentIndex,
      })),
      bluffs: [...rootState.bluffs],
    };
    try {
      localStorage.setItem(
        VIEW_KEY,
        JSON.stringify({
          ...savedView,
          players: savedView.players.map((saved) => ({
            ...saved,
            role: undefined,
          })),
          bluffs: savedView.bluffs.map((role) => (role && role.id) || ""),
        }),
      );
    } catch (e) {
      // the view still works; a reload would lose the hidden grimoire
    }
    commit("setViewAs", playerId);
    items.forEach(({ id }) => commit("close", id));
    commit("chat/composeCard", null, { root: true });
    commit("session/setEditingGrimoire", null, { root: true });
    commit("toggleModal", undefined, { root: true });
    // the grimoire as the player has it
    players.forEach((player) => {
      const keep =
        player.id === playerId ||
        (player.role && player.role.team === "traveller");
      [
        ["role", keep ? player.role : {}],
        ["reminders", []],
        ["alignmentIndex", 0],
      ].forEach(([property, value]) =>
        commit("players/update", { player, property, value }, { root: true }),
      );
    });
    commit("setBluff", undefined, { root: true });
    commit("session/setPlayerId", playerId, { root: true });
    commit("session/setSpectator", true, { root: true });
    commit("chat/setTab", dmTab(playerId), { root: true });
    if (grimoire) commit("session/setShownGrimoire", grimoire, { root: true });
    // their latest card not closed yet pops up
    const unseen = rootState.chat.messages.filter(
      (message) =>
        message.channel === dmTab(playerId) &&
        message.from === STORYTELLER &&
        message.card &&
        !message.seen &&
        !message.choice,
    );
    if (unseen.length) {
      commit("chat/showCard", unseen[unseen.length - 1], { root: true });
    }
  },
  /** Back to the storyteller's grimoire, as it was. */
  leaveView({ state, commit, rootState, rootGetters }) {
    const playerId = state.viewAs;
    if (!playerId) return;
    let view = savedView;
    if (!view) {
      try {
        view = JSON.parse(localStorage.getItem(VIEW_KEY));
      } catch (e) {
        view = null;
      }
    }
    const isGrimoireOpen = !!rootState.session.shownGrimoire;
    commit("chat/hideCard", null, { root: true });
    commit("session/setShownGrimoire", null, { root: true });
    commit("session/setSpectator", false, { root: true });
    if (view) restoreView({ commit, rootState, rootGetters }, view);
    else commit("session/setPlayerId", "", { root: true });
    // what they didn't close goes back to "What Ana sees"
    if (isGrimoireOpen) {
      commit("receive", { playerId, kind: "grimoire" });
    } else if (rootState.session.grimoireViews[playerId] === "sent") {
      commit(
        "session/setGrimoireView",
        { playerId, status: "seen" },
        { root: true },
      );
    }
    rootState.chat.messages.forEach((message) => {
      if (
        message.channel === dmTab(playerId) &&
        message.from === STORYTELLER &&
        message.card &&
        !message.seen &&
        !message.choice
      ) {
        commit("receive", { playerId, kind: "card", messageId: message.id });
      }
    });
    commit("setViewAs", null);
    savedView = null;
    try {
      localStorage.removeItem(VIEW_KEY);
    } catch (e) {
      // nothing to forget
    }
  },
  /** Leave the practice game: back to the first screen. */
  stop({ commit, dispatch, rootState }) {
    dispatch("leaveView");
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
