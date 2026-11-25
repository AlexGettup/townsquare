/**
 * Character selection rules: how characters that change the setup (the text
 * in [brackets]) change what goes in the bag. From the official wiki's "How
 * to Run" of each character. The selector only warns: the storyteller may
 * break the rules (the Atheist even says so).
 *
 * - outsider: the Outsider changes it allows ([2] the Baron, [-1, 1] the
 *   Godfather), or "any" (Xaan, Kazali, Lord of Typhon)
 * - noMinions / noDemon: those tokens don't go in the bag (their places go
 *   to Townsfolk, or to Outsiders with evilToGood)
 * - free: no count per type, only the total (Legion)
 * - requires: a character that has to be in play (Huntsman → Damsel)
 * - max: copies allowed in the bag (Village Idiot: itself + 2)
 */
export const RULES = {
  baron: { outsider: [2] },
  fanggu: { outsider: [1] },
  vigormortis: { outsider: [-1] },
  godfather: { outsider: [-1, 1] },
  balloonist: { outsider: [0, 1] },
  hermit: { outsider: [0, -1] },
  sentinel: { outsider: [-1, 0, 1] },
  // a Townsfolk becomes the Damsel, unless she was in play already
  huntsman: { outsider: [0, 1], requires: "damsel" },
  // a Townsfolk becomes the King: no change in the counts
  choirboy: { requires: "king" },
  xaan: { outsider: "any" },
  kazali: { noMinions: true, evilToGood: true, outsider: "any" },
  lordoftyphon: { noMinions: true, evilToGood: true, outsider: "any" },
  summoner: { noDemon: true },
  atheist: { noMinions: true, noDemon: true, evilToGood: true },
  legion: { free: true },
  villageidiot: { max: 3 },
};

export const BAG_TEAMS = ["townsfolk", "outsider", "minion", "demon"];

const hasSpecial = (role, name) =>
  !!(role && role.special) &&
  role.special.some(
    (special) => special.type === "selection" && special.name === name,
  );

/** Characters that never go in the bag (Drunk, Marionette, Lil' Monsta). */
export const isBagDisabled = (role) => hasSpecial(role, "bag-disabled");

/**
 * How many of each type the bag may have, given the characters chosen (and
 * the Fabled / Loric in play): { townsfolk: [3, 4], outsider: [1, 2], … },
 * each a sorted list of the counts allowed, or null for any count.
 * @param base the usual counts for the number of players (counts.json)
 * @param active ids of the characters chosen and of the Fabled / Loric
 */
export const expectedCounts = (base, active) => {
  const rules = active.map((id) => RULES[id]).filter(Boolean);
  if (rules.some((rule) => rule.free)) {
    return { townsfolk: null, outsider: null, minion: null, demon: null };
  }
  const total = BAG_TEAMS.reduce((sum, team) => sum + base[team], 0);
  const minion = rules.some((rule) => rule.noMinions) ? 0 : base.minion;
  const demon = rules.some((rule) => rule.noDemon) ? 0 : base.demon;
  // evil places that may go to Outsiders instead of Townsfolk
  const freed = rules.some((rule) => rule.evilToGood)
    ? base.minion - minion + (base.demon - demon)
    : 0;
  const good = total - minion - demon;

  let outsider = [0];
  if (rules.some((rule) => rule.outsider === "any")) {
    outsider = null;
  } else {
    rules
      .filter((rule) => Array.isArray(rule.outsider))
      .forEach((rule) => {
        outsider = outsider.flatMap((a) => rule.outsider.map((b) => a + b));
      });
    outsider = outsider.map((delta) => base.outsider + delta);
    outsider = outsider.flatMap((count) =>
      Array.from({ length: freed + 1 }, (_, extra) => count + extra),
    );
    const possible = outsider.filter((count) => count >= 0 && count <= good);
    // nothing fits (the Vigormortis with no Outsiders): as close as it gets
    outsider = possible.length
      ? possible
      : outsider.map((count) => Math.max(0, Math.min(good, count)));
    outsider = [...new Set(outsider)].sort((a, b) => a - b);
  }
  const townsfolk = outsider
    ? [...new Set(outsider.map((count) => good - count))].sort((a, b) => a - b)
    : null;
  return { townsfolk, outsider, minion: [minion], demon: [demon] };
};

/** "3", "1–3" or "0/2" for the counter; "?" when any count goes. */
export const formatCounts = (counts) => {
  if (!counts) return "?";
  if (counts.length === 1) return String(counts[0]);
  const first = counts[0];
  const last = counts[counts.length - 1];
  return last - first === counts.length - 1
    ? `${first}–${last}`
    : counts.join("/");
};

/** Whether the bag may hold more than one of this character. */
export const canRepeat = (role, { allowMultiple, goodDuplicates }) =>
  allowMultiple ||
  hasSpecial(role, "bag-duplicate") ||
  (goodDuplicates && ["townsfolk", "outsider"].includes(role.team));

/** Copies allowed of a character (Infinity when there is no limit). */
export const maxCopies = (role, options) => {
  if (!canRepeat(role, options)) return 1;
  const rule = RULES[role.id];
  return options.allowMultiple || !rule || !rule.max ? Infinity : rule.max;
};

/** Whether duplicates of good characters are allowed (Pope, Atheist). */
export const allowsGoodDuplicates = (roles) =>
  roles.some((role) => hasSpecial(role, "good-duplicate"));

/** The setup text of an ability, without the brackets ("+2 Outsiders"). */
export const setupText = (ability) => {
  const match = String(ability || "").match(/\[([^\]]+)\]\s*$/);
  return match ? match[1] : "";
};
