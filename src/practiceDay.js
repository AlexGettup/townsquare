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
 *
 * Sects & Violets: the Juggler guesses on their first day, the Savant visits
 * the storyteller each day, the Artist asks one question, the Klutz chooses
 * when they learn they died, a player the Cerenovus made mad claims that
 * character the next day, the Mutant never claims an Outsider. With the
 * Vortox on the script the good want an execution every day.
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
// on a careful day (isCarefulDay) the good only execute when this sure
const CAREFUL_SURE = 2.5;
// with the Vortox on the script and nobody about to die: no execution today
// loses the game, so on the last call they nominate and vote much sooner
export const VORTOX_NOMINATE = 0.3;
const VORTOX_VOTE = 0.6;
// the Artist asks once they doubt someone this much (or now and then from
// day 3)
const ARTIST_SURE = 1.2;
// the Juggler: up to this many guesses
const JUGGLES = 5;

const GOOD_TEAMS = ["townsfolk", "outsider"];
const EVIL_TEAMS = ["minion", "demon"];

/**
 * Three players alive, one of them claimed the Mayor: no execution wins
 * for the good (if the Mayor is real), so they hold back.
 * players: [{ name, isDead }]; claims: name -> role ID.
 */
export const isMayorStandoff = (players, claims) => {
  const alive = players.filter(({ isDead }) => !isDead);
  return (
    alive.length === 3 && alive.some(({ name }) => claims[name] === "mayor")
  );
};

/**
 * A day when the good hold back and only execute when very sure: the
 * Mayor's standoff, or 4 alive (a wrong execution leaves 3, the Demon kills
 * at night and 2 are left: the evil win). players: [{ name, isDead }].
 */
