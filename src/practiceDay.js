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
import { PERSONALITIES } from "./practicePersonality";

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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** One of the list at random, or null when it is empty. */
export const pickOne = (list, random = Math.random) =>
  list.length ? list[Math.floor(random() * list.length)] : null;

/**
 * The name they doubt most (the highest score), or the one they trust most
 * (the lowest), the first of the list on a tie; null when none.
 */
export const mostDoubted = (names, scores) =>
  [...names].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))[0] || null;
export const mostTrusted = (names, scores) =>
  [...names].sort((a, b) => (scores[a] || 0) - (scores[b] || 0))[0] || null;

// what one source can move someone's suspicion, at most: their own night
// info (the Empath's numbers night after night don't add up for ever)...
const OWN_INFO = [-3, 4.5];
// ...and what they heard in the town square
const HEARD_INFO = [-2.5, 3.5];
// someone they doubt this little is someone they trust (their info and a
// pair they appear in)
const TRUSTED = -0.8;

/**
 * A new morning hunch about everyone else: name -> 0..size (the
 * personality's hunch).
 */
export const rollHunches = (
  me,
  players,
  random = Math.random,
  size = HUNCH,
) => {
  const hunches = {};
  players.forEach(({ name }) => {
    if (name !== me.name) hunches[name] = random() * size;
  });
  return hunches;
};

/**
 * The lines of night info a player has, ready to be read (their own, or
 * what someone said in the town square): [{ phrase, players, roles,
 * number, answer, about, neighbours }]. `about`: the players they had
 * chosen (a Fortune Teller's yes or no is about them); `neighbours`: their
 * alive neighbours when they got it (the Empath's number is about them).
 *
 * cards: [{ card, choice, at }]; seatsAt(at): the seats as they were then.
 */
export const infoOf = (name, cards, seatsAt) => {
  let lastChoice = [];
  const lines = [];
  cards.forEach(({ card, choice, at }) => {
    if (!card) return;
    partsOf(card).forEach((part) => {
      if (SECRET.includes(part.phrase)) return;
      lines.push({
        ...part,
        about: lastChoice,
        neighbours: neighboursOf(name, seatsAt(at)),
      });
    });
    if (choice && choice.length) lastChoice = choice;
  });
  return lines;
};

// lines only the evil team sees, never read as info about others
const SECRET = ["youAre", "thisIsTheDemon", "theseAreYourMinions", "notInPlay"];

/**
 * What one line of night info says about each player: name -> amount (more
 * is more suspicious). role: the character who learned it (the real one,
 * or the one claimed by whoever told it); self: who learned it; claims:
 * name -> role ID claimed; trusted(name): whoever reads it trusts them;
 * logic: how much they reason with it (the personality); evilReader: an
 * evil player shown a good one pushes them instead (the Evil Twin).
 */
