/**
 * Practice game: how a made-up player decides what to answer to an info
 * card, from what that player would know at a real table and nothing more.
 *
 * - Their own character and alignment: the token dealt to them, or the last
 *   "You are" card they got (the Lunatic told they are the Imp, a Snake
 *   Charmer's swap).
 * - Their evil teammates, only from the cards they got: a Minion knows the
 *   Demon once shown "This is the Demon", a Demon knows the Minions once
 *   shown "These are your Minions". Good players never know who is good.
 * - Characters "not in play" sent to them (the Demon's bluffs). A Minion has
 *   none unless the storyteller gives them some.
 * - What they chose before (the Butler's master, "different to last night").
 *
 * Then they choose like a player would: the Poisoner and the Demon go for
 * someone who isn't on their side as far as they know, the Monk protects
 * someone else, the Fortune Teller checks two players... with a little
 * chance so two games don't go the same way. The rules on who can be chosen
 * come from the ability's text ("not yourself", "a dead player").
 *
 * Kept apart from Vue and the store so it can be tried on its own.
 */

import { alignmentOf, partsOf } from "./cards";

// cards answered by tapping seats: how many to pick
export const SEATS_TO_CHOOSE = {
  choosePlayer: 1,
  chooseTwoPlayers: 2,
  // the pointing vote (Boomdandy)
  pointAtPlayer: 1,
};

// evil characters whose choice protects instead of hurting
const PROTECTS_EVIL = ["devilsadvocate"];
// good characters whose choice protects someone
const PROTECTS = ["monk", "innkeeper", "tealady", "exorcist", "sailor"];
// whoever they chose before, they keep choosing most nights
const KEEPS_CHOICE = { butler: 0.75, sailor: 0.3 };
// a Demon that may choose themselves to pass the Demon on (Imp)
const STARPASS = { imp: 0.08 };
// characters that choose a good character with "choose a character"
const NAMES_GOOD = ["philosopher", "cerenovus", "pixie", "huntsman"];

/** "a player (not yourself)" and the like, read from the ability. */
export const rulesOf = (ability = "") => {
  const text = ability.toLowerCase();
  return {
    notSelf: /not yourself|not you\b/.test(text),
    deadOnly: /choose (a|1|2) dead player/.test(text),
    aliveOnly: /choose (a|an|1|2|3) (alive|living) player/.test(text),
    differentEachNight: /different to last night/.test(text),
  };
};

/**
 * What one made-up player knows, from their token and the cards the
 * storyteller sent them (oldest first).
 *
 * player: { id, name, role, alignmentIndex, isDead }
 * cards: [{ card, choice }] sent to them
 * roleById(id): a character
 */
export const knowledgeOf = (player, cards, roleById) => {
  let role = player.role && player.role.id ? player.role : null;
  let alignment = role ? alignmentOf(role.team, player.alignmentIndex) : null;
  const demons = new Set();
  const minions = new Set();
  const notInPlay = new Set();
  const choices = [];
  cards.forEach(({ card, choice }) => {
    if (!card) return;
    partsOf(card).forEach((part) => {
      if (part.phrase === "youAre") {
        const told = part.roles.length && roleById(part.roles[0]);
        if (told && told.id) {
          role = told;
          alignment = alignmentOf(told.team, 0);
        }
        if (part.alignment) alignment = part.alignment;
      }
      if (part.phrase === "thisIsTheDemon") {
        part.players.forEach((name) => demons.add(name));
      }
      if (part.phrase === "theseAreYourMinions") {
        part.players.forEach((name) => minions.add(name));
      }
      if (part.phrase === "notInPlay") {
        part.roles.forEach((id) => notInPlay.add(id));
      }
    });
    if (choice && choice.length) choices.push({ phrase: card.phrase, choice });
  });
  const isEvil = alignment === "evil";
  return {
    name: player.name,
    isDead: !!player.isDead,
    role: role || {},
    alignment,
    // evil players they know of (good players know none)
    teammates: isEvil
      ? [...demons, ...minions].filter((name) => name !== player.name)
      : [],
    bluffs: [...notInPlay],
    choices,
  };
};

const shuffled = (list, random) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Pick `count` names, by groups: everyone in the first group (shuffled)
 * before anyone in the second, and so on.
 */
const pickFrom = (groups, count, random) => {
  const picked = [];
  groups.forEach((group) => {
    shuffled(group, random).forEach((name) => {
      if (picked.length < count && !picked.includes(name)) picked.push(name);
    });
  });
  return picked.length === count ? picked : null;
};

/**
 * The seats a made-up player taps: { seats: [names] }, or null when they
 * can't choose that many.
 *
 * me: from knowledgeOf; players: [{ name, isDead }] in seat order;
 * nightCount: the night it is (1 the first one).
 */
