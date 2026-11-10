/**
 * Store plugin, storyteller only: a vote value set by a reminder, like the
 * official app. Putting the Bureaucrat's "3 Votes" on a seat makes that vote
 * count 3, the Thief's "Negative Vote" makes it count -1, and the Banshee's
 * "Has Ability" gives two votes. Taking the reminder away puts it back to 1.
 * The seat menu can still change the value by hand.
 *
 * Also: a new nomination is a secret vote while the Organ Grinder is seated.
 */

// reminder (character, name) -> vote value
const VALUES = [
  { role: "bureaucrat", name: "3 Votes", value: 3 },
  { role: "thief", name: "Negative Vote", value: -1 },
  { role: "banshee", name: "Has Ability", value: 2 },
];

/** The vote value a seat's reminders give, or null if none of them does. */
export const valueFromReminders = (reminders) => {
  const match = VALUES.find(({ role, name }) =>
    (reminders || []).some(
      (reminder) => reminder.role === role && reminder.name === name,
    ),
  );
  return match ? match.value : null;
};

const valueOf = (player) => (player.hasTwoVotes ? 2 : player.voteWeight || 1);

const setValue = (store, player, value) => {
  // x2 (Banshee) is public; x3 and -1 stay with the storyteller
  const hasTwoVotes = value === 2;
  if (!!player.hasTwoVotes !== hasTwoVotes) {
    store.commit("players/update", {
      player,
      property: "hasTwoVotes",
      value: hasTwoVotes,
    });
  }
  const weight = value === 3 || value === -1 ? value : 1;
  if ((player.voteWeight || 1) !== weight) {
    store.commit("players/update", {
      player,
      property: "voteWeight",
      value: weight,
    });
  }
};

export default (store) => {
  // each seat's reminders as they were before the latest change
  let before = new Map();
  const remember = () => {
    before = new Map(
      store.state.players.players.map((player) => [player, player.reminders]),
    );
  };
  remember();
  store.subscribe(({ type, payload }, state) => {
    // a new nomination: a secret vote by default while the Organ Grinder is
    // seated (the storyteller can change it before the vote starts)
    if (type === "session/nomination" && !state.session.isSpectator) {
      const hidden =
        !!(payload && (payload.nomination || Array.isArray(payload))) &&
        state.players.players.some(
          ({ role }) => role && role.id === "organgrinder",
        );
      if (state.session.isVoteHidden !== hidden) {
        store.commit("session/setVoteHidden", hidden);
      }
      return;
    }
    if (!type.startsWith("players/")) return;
    if (
      !state.session.isSpectator &&
      type === "players/update" &&
      payload.property === "reminders"
    ) {
      const { player } = payload;
      const now = valueFromReminders(payload.value);
      const was = valueFromReminders(before.get(player));
      if (now !== null) {
        if (valueOf(player) !== now) setValue(store, player, now);
      } else if (was !== null && valueOf(player) === was) {
        // the reminder that set it went away
        setValue(store, player, 1);
      }
    }
    remember();
  });
};
