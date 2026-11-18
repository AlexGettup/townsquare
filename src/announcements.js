/**
 * The storyteller's announcements to the town: the usual ones as presets
 * (sent as a key, so each player reads them in their own language), or the
 * storyteller's own words.
 */
export const PRESETS = [
  "toPlaza",
  "nominationsOpen",
  "nominationsClosed",
  "fewMinutes",
  "nightFalls",
];

export const MAX_TEXT = 200;

/** What an announcement says: `t` is the i18n function. */
export const announcementText = ({ key, text }, t) =>
  key && PRESETS.includes(key) ? t(`announce.presets.${key}`) : text || "";