export const chooseSeats = (
  me,
  players,
  count,
  { nightCount = 1, random = Math.random } = {},
) => {
  const role = me.role || {};
  const rules = rulesOf(role.ability);
  const last = me.choices.length
    ? me.choices[me.choices.length - 1].choice
    : [];
  const isEvil = me.alignment === "evil";

  // the Demon passes the Demon on, if a Minion they know of is alive
  const starpass = STARPASS[role.id];
  if (starpass && count === 1 && nightCount > 1 && !me.isDead) {
    const minionAlive = players.some(
      ({ name, isDead }) => !isDead && me.teammates.includes(name),
    );
    if (minionAlive && random() < starpass) return { seats: [me.name] };
  }

  // the Butler keeps their master
  const keeps = KEEPS_CHOICE[role.id];
  if (keeps && last.length === count && random() < keeps) {
    const still = last.every((name) =>
      players.some((player) => player.name === name),
    );
    if (still) return { seats: [...last] };
  }

  let candidates = players.filter(({ name, isDead }) => {
    if (rules.notSelf && name === me.name) return false;
    if (rules.deadOnly && !isDead) return false;
    if (rules.aliveOnly && isDead) return false;
    if (rules.differentEachNight && last.includes(name)) return false;
    return true;
  });
  if (candidates.length < count) candidates = players;
  const alive = candidates.filter(({ isDead }) => !isDead).map(nameOf);
  const dead = candidates.filter(({ isDead }) => isDead).map(nameOf);
  const without = (list, names) => list.filter((name) => !names.includes(name));
  const others = (list) => without(list, [me.name]);
  const self = candidates.some(({ name }) => name === me.name) ? [me.name] : [];

  let groups;
  if (rules.deadOnly) {
    groups = [others(dead), dead];
  } else if (isEvil && PROTECTS_EVIL.includes(role.id)) {
    // their side first, themselves included
    const side = [...me.teammates, me.name];
    groups = [alive.filter((name) => side.includes(name)), alive, dead];
  } else if (isEvil) {
    // anyone not on their side as far as they know, and not last night's
    // target if they can help it (a Poisoner doesn't poison the same twice)
    const side = [...me.teammates, me.name];
    const targets = without(alive, side);
    groups = [without(targets, last), targets, without(alive, [me.name])];
  } else if (PROTECTS.includes(role.id)) {
    groups = [others(alive), alive];
  } else {
    // information: someone else, alive, now and then themselves (the
    // Fortune Teller does it to find the red herring) or the dead
    groups =
      random() < 0.15
        ? [self, others(alive), others(dead)]
        : [others(alive), others(dead), self];
  }
  const seats = pickFrom([...groups, candidates.map(nameOf)], count, random);
  return seats ? { seats } : null;
};

const nameOf = ({ name }) => name;

/**
 * The character they name with "choose a character": a role ID, or null.
 * scriptRoles: the script's characters, without travellers and Fabled.
 */
export const chooseCharacter = (
  me,
  scriptRoles,
  { random = Math.random } = {},
) => {
  const role = me.role || {};
  const notMine = scriptRoles.filter(({ id }) => id !== role.id);
  const good = notMine.filter(({ team }) => team === "townsfolk");
  const list =
    (NAMES_GOOD.includes(role.id) || me.alignment === "evil") && good.length
      ? good
      : notMine;
  if (!list.length) return null;
  return list[Math.floor(random() * list.length)].id;
};

/**
 * Yes or no to "Do you use your ability?": a once-per-game ability gets
 * used more as the nights go by; the Philosopher wants one straight away.
 */
export const useAbility = (
  me,
  { nightCount = 1, random = Math.random } = {},
) => {
  const role = me.role || {};
  if (role.id === "philosopher") return random() < 0.8;
  const chance = Math.min(0.2 + 0.15 * Math.max(nightCount - 1, 0), 0.85);
  return random() < chance;
};

/**
 * The pointing vote (Boomdandy): at someone else alive, and for the evil
 * not at a teammate they know of.
 */
export const pointAt = (me, { players, random = Math.random }) => {
  const alive = players
    .filter(({ isDead, name }) => !isDead && name !== me.name)
    .map(nameOf);
  const away = alive.filter((name) => !me.teammates.includes(name));
  const seats = pickFrom([away, alive, players.map(nameOf)], 1, random);
  return seats ? { seats } : null;
};

/**
 * What a made-up player answers to a card, or null when it asks nothing:
 * { seats: [names] }, { roleId } or { answer: "yes" | "no" }.
 */
export const decide = (me, card, context) => {
  if (!card) return null;
  if (card.phrase === "pointAtPlayer") return pointAt(me, context);
  const seats = SEATS_TO_CHOOSE[card.phrase];
  if (seats) return chooseSeats(me, context.players, seats, context);
  const phrases = [card.phrase, ...partsOf(card).map(({ phrase }) => phrase)];
  if (phrases.includes("chooseCharacter")) {
    const roleId = chooseCharacter(me, context.scriptRoles, context);
    return roleId ? { roleId } : null;
  }
  if (phrases.includes("useAbility")) {
    return { answer: useAbility(me, context) ? "yes" : "no" };
  }
  return null;
};
