/**
 * The storyteller's announcements to the town: the usual ones as presets
 * (sent as a key, so each player reads them in their own language), or the
 * storyteller's own words.
 */
export const PRESETS = ["toPlaza", "nominationsOpen", "secondCall", "lastCall"];

// sent by the app itself: the day timer ran out
export const TIME_UP = "timeUp";

// no longer offered, but still in diaries of games played with them
const RETIRED = ["nominationsClosed", "fewMinutes", "nightFalls"];

const KEYS = [...PRESETS, TIME_UP, ...RETIRED];

export const MAX_TEXT = 200;

/** What an announcement says: `t` is the i18n function. */
export const announcementText = ({ key, text }, t) =>
  key && KEYS.includes(key) ? t(`announce.presets.${key}`) : text || "";