export const isCarefulDay = (players, claims) =>
  isMayorStandoff(players, claims) ||
  players.filter(({ isDead }) => !isDead).length === 4;

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
  const role = me.role.id;
  cards.forEach(({ card, choice }) => {
    if (!card) return;
    partsOf(card).forEach((part) => {
      const teamsOf = part.roles
        .map((id) => (roleById(id) || {}).team)
        .filter(Boolean);
      // the Dreamer: 1 good and 1 evil character, one of them true
      if (
        role === "dreamer" &&
        teamsOf.some((team) => GOOD_TEAMS.includes(team)) &&
        teamsOf.some((team) => EVIL_TEAMS.includes(team))
      ) {
        const about = part.players.length ? part.players : lastChoice;
        about.forEach((name) => add(scores, name, 1));
        return;
      }
      // the Sage: the Demon is one of these two
      if (role === "sage" && part.players.length === 2 && !teamsOf.length) {
        part.players.forEach((name) => add(scores, name, 1.75));
        return;
      }
      // the Seamstress: "no", the two are not on the same side
      if (role === "seamstress" && part.answer && lastChoice.length === 2) {
        if (part.answer === "no") {
          lastChoice.forEach((name) => add(scores, name, 1));
        }
        return;
      }
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
        // one good player shown alone (the Grandmother's grandchild) is
        // trusted for sure; one of two (the Washerwoman's) only a little.
        // An evil player shown a good one (the Evil Twin's twin) pushes them
        const alone = me.alignment === "evil" ? 2 : -2;
        const good = part.players.length === 1 ? alone : -0.5;
        part.players.forEach((name) =>
          add(scores, name, evil ? 2.5 / part.players.length + 0.5 : good),
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
  // the Saint: executing them loses the game, so the good leave them be
  Object.entries(claims).forEach(([name, roleId]) => {
    if (name !== me.name && roleId === "saint" && me.alignment === "good") {
      add(scores, name, -1.2);
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
 * claims: name -> role ID; hasBlock: someone is already about to die;
 * careful: isCarefulDay().
 */
export const nominationOf = (
  me,
  scores,
  { nominees, opinion, claims, hasBlock, careful, random = Math.random },
) => {
  const options = nominees.filter((name) => name !== me.name);
  if (!options.length) return null;
  const extra = hasBlock ? BLOCK_EXTRA : 0;
  // the good: only someone they are very sure of on a careful day
  const carefulExtra =
    careful && me.alignment !== "evil" ? CAREFUL_SURE - 1 : 0;
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
        score:
          (opinion[name] || 0) * 0.7 +
          (scores[name] || 0) * 0.5 +
          // a claimed Saint executed wins the game for them
          (claims[name] === "saint" ? 1 : 0),
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
  return { target: name, score: score - extra - carefulExtra, reason };
};

/**
 * Why their own execution would lose the game for their team: "demon",
 * "saint" or "final" (a good player with 3 alive: 2 would be left), or
 * null. They know it from their character (their token or the last "You
 * are" card); alive: how many are alive.
 */
export const deathLoses = (me, alive) => {
  if (me.alignment === "evil" && me.role.team === "demon") return "demon";
  if (me.alignment === "good" && me.role.id === "saint") return "saint";
  if (me.alignment === "good" && alive === 3) return "final";
  return null;
};

/**
 * The one about to die today, if any: the name alone at the top of
 * votesToBeat (a tie means nobody is about to die).
 */
export const condemnedOf = (block) =>
  block && block.nominees.length === 1 ? block.nominees[0] : null;

/**
 * Someone about to die whose death loses the game for them tries to get
 * off the block: they nominate whoever the town doubts most (the one most
 * likely to tie or beat their vote), not a teammate they know of. Returns
 * { target, reason } (reason from deathLoses) or null.
 *
 * condemned: condemnedOf(); nominees: names that can be nominated now;
 * opinion: townOpinion(); alive: how many are alive.
 */
export const escapeOf = (
  me,
  scores,
  { condemned, nominees, opinion, alive },
) => {
  if (condemned !== me.name) return null;
  const reason = deathLoses(me, alive);
  if (!reason) return null;
  const options = nominees.filter(
    (name) => name !== me.name && !me.teammates.includes(name),
  );
  if (!options.length) return null;
  const target = options
    .map((name) => ({
      name,
      score: (opinion[name] || 0) + (scores[name] || 0) * 0.3,
    }))
    .sort((a, b) => b.score - a.score)[0].name;
  return { target, reason };
};

/**
 * Do they want whoever is about to die swapped for anyone else? The
 * condemned themselves (if their death loses), the evil if it's the Demon
 * they know of, the good if it's a claimed Saint they believe, or anyone
 * they believe with 3 alive.
 */
export const wantsSwap = (me, scores, { condemned, claims, alive }) => {
  if (!condemned) return false;
  if (condemned === me.name) return !!deathLoses(me, alive);
  if (me.alignment === "evil") return me.demons.includes(condemned);
  const believed = (scores[condemned] || 0) < 1;
  return believed && (claims[condemned] === "saint" || alive === 3);
};

/**
 * Do they raise their hand? nominee and nominator are names; dead: they
 * would spend their ghost vote; opinion: townOpinion(); mayor: the Mayor's
 * standoff; careful: isCarefulDay(); swap: they want
 * whoever is about to die off the block (wantsSwap); mustExecute: the
 * Vortox is on the script and nobody is about to die yet.
 */
export const votesFor = (
  me,
  scores,
  {
    nominee,
    nominator,
    dead,
    opinion,
    mayor,
    careful,
    swap,
    mustExecute = false,
    random = Math.random,
  },
) => {
  if (nominator === me.name && !mayor) return true;
  if (nominee === me.name) return false;
  // anyone but the one about to die (see wantsSwap)
  if (swap) return true;
  const score = (scores[nominee] || 0) + (opinion[nominee] || 0) * 0.3;
  if (me.alignment === "evil") {
    if (me.teammates.includes(nominee)) return random() < SACRIFICE;
    if (dead) return random() < 0.15;
    return (
      random() <
      EVIL_YES + Math.min(Math.max(opinion[nominee] || 0, 0), 1) * 0.3
    );
  }
  if (mustExecute && !dead) return score + random() * 0.5 >= VORTOX_VOTE;
  if (careful) return score >= CAREFUL_SURE;
  if (dead) return score >= GHOST_SURE;
  return score + random() * 0.5 >= 1.1;
};

/**
 * The character they say they are: their own if good; if evil, one of the
 * characters "not in play" they were given, or else a Townsfolk of the
 * script nobody claimed yet (a good Mutant too). Mad about a character
 * (mad, a role ID): that one. Returns a role ID or null.
 */
export const claimFor = (
  me,
  { scriptRoles, claims, mad = null, random = Math.random },
) => {
  // mad about a character (the Cerenovus): they claim it, or might die
  if (mad) return mad;
  // the Mutant can't say they are an Outsider: they claim a Townsfolk
  const mutant = me.alignment !== "evil" && me.role.id === "mutant";
  if (me.alignment !== "evil" && !mutant) return me.role.id || null;
  const taken = Object.values(claims);
  const bluffs = mutant ? [] : me.bluffs.filter((id) => !taken.includes(id));
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

/**
 * The Gossip's public statement today: whom they say is the Demon (a name)
 * or null. Each day at most once (the caller remembers it); when they doubt
 * someone enough, or now and then from day 2 to see what happens. The
 * storyteller decides if it was true.
 */
export const gossipStatement = (
  me,
  scores,
  { alive, day, random = Math.random },
) => {
  if (me.role.id !== "gossip" || me.alignment !== "good") return null;
  const options = alive.filter((name) => name !== me.name);
  if (!options.length) return null;
  const best = [...options].sort(
    (a, b) => (scores[b] || 0) - (scores[a] || 0),
  )[0];
  if ((scores[best] || 0) >= 1.2 && random() < 0.7) return best;
  if (day >= 2 && random() < 0.3) return best;
  return null;
};

/**
 * The Moonchild learns they died: the alive player they choose in public
 * (a name) or null. Good: whoever they doubt most (if it's a good player,
 * that one dies tonight). Evil: whoever the town trusts most, not a
 * teammate they know of.
 */
export const moonchildChoice = (me, scores, { alive, opinion = {} }) => {
  if (me.role.id !== "moonchild") return null;
  const options = alive.filter((name) => name !== me.name);
  if (me.alignment === "evil") {
    const good = options.filter((name) => !me.teammates.includes(name));
    return (
      [...good].sort((a, b) => (opinion[a] || 0) - (opinion[b] || 0))[0] || null
    );
  }
  return (
    [...options].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))[0] || null
  );
};

/**
 * The Klutz learns they died: the alive player they choose in public (a
 * name) or null. If that one is evil, their team loses: the good choose
 * whoever they trust most, an evil Klutz a player not on their side.
 */
export const klutzChoice = (me, scores, { alive }) => {
  if (me.role.id !== "klutz") return null;
  const options = alive.filter(
    (name) => name !== me.name && !me.teammates.includes(name),
  );
  return (
    [...options].sort((a, b) => (scores[a] || 0) - (scores[b] || 0))[0] || null
  );
};

/**
 * The Juggler's guesses on their first day: [{ name, roleId }] or null.
 * What the players they believe claimed, and the one they doubt most as a
 * Demon of the script, up to 5.
 */
export const jugglerGuesses = (
  me,
  scores,
  { alive, claims, scriptRoles, random = Math.random },
) => {
  if (me.role.id !== "juggler" || me.alignment !== "good") return null;
  const known = (id) => scriptRoles.some((role) => role.id === id);
  const others = alive.filter((name) => name !== me.name);
  const guesses = others
    .filter(
      (name) => claims[name] && known(claims[name]) && (scores[name] || 0) < 1,
    )
    .sort((a, b) => (scores[a] || 0) - (scores[b] || 0))
    .slice(0, JUGGLES - 1)
    .map((name) => ({ name, roleId: claims[name] }));
  const demons = scriptRoles.filter(({ team }) => team === "demon");
  const doubted = others
    .filter((name) => !guesses.some((guess) => guess.name === name))
    .sort((a, b) => (scores[b] || 0) - (scores[a] || 0))[0];
  if (doubted && (scores[doubted] || 0) >= 1 && demons.length) {
    const demon = demons[Math.floor(random() * demons.length)];
    guesses.push({ name: doubted, roleId: demon.id });
  }
  return guesses.length ? guesses : null;
};

/**
 * The Artist's one question today: whom they ask about ("is X the
 * Demon?"), a name, or null. Once per game (the caller remembers it).
 */
export const artistQuestion = (
  me,
  scores,
  { alive, day, random = Math.random },
) => {
  if (me.role.id !== "artist" || me.alignment !== "good") return null;
  const options = alive.filter((name) => name !== me.name);
  if (!options.length) return null;
  const best = [...options].sort(
    (a, b) => (scores[b] || 0) - (scores[a] || 0),
  )[0];
  if ((scores[best] || 0) >= ARTIST_SURE) return best;
  if (day >= 3 && random() < 0.4) return best;
  return null;
};

/**
 * The first "yes" or "no" on a card sent after the Artist's question (from:
 * how many cards they had then), or null.
 */
export const answerAfter = (cards, from) => {
  for (const { card } of cards.slice(from)) {
    if (!card) continue;
    const part = partsOf(card).find(({ answer }) => answer);
    if (part) return part.answer;
  }
  return null;
};

/**
 * The character the Cerenovus made them mad about, from these cards (the
 * ones from last night): a card showing the Cerenovus and another
 * character. A role ID or null.
 */
export const madnessIn = (cards) => {
  let mad = null;
  cards.forEach(({ card }) => {
    if (!card) return;
    const roles = partsOf(card)
      .filter(({ phrase }) => phrase !== "notInPlay")
      .flatMap(({ roles }) => roles);
    if (!roles.includes("cerenovus")) return;
    const other = roles.find((id) => id !== "cerenovus");
    if (other) mad = other;
  });
  return mad;
};
