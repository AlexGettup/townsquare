/**
 * Translations of the game content: character names, abilities, night order
 * texts, reminder tokens and jinxes.
 *
 * The game data in the store always stays in English (it is what gets synced
 * between players and saved), and is only translated when it is displayed.
 * That way every player sees the characters in their own language.
 *
 * - src/i18n/game/<locale>.json: official texts, refreshed with
 *   `npm run update-translations`. Don't edit by hand.
 * - src/i18n/game/<locale>.overrides.json: your own corrections, same
 *   structure, they win over the official texts.
 *
 * Custom (homebrew) characters are never translated.
 */
import es from "./game/es.json";
import esOverrides from "./game/es.overrides.json";

const merge = (base = {}, overrides = {}) => {
  const result = { ...base };
  Object.entries(overrides).forEach(([key, value]) => {
    result[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? merge(base[key], value)
        : value;
  });
  return result;
};

const GAME_TEXTS = {
  es: merge(es, esOverrides),
};

// same normalization the official data uses for reminder keys ("3 Votes" -> "3votes")
const toKey = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * Return a copy of the role with its texts translated, or the role itself
 * when there is nothing to translate.
 */
export const localizeRole = (role, locale) => {
  const texts = GAME_TEXTS[locale];
  if (!texts || !role || !role.id || role.isCustom) return role;
  const translation = texts.roles[role.id];
  if (!translation) return role;
  return {
    ...role,
    name: translation.name || role.name,
    ability: translation.ability || role.ability,
    firstNightReminder:
      (role.firstNightReminder && translation.first) || role.firstNightReminder,
    otherNightReminder:
      (role.otherNightReminder && translation.other) || role.otherNightReminder,
  };
};

/**
 * Translate the text of a reminder token. Custom notes typed by the
 * storyteller are kept as they are.
 */
export const localizeReminder = (reminder, locale) => {
  const texts = GAME_TEXTS[locale];
  if (!texts || !reminder || !reminder.name) return reminder && reminder.name;
  if (reminder.imageAlt === "custom") return reminder.name;
  return texts.reminders[toKey(reminder.name)] || reminder.name;
};

/**
 * Translate the reason of an official jinx between two roles. The official
 * data stores each pair only once, in either order.
 */
export const localizeJinx = (firstId, secondId, reason, locale) => {
  const texts = GAME_TEXTS[locale];
  if (!texts) return reason;
  return (
    texts.jinxes[`${firstId}-${secondId}`] ||
    texts.jinxes[`${secondId}-${firstId}`] ||
    reason
  );
};
