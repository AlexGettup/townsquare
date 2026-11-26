/**
 * Practice game: each made-up player gets a personality at random when the
 * practice starts. It changes how they treat what they hear and how they
 * act, the same way two people with the same character play differently:
 *
 * - trust: how much they believe what others say in the town square (their
 *   claims and the info they tell). Always weighed by how much they doubt
 *   whoever says it.
 * - logic: how much they reason with what they know (two players claiming
 *   the same character, a Washerwoman's pair against who claimed what).
 * - weight: how much their own night info counts.
 * - hunch: the biggest gut feeling about someone, rolled each morning.
 * - follow: how much the town's mood counts when they nominate and vote.
 * - nerve: added to how sure they need to be to nominate (less is sooner).
 * - eager: taken off how sure they need to be to raise their hand.
 * - noise: how random their votes are.
 * - lies: as evil, how likely they make up info for their bluff (and how
 *   bold it is); as good, nothing.
 * - hides: as good, how likely they keep their character to themselves on
 *   the first day.
 * - slips: as evil, how likely they bluff carelessly (a character someone
 *   already claimed).
 * - talk: how likely they speak at dawn (times the usual chance).
 * - virgin: how likely they nominate a claimed Virgin to test her.
 * - quiet: how much they doubt someone who never said what they are.
 *
 * Kept apart from Vue and the store so it can be tried on its own.
 */

export const PERSONALITIES = {
  normal: {
    trust: 0.55,
    logic: 0.5,
    weight: 1,
    hunch: 0.8,
    follow: 0.3,
    nerve: 0,
    eager: 0,
    noise: 0.5,
    lies: 0.6,
    hides: 0,
    slips: 0.05,
    talk: 1,
    virgin: 0.2,
    quiet: 0.1,
  },
  // believes almost anything, follows the group, slow to doubt
  trusting: {
    trust: 0.95,
    logic: 0.3,
    weight: 1,
    hunch: 0.5,
    follow: 0.6,
    nerve: 0.2,
    eager: 0,
    noise: 0.4,
    lies: 0.3,
    hides: 0,
    slips: 0.1,
    talk: 1,
    virgin: 0,
    quiet: 0,
  },
  // as evil, always makes up info, and bold; as good, often hides at first
  liar: {
    trust: 0.45,
    logic: 0.5,
    weight: 1,
    hunch: 0.8,
    follow: 0.3,
    nerve: 0,
    eager: 0,
    noise: 0.5,
    lies: 1,
    hides: 0.5,
    slips: 0.02,
    talk: 1.1,
    virgin: 0.1,
    quiet: 0.1,
  },
  // reasons with everything, hard info over hunches, careful with votes
  strategist: {
    trust: 0.5,
    logic: 1,
    weight: 1.1,
    hunch: 0.4,
    follow: 0.2,
    nerve: 0.1,
    eager: -0.1,
    noise: 0.3,
    lies: 0.85,
    hides: 0.2,
    slips: 0,
    talk: 1,
    virgin: 0.5,
    quiet: 0.2,
  },
  // reads info badly, goes by gut and by the group, lies clumsily
  novice: {
    trust: 0.75,
    logic: 0.1,
    weight: 0.7,
    hunch: 1.4,
    follow: 0.7,
    nerve: -0.1,
    eager: 0,
    noise: 1,
    lies: 0.45,
    hides: 0,
    slips: 0.4,
    talk: 0.8,
    virgin: 0,
    quiet: 0,
  },
  // doubts a single source, tests the Virgin, watches the quiet ones
  veteran: {
    trust: 0.35,
    logic: 0.9,
    weight: 0.9,
    hunch: 0.5,
    follow: 0.2,
    nerve: 0,
    eager: -0.1,
    noise: 0.3,
    lies: 0.8,
    hides: 0.1,
    slips: 0,
    talk: 1,
    virgin: 0.7,
    quiet: 0.45,
  },
  // nominates early and raises their hand a lot
  hothead: {
    trust: 0.55,
    logic: 0.4,
    weight: 1,
    hunch: 1,
    follow: 0.4,
    nerve: -0.35,
    eager: 0.3,
    noise: 0.6,
    lies: 0.7,
    hides: 0,
    slips: 0.1,
    talk: 1.2,
    virgin: 0.1,
    quiet: 0.1,
  },
  // speaks little and late
  quiet: {
    trust: 0.55,
    logic: 0.5,
    weight: 1,
    hunch: 0.8,
    follow: 0.4,
    nerve: 0.3,
    eager: 0,
    noise: 0.5,
    lies: 0.4,
    hides: 0.6,
    slips: 0.05,
    talk: 0.5,
    virgin: 0.1,
    quiet: 0,
  },
};

// how often each one comes out: a normal player more often
const ODDS = {
  normal: 3,
  trusting: 1,
  liar: 1,
  strategist: 1,
  novice: 1,
  veteran: 1,
  hothead: 1,
  quiet: 1,
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES);

/** A personality at random (its key). */
export const rollPersonality = (random = Math.random) => {
  const total = Object.values(ODDS).reduce((sum, odds) => sum + odds, 0);
  let roll = random() * total;
  for (const id of PERSONALITY_IDS) {
    roll -= ODDS[id];
    if (roll < 0) return id;
  }
  return "normal";
};

/** The traits of a personality key (normal if unknown). */
export const traitsOf = (id) => PERSONALITIES[id] || PERSONALITIES.normal;

/**
 * Conviction: how much the others believe what a made-up player says (their
 * claims, their info, their "I suspect X"), from 1 to 10, rolled at random
 * when the practice starts next to the personality. Whoever listens still
 * weighs it with their own trust.
 */
export const rollConviction = (random = Math.random) =>
  1 + Math.floor(random() * 10);

/** What a conviction multiplies belief by: 0.55 to 1.45, 1 on average. */
export const convictionFactor = (conviction) =>
  conviction ? 0.45 + conviction / 10 : 1;

/** How it is shown: "low" (1-3), "some" (4-7) or "high" (8-10). */
export const convictionLevel = (conviction) =>
  conviction >= 8 ? "high" : conviction >= 4 ? "some" : "low";
