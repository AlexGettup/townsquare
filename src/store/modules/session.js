/**
 * Handle a vote request.
 * If the vote is from a seat that is already locked, ignore it.
 * @param state session state
 * @param index seat of the player in the circle
 * @param vote number of votes
 */
const handleVote = (state, [index, vote]) => {
  if (!state.nomination) return;
  state.votes = [...state.votes];
  state.votes[index] =
    vote === undefined ? Math.abs(state.votes[index] - 1) : vote;
};

const state = () => ({
  sessionId: "",
  isSpectator: false,
  isReconnecting: false,
  playerCount: 0,
  ping: 0,
  playerId: "",
  claimedSeat: -1,
  nomination: false,
  votes: [],
  lockedVote: 0,
  votingSpeed: 1000,
  allowSelfNaming: true,
  isVoteInProgress: false,
  voteHistory: [],
  markedPlayer: -1,
  isVoteHistoryAllowed: true,
  isVoteWatchingAllowed: true,
  isRolesDistributed: false,
  // ST: characters handed out to each player ID, so a player who was away
  // (phone in the background…) still gets theirs
  dealtRoles: {},
  // ST: this page load picked up a saved game (see store/persistence.js)
  isGameResumed: false,
  // the day timer everyone sees: { endsAt (this device's clock), duration }
  dayTimer: null,
  // the game ended: { winner: "good" | "evil", players: [{ roleId,
  // alignmentIndex, reminders }] by seat, bluffs: [roleId] }. Players see
  // this grimoire instead of their own until the storyteller deals again
  gameOver: null,
  // player: the storyteller's grimoire they were shown (Spy), same shape as
  // gameOver without the winner. Until they close it or day comes
  shownGrimoire: null,
  // ST: player ID -> "sent" | "seen", the grimoire shown to them tonight
  grimoireViews: {},
  messages: [],
});

const getters = {
  /** ST: the grimoire as it is now, as players get to see it. */
  grimoireSnapshot: (state, getters, rootState) => ({
    players: rootState.players.players.map(
      ({ role, alignmentIndex, reminders }) => ({
        roleId: (role && role.id) || "",
        alignmentIndex: alignmentIndex || 0,
        reminders: reminders.map((reminder) => ({ ...reminder })),
      }),
    ),
    bluffs: rootState.bluffs.map((role) => (role && role.id) || ""),
  }),
  /** Players: the grimoire to show instead of theirs, if any. */
  revealedGrimoire: (state) =>
    state.isSpectator ? state.gameOver || state.shownGrimoire : null,
};

const actions = {
  /**
   * Storyteller: end the game. Everyone sees the winner and the grimoire as it
   * is now, by day, back in the plaza.
   */
  endGame({ state, commit, dispatch, getters, rootState }, winner) {
    if (state.isSpectator) return;
    if (state.nomination) commit("nomination");
    if (state.dayTimer) commit("setDayTimer", null);
    if (rootState.grimoire.isNight)
      commit("toggleNight", false, { root: true });
    commit("setGameOver", { winner, ...getters.grimoireSnapshot });
    dispatch("voice/gather", { sound: false }, { root: true });
  },
};

// mutations helper functions
const set = (key) => (state, val) => {
  state[key] = val;
};

const mutations = {
  setPlayerId: set("playerId"),
  setPlayerSecret: set("playerSecret"),
  setSpectator: set("isSpectator"),
  setReconnecting: set("isReconnecting"),
  setPlayerCount: set("playerCount"),
  setPing: set("ping"),
  setVotingSpeed: set("votingSpeed"),
  setVoteInProgress: set("isVoteInProgress"),
  setMarkedPlayer: set("markedPlayer"),
  setNomination: set("nomination"),
  setAllowSelfNaming: set("allowSelfNaming"),
  setVoteHistoryAllowed: set("isVoteHistoryAllowed"),
  setVoteWatchingAllowed: set("isVoteWatchingAllowed"),
  claimSeat: set("claimedSeat"),
  distributeRoles: set("isRolesDistributed"),
  setDealtRoles: set("dealtRoles"),
  setGameResumed: set("isGameResumed"),
  /** Start ({ remaining, duration } in ms) or stop (null) the day timer. */
  setGameOver: set("gameOver"),
  setShownGrimoire: set("shownGrimoire"),
  /** Player: done looking at the grimoire (tells the storyteller). */
  closeShownGrimoire(state) {
    state.shownGrimoire = null;
  },
  /** ST: { playerId, status: "sent" | "seen" }, or null to forget them all. */
  setGrimoireView(state, view) {
    state.grimoireViews = view
      ? { ...state.grimoireViews, [view.playerId]: view.status }
      : {};
  },
  setDayTimer(state, timer) {
    state.dayTimer = timer
      ? { endsAt: Date.now() + timer.remaining, duration: timer.duration }
      : null;
  },
  setVoteHistory: set("voteHistory"),
  setSessionId(state, sessionId) {
    state.sessionId = sessionId
      .toLocaleLowerCase()
      .replace(/[^0-9a-z]/g, "")
      .substr(0, 10);
  },
  nomination(
    state,
    { nomination, votes, votingSpeed, lockedVote, isVoteInProgress } = {},
  ) {
    state.nomination = nomination || false;
    state.votes = votes || [];
    state.votingSpeed = votingSpeed || state.votingSpeed;
    state.lockedVote = lockedVote || 0;
    state.isVoteInProgress = isVoteInProgress || false;
  },
  /**
   * Create an entry in the vote history log. Requires current player array because it might change later in the game.
   * Only stores votes that were completed.
   * @param state
   * @param players
   */
  addHistory(state, players) {
    if (!state.isVoteHistoryAllowed && state.isSpectator) return;
    if (!state.nomination || state.lockedVote <= players.length) return;
    const isExile = players[state.nomination[1]].role.team === "traveller";
    const votes = [];
    let count = 0;
    for (var i = 0; i < players.length; i++) {
      const vote = state.votes[i] === true ? 1 : state.votes[i] || 0;
      const weight = players[i].voteWeight || 1;
      count += vote * weight;
      // a Thief's target counts against: listed with a minus sign
      for (var j = 0; j < vote * Math.abs(weight); j++) {
        votes.push(weight < 0 ? "−" + players[i].name : players[i].name);
      }
    }

    state.voteHistory.push({
      timestamp: new Date(),
      nominator: players[state.nomination[0]].name,
      nominee: players[state.nomination[1]].name,
      type: isExile ? "Exile" : "Execution",
      majority: Math.ceil(
        players.filter((player) => !player.isDead || isExile).length / 2,
      ),
      votes: votes,
      count: count,
    });
  },
  clearVoteHistory(state) {
    state.voteHistory = [];
  },
  /**
   * Store a vote with and without syncing it to the live session.
   * This is necessary in order to prevent infinite voting loops.
   * @param state
   * @param vote
   */
  vote: handleVote,
  voteSync: handleVote,
  lockVote(state, lock) {
    state.lockedVote = lock !== undefined ? lock : state.lockedVote + 1;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
