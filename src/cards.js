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

/**
 * The pointing vote (Boomdandy): a card to every player, answered by tapping
 * a seat like "choose a player". Not offered in the card window.
 */
export const POINTING = "pointAtPlayer";

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
  // the pointing vote (Boomdandy), sent to everyone from the menu
  pointAtPlayer: { color: "#b8561b", icon: "hand-point-up" },
};
// cards sent before these changes ("youLearn") and cards without a phrase
const PLAIN = { color: "#444444", icon: "comment-dots" };

/** The token a card shows: the three choices are all "Make a choice". */
export const tokenOf = (phrase) =>
  CHOICES.includes(phrase) ? "makeChoice" : phrase;

/** { color, icon } of a card's token. */
export const lookOf = (phrase) => LOOKS[tokenOf(phrase)] || PLAIN;

/**
 * A card is built line by line, like the official app: each line a token
 * with its characters, players, number or yes/no ("These are your minions:
 * Ana, Belén" + "These characters are not in play: …"). Only one line can
 * be a choice, the one the player answers.
 */
export const MAX_PARTS = 6;

export const emptyPart = (phrase = null) => ({
  phrase,
  roles: [],
  players: [],
  number: null,
  answer: null,
  alignment: null,
});

export const isEmptyPart = (part) =>
  !part.phrase &&
  !part.roles.length &&
  !part.players.length &&
  part.number === null &&
  !part.answer &&
  !part.alignment;

/** Good or evil on a "You are" line (Snake Charmer, Fang Gu, Goon). */
export const ALIGNMENTS = ["good", "evil"];

/**
 * A character token's alignment, "good" or "evil" (travellers can also be
 * neither: null). `alignmentIndex` flips the team's usual side.
 */
export const alignmentOf = (team, alignmentIndex) => {
  if (team === "traveller")
    return [null, "good", "evil"][alignmentIndex] || null;
  if (team === "townsfolk" || team === "outsider")
    return alignmentIndex ? "evil" : "good";
  if (team === "minion" || team === "demon")
    return alignmentIndex ? "good" : "evil";
  return null;
};

/** The `alignmentIndex` that gives a character of `team` that alignment. */
export const alignmentIndexOf = (team, alignment) => {
  if (team === "traveller") return { good: 1, evil: 2 }[alignment] || 0;
  if (team === "minion" || team === "demon")
    return alignment === "good" ? 1 : 0;
  return alignment === "evil" ? 1 : 0;
};

/** A card's lines; cards from before lines existed are one line. */
export const partsOf = (card) =>
  card.parts && card.parts.length
    ? card.parts
    : [
        {
          phrase: card.phrase || null,
          roles: card.roles || [],
          players: card.players || [],
          number: card.number === undefined ? null : card.number,
          answer: card.answer || null,
          alignment: card.alignment || null,
        },
      ].filter((part) => !isEmptyPart(part));

/**
 * The card to send from its lines and text. The main line (the choice, or
 * else the first) also goes at the top level: the server reads the choice
 * there, and older clients show that line.
 */
export const buildCard = (parts, text) => {
  const lines = parts.filter((part) => !isEmptyPart(part));
  const main =
    lines.find((part) => CHOICES.includes(part.phrase)) ||
    lines[0] ||
    emptyPart();
  const copy = (part) => ({
    ...part,
    roles: [...part.roles],
    players: [...part.players],
  });
  return {
    ...copy(main),
    text: text.trim(),
    parts: lines.map(copy),
  };
};

/**
 * One line written out: "These are your minions: Ana, Belén". `t` is the
 * i18n function, `roleName(id)` gives a character's name.
 */
export const describePart = (part, t, roleName) => {
  const items = [
    ...part.roles.map(roleName),
    ...part.players,
    ...(part.number !== null ? [String(part.number)] : []),
    ...(part.answer ? [t(`cards.${part.answer}`)] : []),
    ...(part.alignment ? [t(`modals.role.alignment.${part.alignment}`)] : []),
  ].join(", ");
  if (!part.phrase) return items;
  const phrase = t(`cards.phrases.${part.phrase}`);
  return items ? `${phrase}: ${items}` : phrase;
};
