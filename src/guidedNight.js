/**
 * Guided night for the storyteller: tonight's steps, from the night order.
 *
 * It says whose turn it is, nothing more: what to send them is up to the
 * storyteller, since characters like the Lunatic or the Marionette make any
 * guess from the character's text wrong.
 */
import { nightOrder } from "./nightOrder";

// a dead player's character only acts when its text talks about dying
const ACTS_WHEN_DEAD = /\b(died|dies|dead|death)\b/i;

/**
 * Tonight's steps: night order entries with someone seated to wake, in order.
 * Each: { id, role, players }.
 */
export function nightSteps(first, game) {
  const key = first ? "firstNightReminder" : "otherNightReminder";
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
    steps.push({
      id: role.id,
      role,
      players,
    });
  });
  return steps;
}
