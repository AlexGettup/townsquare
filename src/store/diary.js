const STORAGE_KEY = "playerDiary";
// like a saved game: older ones belong to a game that's over
const MAX_AGE = 12 * 60 * 60 * 1000;

const readAll = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return Object.fromEntries(
      Object.entries(saved).filter(
        ([, { savedAt }]) => Date.now() - savedAt < MAX_AGE,
      ),
    );
  } catch (error) {
    return {};
  }
};

const save = (sessionId, diary) => {
  const all = readAll();
  all[sessionId] = { savedAt: Date.now(), ...diary };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.warn("Can't save the diary", error);
  }
};

const diaryOf = (sessionId) => readAll()[sessionId] || null;

/**
 * Store plugin writing the diary (store/modules/diary.js) as the game goes:
 * each nightfall and dawn, deaths, the grimoire shown to you and each vote.
 * One diary per game session, kept on this device. A practice game starts a
 * new one.
 */
export default (store) => {
  const sessionId = () => store.state.session.sessionId;

  const persist = () => {
    const { phases, events, votes } = store.state.diary;
    save(sessionId(), { phases, events, votes });
  };

  // the night or day it is now
  const notePhase = () => {
    const { nightCount, isNight } = store.state.grimoire;
    store.commit("diary/addPhase", {
      at: Date.now(),
      night: nightCount,
      isNight,
    });
  };

  store.commit("diary/load", diaryOf(sessionId()));
  notePhase();

  // votes recorded in the vote history so far (it only grows, or is cleared)
  let votesSeen = store.state.session.voteHistory.length;

  store.subscribe(({ type, payload }, state) => {
    switch (type) {
      case "toggleNight":
      case "setNightCount":
        notePhase();
        break;
      case "players/update":
        if (payload && payload.property === "isDead") {
          store.commit("diary/addEvent", {
            at: Date.now(),
            kind: payload.value ? "death" : "revive",
            name: payload.player.name,
          });
        }
        break;
      case "session/setShownGrimoire":
        if (payload && state.session.isSpectator) {
          store.commit("diary/addEvent", { at: Date.now(), kind: "grimoire" });
        }
        break;
      case "session/addHistory": {
        const history = state.session.voteHistory;
        history.slice(votesSeen).forEach((vote) => {
          store.commit("diary/addVote", {
            at: new Date(vote.timestamp).getTime(),
            nominator: vote.nominator,
            nominee: vote.nominee,
            type: vote.type,
            count: vote.count !== undefined ? vote.count : vote.votes.length,
            majority: vote.majority,
            votes: [...vote.votes],
          });
        });
        votesSeen = history.length;
        break;
      }
      case "session/clearVoteHistory":
      case "session/setVoteHistory":
        votesSeen = state.session.voteHistory.length;
        break;
      // each practice game is a new game
      case "practice/setActive":
        store.commit("diary/clear");
        notePhase();
        break;
    }
    if (type.startsWith("diary/") && type !== "diary/load") persist();
  });

  // another game: its own diary (a new one starts where it is now)
  store.watch(sessionId, (next) => {
    store.commit("diary/load", diaryOf(next));
    notePhase();
    votesSeen = store.state.session.voteHistory.length;
  });
};
