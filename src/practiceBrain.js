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
 * By day they make up their minds about the others (src/practiceDay.js):
 * when that is known (`scores`, `opinion`, `claims` in the context), the
 * ones hunting the Demon (Exorcist, Sailor, Chambermaid) go for whoever
 * they doubt most, those who protect choose whoever they trust most, and
 * the evil kill whoever the town trusts.
 *
 * Sects & Violets: the Snake Charmer and the Dreamer also go for whoever
 * they doubt most, the Seamstress checks one they trust against one they
 * doubt. The No Dashii leaves their poisoned neighbours alive, the
 * Vigormortis now and then kills one of their Minions, the Fang Gu jumps to
 * a claimed Outsider when the town doubts them. The Cerenovus and the
 * Pit-Hag choose a player and a character together (one on the card, the
 * other in the chat).
 *
 * Kept apart from Vue and the store so it can be tried on its own.
 */

import { CHOICES, alignmentOf, partsOf } from "./cards";
import { neighboursOf } from "./practiceDay";

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
const PROTECTS = ["monk", "innkeeper", "tealady"];
// good characters who choose whoever they doubt most (the Sailor makes them
// drunk, the Exorcist stops the Demon, the Chambermaid sees if they woke)
const HUNTS = ["exorcist", "sailor", "chambermaid", "snakecharmer", "dreamer"];
// whoever they chose before, they keep choosing most nights
const KEEPS_CHOICE = { butler: 0.75, sailor: 0.3 };
// a Demon that may choose themselves to pass the Demon on (Imp)
const STARPASS = { imp: 0.08 };
// characters that choose a good character with "choose a character"
const NAMES_GOOD = ["philosopher", "cerenovus", "pixie", "huntsman"];
// characters that choose an evil one: the Courtier makes them drunk
const NAMES_EVIL = ["courtier"];
// the Po, some nights, chooses no-one to choose 3 players the next
const PO_CHARGE = 0.2;
// evil characters that choose a player and a character at once
const PAIRS = ["cerenovus", "pithag"];
// the Vigormortis kills one of their Minions (who keeps their ability)
const VIGOR_MINION = 0.1;
// the Fang Gu jumps to a claimed Outsider: more when the town doubts them
const FANGGU_JUMP = 0.15;
const FANGGU_JUMP_DOUBTED = 0.5;
// the Pit-Hag makes a Demon (deaths that night are arbitrary), from night 3
const PITHAG_DEMON = 0.1;
// never dealt nor made in this fork
const NEVER = ["drunk", "marionette"];
// how much luck counts when they rank players by what they think of them
// (more for the evil's kills, so the Demon doesn't always pick the same)
const JITTER = 0.6;
const EVIL_JITTER = 1.2;

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
  // the last card asking them to choose went unanswered (the Po's no-one)
  let skipped = false;
  cards.forEach(({ card, choice }) => {
    if (!card) return;
    // made mad by the Cerenovus: the character shown isn't theirs
    const madness = partsOf(card).some(({ roles }) =>
      roles.includes("cerenovus"),
    );
    partsOf(card).forEach((part) => {
      if (part.phrase === "youAre" && !madness) {
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
    const asks = partsOf(card).some(({ phrase }) => CHOICES.includes(phrase));
    if (asks || CHOICES.includes(card.phrase)) {
      skipped = !(choice && choice.length);
    }
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
    // the Demon, as far as an evil player knows (not themselves)
    demons: isEvil ? [...demons].filter((name) => name !== player.name) : [],
    bluffs: [...notInPlay],
    choices,
    skipped,
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
 * Names ranked by what they think of them, most doubted first (or most
 * trusted first with `trusted`), with a little luck. Without scores, as
 * they come.
 */
const ranked = (names, scores, random, trusted = false, jitter = JITTER) => {
  if (!scores) return shuffled(names, random);
  const sign = trusted ? -1 : 1;
  return names
    .map((name) => ({
      name,
      score: sign * (scores[name] || 0) + random() * jitter,
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ name }) => name);
};

/**
 * Pick `count` names in order: the first ones of the list.
 */
const firstOf = (list, count) => {
  const picked = [...new Set(list)].slice(0, count);
  return picked.length === count ? picked : null;
};

/**
 * Choices of a few characters that don't follow the general rules: names,
 * or null to choose like the rest.
 * - The Seamstress: the one they trust most and the one they doubt most.
 * - The No Dashii: not their alive neighbours (they are poisoned).
 * - The Vigormortis: now and then a Minion they know of.
 * - The Fang Gu: a claimed Outsider, to jump to them.
 */
const specialSeats = (
  me,
  count,
  { alive, players, nightCount, scores, opinion, claims, roleOf, random },
) => {
  const role = me.role || {};
  const others = alive.filter((name) => name !== me.name);
  const isEvil = me.alignment === "evil";
  if (role.id === "seamstress" && !isEvil && count === 2 && scores) {
    const trusted = ranked(others, scores, random, true)[0];
    const doubted = ranked(
      others.filter((name) => name !== trusted),
      scores,
      random,
    )[0];
    return trusted && doubted ? [trusted, doubted] : null;
  }
  if (!isEvil || count !== 1 || nightCount < 2) return null;
  const minions = me.teammates.filter(
    (name) => others.includes(name) && !me.demons.includes(name),
  );
  const good = others.filter((name) => !me.teammates.includes(name));
  if (role.id === "vigormortis" && minions.length) {
    if (random() < VIGOR_MINION) return [ranked(minions, null, random)[0]];
  }
  if (role.id === "fanggu") {
    const outsiders = good.filter(
      (name) =>
        claims[name] && (roleOf(claims[name]) || {}).team === "outsider",
    );
    const doubted = opinion && (opinion[me.name] || 0) >= 1;
    const chance = doubted ? FANGGU_JUMP_DOUBTED : FANGGU_JUMP;
    if (outsiders.length && random() < chance) {
      return [ranked(outsiders, null, random)[0]];
    }
  }
  if (role.id === "nodashii") {
    const poisoned = neighboursOf(me.name, players);
    const away = good.filter((name) => !poisoned.includes(name));
    if (away.length) {
      return [ranked(away, opinion, random, true, EVIL_JITTER)[0]];
    }
  }
  return null;
};

/**
 * The seats a made-up player taps: { seats: [names] }, or null when they
 * can't choose that many.
 *
 * me: from knowledgeOf; players: [{ name, isDead }] in seat order;
 * nightCount: the night it is (1 the first one); scores: what they think
 * of each player (suspicion, see practiceDay.js); opinion: the town's;
 * claims: name -> the character they claimed; scriptRoles: the script's
 * characters.
 */
export const chooseSeats = (
  me,
  players,
  count,
  {
    nightCount = 1,
    scores = null,
    opinion = null,
    claims = {},
    scriptRoles = [],
    random = Math.random,
  } = {},
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

  // a Townsfolk they believe: claimed one and they don't doubt them
  const believed = (name) => {
    const claimed = claims[name] && roleOf(claims[name]);
    return !!claimed && (!scores || (scores[name] || 0) < 1);
  };
  const roleOf = (id) => scriptRoles.find((script) => script.id === id) || null;

  // Sects & Violets Demons and the Seamstress
  const special = specialSeats(me, count, {
    alive,
    players,
    nightCount,
    scores,
    opinion,
    claims,
    roleOf,
    random,
  });
  if (special) return { seats: special };

  let groups;
  if (rules.deadOnly) {
    // the Professor: a dead player they believe was a Townsfolk
    const trusted = ranked(others(dead), scores, random, true);
    const townsfolk = trusted.filter(
      (name) => believed(name) && roleOf(claims[name]).team === "townsfolk",
    );
    const seats = firstOf([...townsfolk, ...trusted, ...dead], count);
    if (seats) return { seats };
    groups = [others(dead), dead];
  } else if (isEvil && PROTECTS_EVIL.includes(role.id)) {
    // their side first, the one the town doubts most first, themselves
    // included
    const side = [...me.teammates, me.name];
    const mine = ranked(
      alive.filter((name) => side.includes(name)),
      opinion,
      random,
    );
    const seats = firstOf([...mine, ...shuffled(alive, random)], count);
    if (seats) return { seats };
    groups = [alive, dead];
  } else if (isEvil) {
    // anyone not on their side as far as they know, and not last night's
    // target if they can help it (a Poisoner doesn't poison the same twice).
    // Whoever the town trusts most first: they leave the doubted ones for
    // the town to execute
    const side = [...me.teammates, me.name];
    const targets = without(alive, side);
    if (opinion) {
      const seats = firstOf(
        [
          ...ranked(without(targets, last), opinion, random, true, EVIL_JITTER),
          ...ranked(targets, opinion, random, true, EVIL_JITTER),
          ...without(alive, [me.name]),
        ],
        count,
      );
      if (seats) return { seats };
    }
    groups = [without(targets, last), targets, without(alive, [me.name])];
  } else if (HUNTS.includes(role.id) && scores) {
    const seats = firstOf(
      [...ranked(others(alive), scores, random), ...others(dead), ...self],
      count,
    );
    if (seats) return { seats };
    groups = [others(alive), alive];
  } else if (PROTECTS.includes(role.id) || HUNTS.includes(role.id)) {
    if (scores && PROTECTS.includes(role.id)) {
      const seats = firstOf(
        [...ranked(others(alive), scores, random, true), ...alive],
        count,
      );
      if (seats) return { seats };
    }
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
  { claims = {}, nightCount = 1, random = Math.random } = {},
) => {
  const role = me.role || {};
  const notMine = scriptRoles.filter(({ id }) => id !== role.id);
  const good = notMine.filter(({ team }) => team === "townsfolk");
  if (PAIRS.includes(role.id) && me.alignment === "evil") {
    return pairRole(me, null, { scriptRoles, claims, nightCount, random });
  }
  // the Courtier: most likely the Demon, else a Minion
  if (NAMES_EVIL.includes(role.id) && me.alignment !== "evil") {
    const team = random() < 0.6 ? "demon" : "minion";
    const evil = notMine.filter((other) => other.team === team);
    if (evil.length) return evil[Math.floor(random() * evil.length)].id;
  }
  const list =
    (NAMES_GOOD.includes(role.id) || me.alignment === "evil") && good.length
      ? good
      : notMine;
  if (!list.length) return null;
  return list[Math.floor(random() * list.length)].id;
};

const pickOne = (list, random) =>
  list.length ? list[Math.floor(random() * list.length)] : null;

/**
 * The character the Cerenovus or the Pit-Hag pairs with their player
 * (target, a name or null): a role ID or null.
 * - The Cerenovus: mostly a character another player claimed, so the mad
 *   one claims it too and the town doubts them both; else any Townsfolk.
 * - The Pit-Hag: an Outsider nobody claimed (it may not be in play), and
 *   from night 3 now and then a Demon, for arbitrary deaths.
 */
export const pairRole = (
  me,
  target,
  { scriptRoles = [], claims = {}, nightCount = 1, random = Math.random } = {},
) => {
  const role = me.role || {};
  const usable = scriptRoles.filter(
    ({ id }) => id !== role.id && !NEVER.includes(id),
  );
  const townsfolk = usable.filter(({ team }) => team === "townsfolk");
  const taken = Object.values(claims);
  if (role.id === "cerenovus") {
    const claimed = Object.entries(claims)
      .filter(
        ([name, id]) =>
          name !== target &&
          name !== me.name &&
          !me.teammates.includes(name) &&
          townsfolk.some((other) => other.id === id),
      )
      .map(([, id]) => id);
    if (claimed.length && random() < 0.6) return pickOne(claimed, random);
    const picked = pickOne(townsfolk, random);
    return picked ? picked.id : null;
  }
  if (role.id === "pithag") {
    const demons = usable.filter(({ team }) => team === "demon");
    if (nightCount >= 3 && demons.length && random() < PITHAG_DEMON) {
      return pickOne(demons, random).id;
    }
    const free = (team) =>
      usable.filter(
        (other) => other.team === team && !taken.includes(other.id),
      );
    const picked =
      pickOne(free("outsider"), random) || pickOne(free("townsfolk"), random);
    return picked ? picked.id : null;
  }
  return null;
};

/**
 * The Cerenovus and the Pit-Hag: a player and a character at once.
 * Returns { seats: [name], role } or null.
 */
export const pairOf = (me, context) => {
  const chosen = chooseSeats(me, context.players, 1, context);
  if (!chosen) return null;
  const role = pairRole(me, chosen.seats[0], context);
  return role ? { seats: chosen.seats, role } : null;
};

/**
 * Yes or no to "Do you use your ability?": a once-per-game ability gets
 * used more as the nights go by; the Philosopher wants one straight away.
 */
export const useAbility = (
  me,
  { nightCount = 1, players = [], random = Math.random } = {},
) => {
  const role = me.role || {};
  if (role.id === "philosopher") return random() < 0.8;
  // the Professor waits for someone to bring back
  if (role.id === "professor") {
    const dead = players.filter(
      ({ name, isDead }) => isDead && name !== me.name,
    );
    return dead.length > 0 && random() < 0.6;
  }
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
 * The Gambler: a player and a guess at their character. They mostly bet on
 * someone they believe, guessing what that player claimed (if they live,
 * the claim is true); when quite sure of someone, or with nobody to
 * believe, on whoever they doubt most being the Demon. Returns { seats: [name], guess: role ID } or null.
 */
export const gamble = (
  me,
  {
    players,
    scores = null,
    claims = {},
    scriptRoles = [],
    random = Math.random,
  },
) => {
  const others = players
    .filter(({ name, isDead }) => name !== me.name && !isDead)
    .map(nameOf);
  const known = (id) => scriptRoles.some((role) => role.id === id);
  const believed = ranked(others, scores, random, true).filter(
    (name) =>
      claims[name] &&
      known(claims[name]) &&
      (!scores || (scores[name] || 0) < 1),
  );
  const doubted = ranked(others, scores, random)[0];
  // on the Demon only when quite sure: a wrong guess kills them
  const sure = !!doubted && !!scores && (scores[doubted] || 0) >= 1.5;
  if (believed.length && (!sure || random() < 0.7)) {
    return { seats: [believed[0]], guess: claims[believed[0]] };
  }
  const demons = scriptRoles.filter(({ team }) => team === "demon");
  const townsfolk = scriptRoles.filter(
    ({ team, id }) => team === "townsfolk" && id !== me.role.id,
  );
  const guesses = demons.length ? demons : townsfolk;
  if (!doubted || !guesses.length) return null;
  return {
    seats: [doubted],
    guess: guesses[Math.floor(random() * guesses.length)].id,
  };
};

/**
 * The Po: some nights no-one, to choose 3 players the next night (an
 * unanswered card last time). Returns { nobody: true }, { seats: [name],
 * more: [two names] } (the other two, said in the chat: a card only takes
 * one or two seats) or null to choose like any Demon.
 */
export const poChoice = (me, context) => {
  const { nightCount = 1, random = Math.random } = context;
  if (nightCount < 2) return null;
  if (me.skipped) {
    const three = chooseSeats(me, context.players, 3, context);
    if (three)
      return { seats: three.seats.slice(0, 1), more: three.seats.slice(1) };
    return null;
  }
  return random() < PO_CHARGE ? { nobody: true } : null;
};

/**
 * What a made-up player answers to a card, or null when it asks nothing:
 * { seats: [names] } (with the Gambler's `guess`, a role ID, the Po's
 * `more`, two more names, or the Cerenovus' and Pit-Hag's `role`),
 * { nobody: true } (the Po chooses no-one), { roleId } (with the
 * Cerenovus' and Pit-Hag's `target`, a name) or { answer: "yes" | "no" }.
 */
export const decide = (me, card, context) => {
  if (!card) return null;
  if (card.phrase === "pointAtPlayer") return pointAt(me, context);
  const seats = SEATS_TO_CHOOSE[card.phrase];
  const role = me.role || {};
  if (seats === 1 && role.id === "gambler") {
    const bet = gamble(me, context);
    if (bet) return bet;
  }
  if (seats === 1 && role.id === "po" && me.alignment === "evil") {
    const po = poChoice(me, context);
    if (po) return po;
  }
  const pairs = PAIRS.includes(role.id) && me.alignment === "evil";
  if (seats === 1 && pairs) {
    const pair = pairOf(me, context);
    if (pair) return pair;
  }
  if (seats) return chooseSeats(me, context.players, seats, context);
  const phrases = [card.phrase, ...partsOf(card).map(({ phrase }) => phrase)];
  if (phrases.includes("chooseCharacter") && pairs) {
    // the character on the card, the player in the chat
    const pair = pairOf(me, context);
    if (pair) return { roleId: pair.role, target: pair.seats[0] };
  }
  if (phrases.includes("chooseCharacter")) {
    const roleId = chooseCharacter(me, context.scriptRoles, context);
    return roleId ? { roleId } : null;
  }
  if (phrases.includes("useAbility")) {
    return { answer: useAbility(me, context) ? "yes" : "no" };
  }
  return null;
};
