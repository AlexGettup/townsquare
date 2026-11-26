/**
 * Practice game, by day: what the made-up players think of each other, what
 * they say in the town square, whom they nominate and how they vote. Like
 * src/practiceBrain.js, from what each one knows and nothing more, and kept
 * apart from Vue and the store.
 *
 * Suspicion: a number per player, from a hunch rolled each morning (0 to 0.8)
 * plus what the storyteller told them at night (a "yes" from the Fortune
 * Teller, the Empath's number, "one of these two is the Poisoner") and what
 * others claimed (someone claiming their own character). Around 1 they
 * would nominate or vote, from 2 they are fairly sure.
 *
 * The evil players know who is on their side only from their cards. They
 * push on good players the town already doubts and protect their teammates,
 * but now and then vote or nominate one of them to look good.
 */

import { partsOf } from "./cards";

// the biggest morning hunch about someone, with nothing else to go on
const HUNCH = 0.8;
// how sure they need to be to nominate, when nominations open and on the
// storyteller's second and last call
export const NOMINATE_AT = {
  nominationsOpen: 1,
  secondCall: 0.9,
  lastCall: 0.75,
};
// with someone already about to die, they need to be this much surer
const BLOCK_EXTRA = 0.5;
// an evil player votes for (or nominates) a teammate to look good
export const SACRIFICE = 0.15;
// an evil player raises a hand against a good one
const EVIL_YES = 0.55;
// a dead player spends their only vote only when this sure
const GHOST_SURE = 2;
// the Slayer shoots once they are this sure, or at random from day 3
const SLAYER_SURE = 2;

const add = (scores, name, amount) => {
  if (name in scores) scores[name] += amount;
};

/** A new morning hunch about everyone else: name -> 0..HUNCH. */
export const rollHunches = (me, players, random = Math.random) => {
  const hunches = {};
  players.forEach(({ name }) => {
    if (name !== me.name) hunches[name] = random() * HUNCH;
  });
  return hunches;
};

/**
 * What a made-up player thinks of the others: name -> suspicion.
 *
 * me: from knowledgeOf (practiceBrain.js); cards: [{ card, choice }] sent to
 * them, oldest first; players: [{ name, isDead }] in seat order; hunches:
 * from rollHunches; claims: name -> role ID claimed in the town square;
 * roleById(id): a character.
 */
export const suspicionsOf = (
  me,
  { cards, players, hunches, claims, roleById },
) => {
  const scores = {};
  players.forEach(({ name, isDead }) => {
    if (name === me.name) return;
    // killed at night: most likely good
    scores[name] = (hunches[name] || 0) - (isDead ? 1 : 0);
  });
  let lastChoice = [];
  cards.forEach(({ card, choice }) => {
    if (!card) return;
    partsOf(card).forEach((part) => {
      if (
        ["youAre", "thisIsTheDemon", "theseAreYourMinions"].includes(
          part.phrase,
        )
      )
        return;
      const teams = part.roles
        .map((id) => (roleById(id) || {}).team)
        .filter(Boolean);
      if (part.players.length && teams.length) {
        const evil = teams.some(
          (team) => team === "minion" || team === "demon",
        );
        part.players.forEach((name) =>
          add(scores, name, evil ? 2.5 / part.players.length + 0.5 : -0.5),
        );
      }
      // a yes or no about the players they chose (Fortune Teller)
      if (part.answer && lastChoice.length) {
        lastChoice.forEach((name) =>
          add(scores, name, part.answer === "yes" ? 2 : -1),
        );
      }
      // the Empath's number about their alive neighbours
      if (
        part.number !== null &&
        part.number !== undefined &&
        me.role.id === "empath"
      ) {
        neighboursOf(me.name, players).forEach((name) =>
          add(scores, name, part.number ? part.number * 1.2 : -1.5),
        );
      }
    });
    if (choice && choice.length) lastChoice = choice;
  });
  // someone else claims their character: one of them lies, and it isn't them
  const mine = me.role.id;
  Object.entries(claims).forEach(([name, roleId]) => {
    if (name !== me.name && roleId === mine && me.alignment === "good") {
      add(scores, name, 3);
    }
  });
  // evil: their teammates are never suspects
  me.teammates.forEach((name) => {
    if (name in scores) scores[name] = -5;
  });
  return scores;
};

/** The two closest alive players on each side (the Empath's neighbours). */
export const neighboursOf = (name, players) => {
  const seat = players.findIndex((player) => player.name === name);
  if (seat < 0) return [];
  const found = [];
  [1, -1].forEach((step) => {
    for (let n = 1; n < players.length; n++) {
      const other =
        players[(seat + step * n + players.length) % players.length];
      if (other.name === name) break;
      if (!other.isDead) {
        if (!found.includes(other.name)) found.push(other.name);
        break;
      }
    }
  });
  return found;
};

