const STORAGE_KEY = "playerNotes";
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

const save = (sessionId, notes) => {
  const all = readAll();
  if (Object.keys(notes).length) {
    all[sessionId] = { savedAt: Date.now(), notes };
  } else {
    delete all[sessionId];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.warn("Can't save the notes", error);
  }
};

const notesOf = (sessionId) => (readAll()[sessionId] || {}).notes || {};

/**
 * Keeps the notes on this device, one set per game session: they survive a
 * reload, come back on returning to the game, and don't follow you to another.
 */
export default (store) => {
  const sessionId = () => store.state.session.sessionId;
  const names = () => store.state.players.players.map(({ name }) => name);

  store.commit("notes/load", notesOf(sessionId()));

  store.subscribe(({ type }) => {
    if (["notes/set", "notes/rename", "notes/clear"].includes(type)) {
      save(sessionId(), store.state.notes.notes);
    }
  });

  store.watch(sessionId, (next, previous) => {
    const { notes } = store.state.notes;
    // notes taken before creating or joining the game come along
    if (
      previous === "" &&
      Object.keys(notes).length &&
      !Object.keys(notesOf(next)).length
    ) {
      save(next, notes);
      save("", {});
      return;
    }
    store.commit("notes/load", notesOf(next));
  });

  // a player who changes name keeps their note. Only one name changing, in the
  // same seat: seats that swap or a new list of players aren't a rename
  let previousNames = names();
  store.watch(names, (current) => {
    const before = previousNames;
    previousNames = current;
    if (before.length !== current.length) return;
    const changed = current.filter((name, index) => name !== before[index]);
    if (changed.length !== 1) return;
    const to = changed[0];
    const from = before[current.indexOf(to)];
    if (
      !current.includes(from) &&
      store.getters["notes/noteOf"](from) &&
      !store.getters["notes/noteOf"](to)
    ) {
      store.commit("notes/rename", { from, to });
    }
  });
};
