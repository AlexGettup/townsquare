import { isPracticeId, restoreView } from "./modules/practice";

/**
 * Store plugin for practice games (see store/modules/practice.js): plays the
 * part of the made-up players where the live server would bring a real one.
 *
 * - The grimoire shown to a player (Spy) pops up for the storyteller.
 * - Votes, claims and nominations by day: see store/practiceTown.js.
 * - Creating or joining a real game ends the practice.
 */
export default (store) => {
  const isActive = () => store.state.practice.active;

  // the page reloaded while viewing as a player: the grimoire comes back
  try {
    const view = JSON.parse(localStorage.getItem("practiceView"));
    if (view && isActive()) {
      restoreView(
        {
          commit: store.commit,
          rootState: store.state,
          rootGetters: store.getters,
        },
        view,
      );
    }
    localStorage.removeItem("practiceView");
  } catch (e) {
    // nothing saved
  }

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
      // the grimoire is only shown at night
      case "toggleNight":
        if (!state.grimoire.isNight) {
          store.commit("practice/dropAll", { kind: "grimoire" });
        }
        break;
      // a real game: the made-up players leave their seats
      case "session/setSessionId":
        if (payload) {
          store.dispatch("practice/leaveView");
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