/** The town's opinion: the average suspicion of each player. */
export const townOpinion = (allScores) => {
  const sums = {};
  const counts = {};
  allScores.forEach((scores) =>
    Object.entries(scores).forEach(([name, score]) => {
      sums[name] = (sums[name] || 0) + score;
      counts[name] = (counts[name] || 0) + 1;
    }),
  );
  const opinion = {};
  Object.keys(sums).forEach(
    (name) => (opinion[name] = sums[name] / counts[name]),
  );
  return opinion;
};

/**
 * How much they want to nominate, and whom: { target, score, reason } or
 * null. reason: "info" (their night info points there), "sameClaim",
 * "hunch" or "sacrifice" (evil nominating a teammate).
 *
 * nominees: names that can be nominated now; opinion: townOpinion();
 * claims: name -> role ID; hasBlock: someone is already about to die.
 */
export const nominationOf = (
  me,
  scores,
  { nominees, opinion, claims, hasBlock, random = Math.random },
) => {
  const options = nominees.filter((name) => name !== me.name);
  if (!options.length) return null;
  const extra = hasBlock ? BLOCK_EXTRA : 0;
  if (me.alignment === "evil") {
    const doubted = options.filter((name) => me.teammates.includes(name));
    const mostDoubted = doubted.sort(
      (a, b) => (opinion[b] || 0) - (opinion[a] || 0),
    )[0];
    if (
      mostDoubted &&
      (opinion[mostDoubted] || 0) > 1.2 &&
      random() < SACRIFICE
    ) {
      return { target: mostDoubted, score: 2, reason: "sacrifice" };
    }
    const good = options.filter((name) => !me.teammates.includes(name));
    if (!good.length) return null;
    // where the town already looks, with their own hunch
    const ranked = good
      .map((name) => ({
        name,
        score: (opinion[name] || 0) * 0.7 + (scores[name] || 0) * 0.5,
      }))
      .sort((a, b) => b.score - a.score);
    return {
      target: ranked[0].name,
      score: ranked[0].score - extra,
      reason: "hunch",
    };
  }
  const ranked = options
    .map((name) => ({
      name,
      score: (scores[name] || 0) + (opinion[name] || 0) * 0.3,
    }))
    .sort((a, b) => b.score - a.score);
  const { name, score } = ranked[0];
  const reason =
    claims[name] && claims[name] === me.role.id
      ? "sameClaim"
      : (scores[name] || 0) > 1.5
        ? "info"
        : "hunch";
  return { target: name, score: score - extra, reason };
};

/**
 * Do they raise their hand? nominee and nominator are names; dead: they
 * would spend their ghost vote; block: { count } of who is about to die, or
 * null; opinion: townOpinion().
 */
export const votesFor = (
  me,
  scores,
  { nominee, nominator, dead, opinion, random = Math.random },
) => {
  if (nominator === me.name) return true;
  if (nominee === me.name) return false;
  const score = (scores[nominee] || 0) + (opinion[nominee] || 0) * 0.3;
  if (me.alignment === "evil") {
    if (me.teammates.includes(nominee)) return random() < SACRIFICE;
    if (dead) return random() < 0.15;
    return (
      random() <
      EVIL_YES + Math.min(Math.max(opinion[nominee] || 0, 0), 1) * 0.3
    );
  }
  if (dead) return score >= GHOST_SURE;
  return score + random() * 0.5 >= 1.1;
};

/**
 * The character they say they are: their own if good; if evil, one of the
 * characters "not in play" they were given, or else a Townsfolk of the
 * script nobody claimed yet. Returns a role ID or null.
 */
export const claimFor = (me, { scriptRoles, claims, random = Math.random }) => {
  if (me.alignment !== "evil") return me.role.id || null;
  const taken = Object.values(claims);
  const bluffs = me.bluffs.filter((id) => !taken.includes(id));
  if (bluffs.length) return bluffs[Math.floor(random() * bluffs.length)];
  const free = scriptRoles.filter(
    ({ id, team }) =>
      team === "townsfolk" && id !== me.role.id && !taken.includes(id),
  );
  if (!free.length) return null;
  return free[Math.floor(random() * free.length)].id;
};

/**
 * The Slayer shoots today? Their target (a name) or null. Once per game:
 * the caller remembers it was used. Day is the day number.
 */
export const slayerShot = (
  me,
  scores,
  { alive, day, random = Math.random },
) => {
  if (me.role.id !== "slayer" || me.alignment !== "good") return null;
  const options = alive.filter((name) => name !== me.name);
  if (!options.length) return null;
  const best = options.sort((a, b) => (scores[b] || 0) - (scores[a] || 0))[0];
  if ((scores[best] || 0) >= SLAYER_SURE) return best;
  if (day >= 3 && random() < 0.35) return best;
  return null;
};
