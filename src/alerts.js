/**
 * Getting a player's attention when something needs them (woken up at night,
 * an info card, a nomination, their turn to vote): vibration on phones and,
 * while the game is in a background tab, a mark in the tab title.
 */
const TITLE_MARK = "● ";

let baseTitle = null;
let flaggedTitle = null;

const restoreTitle = () => {
  if (flaggedTitle === null) return;
  // keep any title the app set in the meantime
  if (document.title === flaggedTitle) document.title = baseTitle;
  baseTitle = flaggedTitle = null;
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) restoreTitle();
  });
}

/** Vibrate the phone (not supported by iPhones or computers). */
export const vibrate = (pattern = 200) => {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    // not allowed before the first tap on the page: nothing to do
  }
};

/** Show the text in the tab title while the page is not visible. */
export const flagTitle = (text) => {
  if (!document.hidden) return;
  if (baseTitle === null) baseTitle = document.title;
  flaggedTitle = TITLE_MARK + text;
  document.title = flaggedTitle;
};
