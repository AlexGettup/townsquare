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
  // secret vote (Organ Grinder): players only send their hand to the
  // storyteller, and only the storyteller sees hands and the count
  isVoteHidden: false,
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
  // ST: player ID whose grimoire to show is being edited (GrimoireEditor)
  editingGrimoireFor: null,
  // pointing vote (Boomdandy), the same for everyone: null, { since } while
  // players point (each answers a card, see chat), then { since, pairs:
  // [[from, to] names] } once the storyteller reveals who pointed at whom
  pointing: null,
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
  /**
   * Today's highest execution vote that reached the majority, the one a new
   * nomination has to tie or beat: { count, nominees: [names] }, or null.
   * Two or more at the top are tied (nobody is about to die).
   */
  votesToBeat: (state, getters, rootState) => {
    const day = rootState.grimoire.nightCount;
    const today = state.voteHistory.filter(
      (vote) =>
        vote.day === day &&
        vote.type === "Execution" &&
        vote.count >= vote.majority,
    );
    if (!today.length) return null;
    const count = Math.max(...today.map((vote) => vote.count));
    const nominees = today
      .filter((vote) => vote.count === count)
      .map(({ nominee }) => nominee);
    return { count, nominees };
  },
  /** Players: the grimoire to show instead of theirs, if any. */
  revealedGrimoire: (state) =>
    state.isSpectator ? state.gameOver || state.shownGrimoire : null,
};

const actions = {
  /**
   * Storyteller: start a pointing vote (Boomdandy). Every seated player gets
   * a card to point at a seat; only the storyteller sees the answers until
   * they reveal them.
   */
  startPointing({ state, commit, dispatch, rootState }) {
    if (state.isSpectator) return;
    commit("setPointing", { since: Date.now() });
    rootState.players.players.forEach(({ id }) => {
      if (!id) return;
      dispatch(
        "chat/sendCard",
        {
          to: id,
          card: {
            phrase: "pointAtPlayer",
            text: "",
            roles: [],
            players: [],
            number: null,
            answer: null,
          },
        },
        { root: true },
      );
    });
  },
  /**
   * Storyteller: one player nominates another (seat indexes). Both get their
   * mark next to the name until the day ends (synced to the players).
   */
  nominate({ commit, rootState }, [from, to]) {
    commit("nomination", { nomination: [from, to] });
    const { players } = rootState.players;
    [
      [players[from], "hasNominated"],
      [players[to], "wasNominated"],
    ].forEach(([player, property]) => {
      if (player && !player[property]) {
        commit(
          "players/update",
          { player, property, value: true },
          { root: true },
        );
      }
    });
  },
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
  setVoteHidden: set("isVoteHidden"),
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
  /**
   * ST: { playerId, status: "sent" | "seen" }, or null to forget them all.
   * "sent" may carry the grimoire to send, edited (see GrimoireEditor).
   */
  setPointing: set("pointing"),
  setEditingGrimoire: set("editingGrimoireFor"),
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
   * @param payload { players, day } (day: the day count, to know today's
   * votes), or just the players
   */
  addHistory(state, payload) {
    const { players, day } = Array.isArray(payload)
      ? { players: payload }
      : payload;
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
      day,
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
