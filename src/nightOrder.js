/**
 * The night order of the script: who wakes, in which order, with the players
 * holding each character. Shared by the night order sheet (NightOrderModal)
 * and the storyteller's guided night (GuidedNight).
 *
 * Entries are roles (not localized) with `players` added; `first` picks the
 * first night or the other nights. Includes dusk and dawn, and on the first
 * night the minion and demon info when there are 7 or more players.
 */
const DUSK_DAWN = {
  firstNight: {
    dusk: "Start the Night Phase.",
    dawn: "Wait a few seconds. End the Night Phase.",
  },
  otherNight: {
    dusk: "Start the Night Phase.",
    dawn: "Wait for a few seconds. End the Night Phase.",
  },
};

const MINION_INFO =
  "If there are 7 or more players, wake all Minions: Show the *THIS IS THE DEMON* token. Point to the Demon. Show the *THESE ARE YOUR MINIONS* token. Point to the other Minions.";
const DEMON_INFO =
  "If there are 7 or more players, wake the Demon: Show the *THESE ARE YOUR MINIONS* token. Point to all Minions. Show the *THESE CHARACTERS ARE NOT IN PLAY* token. Show 3 not-in-play good character tokens.";

/**
 * @param {boolean} first first night, or the other nights
 * @param {object} game { edition, roles (Map), otherTravellers (Map), npcs,
 *   players, getFirstNightOrder, getOtherNightOrder }
 */
export function nightOrder(first, game) {
  const key = first ? "firstNight" : "otherNight";
  const reminderKey = key + "Reminder";
  const { edition, roles, otherTravellers, npcs, players } = game;
  const custom = edition[key];
  const defaultOrder = first
    ? game.getFirstNightOrder
    : game.getOtherNightOrder;
  const indexOf = (id) => (custom ? custom.indexOf(id) + 1 : defaultOrder(id));
  const holding = (role) => players.filter((p) => p.role.id === role.id);
  const entries = [];

  ["dusk", "dawn"].forEach((id) => {
    const index = indexOf(id);
    if (index > 0) {
      entries.push({
        id,
        name: id === "dusk" ? "Dusk" : "Dawn",
        [key]: index,
        [reminderKey]: DUSK_DAWN[key][id],
        players: [],
      });
    }
  });

  if (first && players.length > 6) {
    const minionIndex = indexOf("minioninfo");
    const demonIndex = indexOf("demoninfo");
    if (minionIndex > 0) {
      entries.push({
        id: "minioninfo",
        name: "Minion info",
        [key]: minionIndex,
        team: "minion",
        players: players.filter((p) => p.role.team === "minion"),
        [reminderKey]: MINION_INFO,
      });
    }
    if (demonIndex > 0) {
      entries.push({
        id: "demoninfo",
        name: "Demon info & bluffs",
        [key]: demonIndex,
        team: "demon",
        players: players.filter((p) => p.role.team === "demon"),
        [reminderKey]: DEMON_INFO,
      });
    }
  }

  new Map(roles).forEach((role) => {
    if (custom) role = Object.assign({}, role, { [key]: indexOf(role.id) });
    const rolePlayers = holding(role);
    if (role[key] && (role.team !== "traveller" || rolePlayers.length)) {
      entries.push(Object.assign({ players: rolePlayers }, role));
    }
  });

  otherTravellers.forEach((role) => {
    const rolePlayers = holding(role);
    if (role[key] && rolePlayers.length) {
      const index = custom ? custom.indexOf("dusk") + 1.2 : role[key];
      entries.push(
        Object.assign({ players: rolePlayers }, role, { [key]: index }),
      );
    }
  });

  npcs
    .filter((npc) => npc[key] || (custom && custom.includes(npc.id)))
    .forEach((npc) => {
      const index = custom
        ? custom.includes(npc.id)
          ? custom.indexOf(npc.id) + 1
          : custom.indexOf("dusk") + 1.1
        : npc[key];
      entries.push(Object.assign({ players: [] }, npc, { [key]: index }));
    });

  entries.sort((a, b) => a[key] - b[key]);
  return entries;
}
