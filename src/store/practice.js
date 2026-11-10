import { isPracticeId } from "./modules/practice";

// how likely a made-up player is to raise their hand in a vote
const YES_CHANCE = 0.5;

/**
 * Store plugin for practice games (see store/modules/practice.js): plays the
 * part of the made-up players where the live server would bring a real one.
 *
 * - The grimoire shown to a player (Spy) pops up for the storyteller.
 * - When a vote starts, each player who can vote raises a hand or not, at
 *   random. The storyteller can still change any vote once the clock hand
 *   has passed, as in a real game.
 * - Creating or joining a real game ends the practice.
 */
export default (store) => {
  const isActive = () => store.state.practice.active;

  const randomVotes = () => {
    const { players } = store.state.players;
    const { nomination } = store.state.session;
    if (!nomination) return;
    const nominee = players[nomination[1]];
    const isExile = !!nominee && nominee.role.team === "traveller";
    players.forEach((player, index) => {
      const canVote = !player.isVoteless || isExile;
      const yes = canVote && Math.random() < YES_CHANCE;
      const count = yes ? (player.hasTwoVotes ? 2 : 1) : 0;
      if (store.state.session.votes[index] !== count) {
        store.commit("session/voteSync", [index, count]);
      }
    });
  };

  store.subscribe(({ type, payload }, state) => {
    if (!isActive()) return;
    switch (type) {
      case "session/setGrimoireView":
        if (payload && payload.status === "sent") {
          store.commit("practice/dropAll", {
            kind: "grimoire",
            playerId: payload.playerId,
          });
          store.commit("practice/receive", {
            playerId: payload.playerId,
            kind: "grimoire",
          });
        }
        break;
      // the clock hand starts going round
      case "session/lockVote":
        if (state.session.lockedVote === 1) randomVotes();
        break;
      // the grimoire is only shown at night
      case "toggleNight":
        if (!state.grimoire.isNight) {
          store.commit("practice/dropAll", { kind: "grimoire" });
        }
        break;
      // a real game: the made-up players leave their seats
      case "session/setSessionId":
        if (payload) {
          state.players.players.forEach((player) => {
            if (!isPracticeId(player.id)) return;
            store.commit("players/update", {
              player,
              property: "id",
              value: "",
            });
            store.commit("players/update", {
              player,
              property: "connected",
              value: false,
            });
          });
          store.commit("practice/setActive", false);
        }
        break;
    }
  });
};
