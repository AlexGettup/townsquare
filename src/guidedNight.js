/**
 * Guided night for the storyteller: tonight's steps, from the night order,
 * and what each one sends (a ready-made info card, or the grimoire).
 *
 * The cards come from the character's reminder text in English (the game
 * state is in English), so they are a suggestion: the storyteller sees the
 * card window filled in and changes what they need before sending.
 */
import { nightOrder } from "./nightOrder";

// the info tokens written in reminders as *THIS IS THE DEMON* and so on
const MARKED_TOKENS = {
  "YOU ARE": "youAre",
  "THIS IS THE DEMON": "thisIsTheDemon",
  "THESE ARE YOUR MINIONS": "theseAreYourMinions",
  "THESE CHARACTERS ARE NOT IN PLAY": "notInPlay",
  "THIS PLAYER IS": "thisPlayerIs",
  "THIS CHARACTER SELECTED YOU": "characterSelectedYou",
};

// a dead player's character only acts when its text talks about dying
const ACTS_WHEN_DEAD = /\b(died|dies|dead|death)\b/i;

const emptyCard = () => ({
  phrase: null,
  text: "",
  roles: [],
  players: [],
  number: null,
  answer: null,
});

/** What a reminder text asks for: { kind: "grimoire" } or { kind: "card", card }. */
export function actionFor(reminder) {
  const text = reminder || "";
  if (/show the grimoire/i.test(text)) return { kind: "grimoire" };
  const card = emptyCard();
  const choose = text.match(
    /\bchooses?\s+(?:up to\s+)?(a|an|1|one|2|two)\s+(?:\w+\s+)?(players?|characters?)\b/i,
  );
  if (choose) {
    const isCharacter = /^character/i.test(choose[2]);
    const isTwo = /^(2|two)$/i.test(choose[1]);
    card.phrase = isCharacter
      ? "chooseCharacter"
      : isTwo
        ? "chooseTwoPlayers"
        : "choosePlayer";
    return { kind: "card", card };
  }
  const marked = (text.match(/\*([^*]+)\*/g) || [])
    .map((m) => MARKED_TOKENS[m.slice(1, -1).toUpperCase()])
    .find(Boolean);
  if (marked) card.phrase = marked;
  return { kind: "card", card };
}

/**
 * Tonight's steps: night order entries with someone to wake, in order.
 * Each: { id, role, players, reminder, cards: [{ label?, card }] | null,
 *         grimoire: boolean, byHand: boolean }
 */
export function nightSteps(first, game) {
  const key = first ? "firstNightReminder" : "otherNightReminder";
  const names = (team) =>
    game.players.filter((p) => p.role.team === team).map((p) => p.name);
  const steps = [];
  nightOrder(first, game).forEach((role) => {
    if (role.id === "dusk" || role.id === "dawn") return;
    const players = role.players.filter((p) => p.id);
    if (!players.length) return;
    const reminder = role[key] || "";
    if (
      players.every((p) => p.isDead) &&
      !ACTS_WHEN_DEAD.test(reminder) &&
      role.team !== "traveller"
    )
      return;
    const step = {
      id: role.id,
      role,
      players,
      reminder,
      grimoire: false,
      byHand: false,
      cards: [],
    };
    if (role.id === "minioninfo") {
      // the storyteller gives this by hand: prepared, not sent for them
      step.byHand = true;
      step.cards = [
        {
          label: "thisIsTheDemon",
          card: {
            ...emptyCard(),
            phrase: "thisIsTheDemon",
            players: names("demon"),
          },
        },
        {
          label: "theseAreYourMinions",
          card: {
            ...emptyCard(),
            phrase: "theseAreYourMinions",
            players: names("minion"),
          },
        },
      ];
    } else if (role.id === "demoninfo") {
      step.byHand = true;
      step.cards = [
        {
          label: "theseAreYourMinions",
          card: {
            ...emptyCard(),
            phrase: "theseAreYourMinions",
            players: names("minion"),
          },
        },
        {
          label: "notInPlay",
          card: {
            ...emptyCard(),
            phrase: "notInPlay",
            roles: (game.bluffs || [])
              .map((bluff) => bluff && bluff.id)
              .filter(Boolean),
          },
        },
      ];
    } else {
      const action = actionFor(reminder);
      if (action.kind === "grimoire") step.grimoire = true;
      else step.cards = [{ card: action.card }];
    }
    steps.push(step);
  });
  return steps;
}