export const evidenceOf = (
  line,
  { role, self, claims, roleById, trusted, logic, evilReader = false },
) => {
  const found = {};
  const put = (name, amount) => {
    if (name === self) return;
    found[name] = (found[name] || 0) + amount;
  };
  const teams = line.roles.map((id) => (roleById(id) || {}).team);
  const isGood = (team) => GOOD_TEAMS.includes(team);
  const isEvil = (team) => EVIL_TEAMS.includes(team);
  const about = line.players.length ? line.players : line.about || [];
  // the Dreamer: 1 good and 1 evil character, one of them true
  if (role === "dreamer" && teams.some(isGood) && teams.some(isEvil)) {
    about.forEach((name) => put(name, 1));
    return found;
  }
  // the Sage: the Demon is one of these two
  if (role === "sage" && line.players.length === 2 && !teams.length) {
    line.players.forEach((name) => put(name, 1.75));
    return found;
  }
  // the Seamstress: "no", the two are not on the same side
  if (role === "seamstress" && line.answer && about.length === 2) {
    if (line.answer === "no") about.forEach((name) => put(name, 1));
    return found;
  }
  if (line.players.length && teams.length && teams.every(Boolean)) {
    const shown = line.players;
    if (teams.some(isEvil)) {
      // "one of these is the Poisoner": all on the other one if they trust
      // one of them
      const sure = shown.filter((name) => trusted(name));
      if (shown.length === 2 && sure.length === 1 && logic >= 0.5) {
        put(
          shown.find((name) => !sure.includes(name)),
          2.5,
        );
      } else {
        shown.forEach((name) => put(name, 2.5 / shown.length + 0.5));
      }
    } else if (shown.length === 1) {
      // one good player shown alone (the Grandmother's grandchild) is
      // trusted for sure; an evil player shown a good one (the Evil Twin's
      // twin) pushes them
      put(shown[0], evilReader ? 2 : -2);
    } else {
      // "one of these is the Chef": the one who claimed it is almost sure,
      // someone else claiming it lies (or is the Spy)
      const roleId = line.roles[0];
      const claimants = Object.keys(claims).filter(
        (name) => claims[name] === roleId && name !== self,
      );
      const inside = claimants.filter((name) => shown.includes(name));
      if (inside.length === 1) {
        put(inside[0], -(1 + 1.5 * logic));
      } else {
        shown.forEach((name) => put(name, -0.5));
      }
      claimants
        .filter((name) => !shown.includes(name))
        .forEach((name) => put(name, 1.5 * logic));
    }
  }
  // a yes or no about the players they chose (the Fortune Teller): a "yes"
  // with one they trust (or themselves) is all on the other
  if (line.answer && about.length) {
    if (line.answer === "yes") {
      const sure = about.filter((name) => name === self || trusted(name));
      const rest = about.filter((name) => !sure.includes(name));
      const all = sure.length && rest.length && logic >= 0.5;
      rest.forEach((name) => put(name, all ? 3 : 2));
    } else {
      about.forEach((name) => put(name, -1));
    }
  }
  const hasNumber = line.number !== null && line.number !== undefined;
  // the Empath's number about their alive neighbours that night
  if (hasNumber && role === "empath" && line.neighbours) {
    const near = line.neighbours;
    if (!line.number) near.forEach((name) => put(name, -1.5));
    else {
      const sure = near.filter((name) => trusted(name));
      if (line.number === 1 && sure.length === 1 && logic >= 0.5) {
        put(
          near.find((name) => !sure.includes(name)),
          2.4,
        );
      } else near.forEach((name) => put(name, line.number * 1.2));
    }
  }
  // the Librarian's 0: no Outsiders in play, whoever claims one lies
  if (hasNumber && !line.number && role === "librarian") {
    Object.keys(claims).forEach((name) => {
      if ((roleById(claims[name]) || {}).team === "outsider") {
        put(name, 1.5 * logic);
      }
    });
  }
  return found;
};

/**
 * What everyone said they learned in the town square (statements: [{
 * speaker, roleId, lines }]), as heard by `me`: name -> amount. Each one
 * counts as much as they believe the speaker (their trust, less the more
 * they doubt them). Info pointing at them, a good player, makes them doubt
 * whoever said it.
 */
const heardBy = (me, statements, base, context) => {
  const { traits, claims, roleById } = context;
  const heard = {};
  // all that each one told, read together (their Empath numbers night
  // after night are one reading each)
  const told = {};
  statements.forEach(({ speaker, roleId, lines }) => {
    if (speaker === me.name || !(speaker in base)) return;
    if (!told[speaker] || told[speaker].roleId !== roleId) {
      told[speaker] = { roleId, lines: [] };
    }
    told[speaker].lines.push(...lines);
  });
  Object.entries(told).forEach(([speaker, { roleId, lines }]) => {
    const belief = traits.trust * clamp(1 - base[speaker] / 2, 0, 1.2);
    const found = readAll(lines, {
      role: roleId,
      self: speaker,
      claims,
      roleById,
      trusted: (name) => name === me.name || (base[name] || 0) < TRUSTED,
      logic: traits.logic,
    });
    Object.entries(found).forEach(([name, amount]) => {
      if (name === me.name) {
        // "you are evil", to a good player: the speaker lies or is wrong
        if (amount > 0.5 && me.alignment === "good") {
          heard[speaker] = (heard[speaker] || 0) + 0.6 + 0.6 * traits.logic;
        }
        return;
      }
      heard[name] = (heard[name] || 0) + amount * belief;
    });
  });
  return heard;
};

