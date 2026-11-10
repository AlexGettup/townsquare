/**
 * Info cards: the game's info tokens the storyteller can send, and how each
 * one looks (a colour and an icon of our own, inspired by the official app).
 *
 * "Make a choice" is one token, but the card says what to choose: one
 * player or two (answered by tapping seats, see ChoosePlayers.vue) or a
 * character (answered in the private chat). Those are the card's phrase:
 * choosePlayer, chooseTwoPlayers or chooseCharacter.
 */
export const CHOICES = ["choosePlayer", "chooseTwoPlayers", "chooseCharacter"];

// in the order of the official app
export const PHRASES = [
  "useAbility",
  "makeChoice",
  "notInPlay",
  "thisIsTheDemon",
  "theseAreYourMinions",
  "youAre",
  "thisPlayerIs",
  "characterSelectedYou",
];

const LOOKS = {
  useAbility: { color: "#8a4a24", icon: "moon" },
  makeChoice: { color: "#b8561b", icon: "hand-pointer" },
  notInPlay: { color: "#1d5f99", icon: "eye-slash" },
  thisIsTheDemon: { color: "#a01622", icon: "fire" },
  theseAreYourMinions: { color: "#8c1f3c", icon: "user-friends" },
  youAre: { color: "#6a2c8c", icon: "user" },
  thisPlayerIs: { color: "#7a3699", icon: "hand-point-right" },
  characterSelectedYou: { color: "#2b7a34", icon: "crosshairs" },
};
// cards sent before these changes ("youLearn") and cards without a phrase
const PLAIN = { color: "#444444", icon: "comment-dots" };

/** The token a card shows: the three choices are all "Make a choice". */
export const tokenOf = (phrase) =>
  CHOICES.includes(phrase) ? "makeChoice" : phrase;

/** { color, icon } of a card's token. */
export const lookOf = (phrase) => LOOKS[tokenOf(phrase)] || PLAIN;
