/**
 * Store plugin, storyteller only: marks when each night starts and ends and
 * whom the grimoire is shown to (store/modules/nightLog.js), for the night
 * summary. A new game starts the log again.
 */
export default (store) => {
  store.subscribe(({ type, payload }, state) => {
    if (state.session.isSpectator) return;
    switch (type) {
      case "toggleNight": {
        const open = state.nightLog.nights.some(({ end }) => end === null);
        if (state.grimoire.isNight && !open) {
          store.commit("nightLog/start", {
            night: state.grimoire.nightCount,
            at: Date.now(),
          });
        } else if (!state.grimoire.isNight && open) {
          store.commit("nightLog/end", Date.now());
        }
        break;
      }
      case "setNightCount":
        if (state.grimoire.isNight) store.commit("nightLog/number", payload);
        break;
      case "session/setGrimoireView":
        if (payload && state.grimoire.isNight) {
          store.commit("nightLog/grimoire", payload);
        }
        break;
      case "session/newGame":
      case "practice/setActive":
        store.commit("nightLog/set", []);
        break;
    }
  });
};