/**
 * All the lines of one player's info read together: name -> amount. The
 * Empath's numbers are averaged over the nights each player sat next to
 * them, not added up (a "1" three nights running is the same "1").
 */
const readAll = (lines, context) => {
  const total = {};
  const readings = {};
  lines.forEach((line) => {
    const found = evidenceOf(line, context);
    const nightly =
      context.role === "empath" &&
      line.number !== null &&
      line.number !== undefined;
    Object.entries(found).forEach(([name, amount]) => {
      if (nightly) (readings[name] = readings[name] || []).push(amount);
      else total[name] = (total[name] || 0) + amount;
    });
  });
  Object.entries(readings).forEach(([name, list]) => {
    const mean = list.reduce((sum, amount) => sum + amount, 0) / list.length;
    total[name] = (total[name] || 0) + mean;
  });
  return total;
};

/**
 * What the claims in the town square say, to `me`: name -> amount. Someone
 * claiming their own character lies; two others claiming the same one,
 * one of them lies (how much it counts: the personality's logic); a
 * claimed Saint is left alone; from day 2 someone alive who never said
 * what they are is a little suspicious (the personality's quiet).
 */
const claimsSay = (me, { claims, players, traits, day }) => {
  const said = {};
  const put = (name, amount) => (said[name] = (said[name] || 0) + amount);
  const good = me.alignment !== "evil";
  const byRole = {};
  Object.entries(claims).forEach(([name, roleId]) => {
    if (name === me.name) return;
    (byRole[roleId] = byRole[roleId] || []).push(name);
    if (good && roleId === me.role.id) put(name, 3);
    if (good && roleId === "saint") put(name, -1.2);
  });
  const alive = players.filter(({ isDead }) => !isDead).map(({ name }) => name);
  Object.values(byRole).forEach((names) => {
    const living = names.filter((name) => alive.includes(name));
    if (living.length < 2) return;
    living.forEach((name) => put(name, 0.4 + 1.2 * traits.logic));
  });
  if (day >= 2 && traits.quiet) {
    alive
      .filter((name) => name !== me.name && !claims[name])
      .forEach((name) => put(name, traits.quiet));
  }
  return said;
};

/**
 * What a made-up player thinks of the others: name -> suspicion. Around 1
 * they would nominate or vote, from 2 they are fairly sure.
 *
 * me: from knowledgeOf (practiceBrain.js); cards: [{ card, choice, at }]
 * sent to them, oldest first; players: [{ name, isDead }] in seat order;
 * hunches: from rollHunches; claims: name -> role ID claimed in the town
 * square; statements: what others said they learned ([{ speaker, roleId,
 * lines }], lines from infoOf); traits: their personality
 * (practicePersonality.js); seatsAt(at): the seats when a card came (who
 * was alive); day: the day it is; roleById(id): a character.
 */
export const suspicionsOf = (
  me,
  {
    cards,
    players,
    hunches,
    claims,
    roleById,
    statements = [],
    traits = PERSONALITIES.normal,
    seatsAt = () => players,
    day = 1,
  },
) => {
  const scores = {};
  players.forEach(({ name, isDead }) => {
    if (name === me.name) return;
    // killed at night: most likely good
    scores[name] = (hunches[name] || 0) - (isDead ? 1 : 0);
  });
  // what the town square says about claims
  Object.entries(claimsSay(me, { claims, players, traits, day })).forEach(
    ([name, amount]) => add(scores, name, amount),
  );
  // their own night info, read with what they trust so far
  const before = { ...scores };
  const own = readAll(infoOf(me.name, cards, seatsAt), {
    role: me.role.id,
    self: me.name,
    claims,
    roleById,
    trusted: (name) => (before[name] || 0) < TRUSTED,
    logic: traits.logic,
    evilReader: me.alignment === "evil",
  });
  Object.entries(own).forEach(([name, amount]) =>
    add(scores, name, clamp(amount * traits.weight, ...OWN_INFO)),
  );
  // what others said they learned, as much as they believe them
  const base = { ...scores };
  const heard = heardBy(me, statements, base, { traits, claims, roleById });
  Object.entries(heard).forEach(([name, amount]) =>
    add(scores, name, clamp(amount, ...HEARD_INFO)),
  );
  // evil: their teammates are never suspects
  me.teammates.forEach((name) => {
    if (name in scores) scores[name] = -5;
  });
  return scores;
};

