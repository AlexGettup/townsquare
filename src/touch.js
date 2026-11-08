/**
 * Touch screen without a mouse (phones and tablets): no hover, and focusing a
 * text field opens the on-screen keyboard.
 */
export function isTouchScreen() {
  return !!window.matchMedia && window.matchMedia("(hover: none)").matches;
}