/**
 * What the town square says of each player: claims and what was told, as
 * heard by an ordinary good player with no info of their own nor hunches.
 * It is what the evil can read of the town (not what each one thinks in
 * private), and the mood the good follow when they nominate and vote.
 */
export const publicOpinion = (context) =>
  suspicionsOf(
    {
      name: null,
      alignment: "good",
      role: {},
      teammates: [],
    },
    {
      ...context,
      cards: [],
      hunches: {},
      traits: { ...PERSONALITIES.normal, quiet: 0.2 },
    },
  );

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

/**
 * How much they want to nominate, and whom: { target, score, reason } or
 * null. reason: "info" (their night info points there), "sameClaim",
 * "hunch", "virgin" (a good player testing a claimed Virgin) or
 * "sacrifice" (evil nominating a teammate).
 *
 * nominees: names that can be nominated now; opinion: publicOpinion();
 * claims: name -> role ID; hasBlock: someone is already about to die;
 * careful: isCarefulDay(); traits: their personality (nerve: how sure they
 * need to be, follow: how much the town's mood counts, virgin: how likely
 * they test a claimed Virgin); day: the day it is; hunches: their gut
 * feelings today (a nomination by hunch doesn't say "my info").
 */
export const nominationOf = (
  me,
  scores,
  {
    nominees,
    opinion,
    claims,
    hasBlock,
    careful,
    traits = PERSONALITIES.normal,
    day = 1,
    hunches = {},
    random = Math.random,
  },
) => {
  const options = nominees.filter((name) => name !== me.name);
  if (!options.length) return null;
  const extra = (hasBlock ? BLOCK_EXTRA : 0) + traits.nerve;
  // the good: only someone they are very sure of on a careful day
  const carefulExtra =
    careful && me.alignment !== "evil" ? CAREFUL_SURE - 1 : 0;
  if (me.alignment === "evil") {
    // the teammate the town doubts most, now and then
    const mate = mostDoubted(
      options.filter((name) => me.teammates.includes(name)),
      opinion,
    );
    if (mate && (opinion[mate] || 0) > 1.2 && random() < SACRIFICE) {
      return { target: mate, score: 2, reason: "sacrifice" };
    }
    const good = options.filter((name) => !me.teammates.includes(name));
    if (!good.length) return null;
    // where the town already looks, with their own hunch
    const ranked = good
      .map((name) => ({
        name,
        score:
          (opinion[name] || 0) * (0.4 + traits.follow) +
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
  // a claimed Virgin, tested early by a Townsfolk: if the nominator is
  // executed at once, both are who they say
  const virgin = options.find(
    (name) => claims[name] === "virgin" && (scores[name] || 0) < 1,
  );
  const townsfolk = !["virgin", "saint", "recluse"].includes(me.role.id);
  if (virgin && townsfolk && day <= 2 && !hasBlock && !careful) {
    if (random() < traits.virgin * 0.5) {
      return { target: virgin, score: 1.6, reason: "virgin" };
    }
  }
  const ranked = options
    .map((name) => ({
      name,
      score: (scores[name] || 0) + (opinion[name] || 0) * traits.follow,
    }))
    .sort((a, b) => b.score - a.score);
  const { name, score } = ranked[0];
  const reason =
    claims[name] && claims[name] === me.role.id
      ? "sameClaim"
      : (scores[name] || 0) - (hunches[name] || 0) > 1.2
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
 * opinion: publicOpinion(); alive: how many are alive.
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
 * would spend their ghost vote; opinion: publicOpinion(); mayor: the Mayor's
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
    traits = PERSONALITIES.normal,
    random = Math.random,
  },
) => {
  if (nominator === me.name && !mayor) return true;
  if (nominee === me.name) return false;
  // anyone but the one about to die (see wantsSwap)
  if (swap) return true;
  const score =
    (scores[nominee] || 0) + (opinion[nominee] || 0) * traits.follow;
  if (me.alignment === "evil") {
    if (me.teammates.includes(nominee)) return random() < SACRIFICE;
    if (dead) return random() < 0.15;
    return (
      random() <
      EVIL_YES +
        traits.eager +
        Math.min(Math.max(opinion[nominee] || 0, 0), 1) * 0.3
    );
  }
  const luck = random() * traits.noise * 2 - traits.noise / 2;
  if (mustExecute && !dead) return score + luck >= VORTOX_VOTE;
  if (careful) return score >= CAREFUL_SURE;
  if (dead) return score >= GHOST_SURE;
  return score + luck >= 1.1 - traits.eager;
};

/**
 * The character they say they are: their own if good; if evil, one of the
 * characters "not in play" they were given, or else a Townsfolk of the
 * script nobody claimed yet (a good Mutant too). Mad about a character
 * (mad, a role ID): that one. Returns a role ID or null.
 */
export const claimFor = (
  me,
  {
    scriptRoles,
    claims,
    mad = null,
    traits = PERSONALITIES.normal,
    random = Math.random,
  },
) => {
  // mad about a character (the Cerenovus): they claim it, or might die
  if (mad) return mad;
  // the Mutant can't say they are an Outsider: they claim a Townsfolk
  const mutant = me.alignment !== "evil" && me.role.id === "mutant";
  if (me.alignment !== "evil" && !mutant) return me.role.id || null;
  const taken = Object.values(claims);
  // a careless bluff: a Townsfolk someone not on their side already claimed
  if (!mutant && random() < traits.slips) {
    const clash = Object.entries(claims)
      .filter(
        ([name, id]) =>
          name !== me.name &&
          !me.teammates.includes(name) &&
          scriptRoles.some(
            (role) => role.id === id && role.team === "townsfolk",
          ),
      )
      .map(([, id]) => id);
    if (clash.length) return pickOne(clash, random);
  }
  const bluffs = mutant ? [] : me.bluffs.filter((id) => !taken.includes(id));
  if (bluffs.length) return pickOne(bluffs, random);
  const free = scriptRoles.filter(
    ({ id, team }) =>
      team === "townsfolk" && id !== me.role.id && !taken.includes(id),
  );
  const picked = pickOne(free, random);
  return picked ? picked.id : null;
};

// characters whose made-up info is only told on the first day (they learn
// it on the first night), and those who tell it every day
const FIRST_NIGHT_INFO = ["washerwoman", "librarian", "investigator", "chef"];
const NIGHTLY_INFO = ["empath", "fortuneteller"];

/**
 * The night info an evil player makes up for the character they claimed,
 * so their bluff sounds like a real one: lines like those of infoOf (the
 * same shape a card has), or null when they tell nothing. How bold it is
 * comes from their personality's lies:
 * - Washerwoman: one of their teammates or a good player is the character
 *   the teammate claimed (covering them), else two players and a character
 *   one of them claimed.
 * - Librarian: 0, or two players and an Outsider.
 * - Investigator: two good players and a Minion of the script; a bold one
 *   names whoever the town trusts most.
 * - Chef: 0 or 1.
 * - Empath: 0 when a teammate sits next to them, else 1 when bold.
 * - Fortune Teller: "no" about a teammate and someone (covering them), or
 *   "yes" about two good players when bold.
 *
 * roleId: the character they claimed; players: [{ name, isDead }] in seat
 * order; claims: name -> role ID; opinion: publicOpinion(); day: the day.
 */
export const fakeInfo = (
  me,
  roleId,
  {
    players,
    claims,
    opinion = {},
    scriptRoles = [],
    day = 1,
    traits = PERSONALITIES.normal,
    random = Math.random,
  },
) => {
  if (me.alignment !== "evil" || !roleId) return null;
  if (FIRST_NIGHT_INFO.includes(roleId) && day !== 1) return null;
  if (!FIRST_NIGHT_INFO.includes(roleId) && !NIGHTLY_INFO.includes(roleId))
    return null;
  if (random() >= traits.lies) return null;
  const bold = random() < traits.lies * 0.7;
  const pick = (list) => pickOne(list, random);
  const shuffle = (list) => [...list].sort(() => random() - 0.5);
  const alive = players
    .filter(({ name, isDead }) => !isDead && name !== me.name)
    .map(({ name }) => name);
  const mates = alive.filter((name) => me.teammates.includes(name));
  const good = alive.filter((name) => !me.teammates.includes(name));
  // most trusted by the town first
  const trusted = [...good].sort(
    (a, b) => (opinion[a] || 0) - (opinion[b] || 0),
  );
  const teamOf = (id) =>
    (scriptRoles.find((role) => role.id === id) || {}).team;
  const line = (values) => ({
    phrase: null,
    roles: [],
    players: [],
    number: null,
    answer: null,
    alignment: null,
    about: [],
    neighbours: [],
    ...values,
  });
  const neighbours = neighboursOf(me.name, players);
  if (roleId === "washerwoman") {
    const mate = mates.find((name) => teamOf(claims[name]) === "townsfolk");
    const other = pick(good);
    if (mate && other) {
      return [line({ players: shuffle([mate, other]), roles: [claims[mate]] })];
    }
    const claimed = good.filter((name) => teamOf(claims[name]) === "townsfolk");
    const first = pick(claimed);
    const second = pick(good.filter((name) => name !== first));
    if (!first || !second) return null;
    return [
      line({ players: shuffle([first, second]), roles: [claims[first]] }),
    ];
  }
  if (roleId === "librarian") {
    const outsiders = scriptRoles.filter(
      ({ team, id }) => team === "outsider" && !["drunk"].includes(id),
    );
    const two = shuffle(good).slice(0, 2);
    if (!bold || !outsiders.length || two.length < 2) {
      return [line({ number: 0 })];
    }
    return [line({ players: two, roles: [pick(outsiders).id] })];
  }
  if (roleId === "investigator") {
    const minions = scriptRoles.filter(({ team }) => team === "minion");
    const first = bold ? trusted[0] : pick(good);
    const second = pick(good.filter((name) => name !== first));
    if (!minions.length || !first || !second) return null;
    return [
      line({ players: shuffle([first, second]), roles: [pick(minions).id] }),
    ];
  }
  if (roleId === "chef") return [line({ number: bold ? 1 : 0 })];
  if (roleId === "empath") {
    const covering = neighbours.some((name) => me.teammates.includes(name));
    const number = covering ? 0 : bold ? 1 : random() < 0.5 ? 1 : 0;
    return [line({ number, neighbours })];
  }
  if (roleId === "fortuneteller") {
    if (mates.length && (!bold || random() < 0.4)) {
      const other = pick(good);
      if (!other) return null;
      return [line({ answer: "no", about: shuffle([pick(mates), other]) })];
    }
    const two = bold
      ? [trusted[0], pick(good.filter((name) => name !== trusted[0]))]
      : shuffle(good).slice(0, 2);
    if (two.length < 2 || !two.every(Boolean)) return null;
    return [line({ answer: bold ? "yes" : "no", about: two })];
  }
  return null;
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
  const best = mostDoubted(options, scores);
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
  const best = mostDoubted(options, scores);
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
    return mostTrusted(good, opinion);
  }
  return mostDoubted(options, scores);
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
  return mostTrusted(options, scores);
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
  const doubted = mostDoubted(
    others.filter((name) => !guesses.some((guess) => guess.name === name)),
    scores,
  );
  if (doubted && (scores[doubted] || 0) >= 1 && demons.length) {
    guesses.push({ name: doubted, roleId: pickOne(demons, random).id });
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
  const best = mostDoubted(options, scores);
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
