/**
 * Store plugin: keep the screen on during a live session (Screen Wake Lock
 * API), so phones don't lock in the middle of a game, which would drop the
 * player from their seat and from voice chat.
 *
 * The browser releases the lock whenever the page is hidden, so it is taken
 * again when the page is visible. Some browsers only grant it after a tap,
 * so a tap also retries.
 */
export default (store) => {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

  let lock = null;
  let requesting = false;

  const wanted = () =>
    !!store.state.session.sessionId && document.visibilityState === "visible";

  const update = async () => {
    if (wanted()) {
      if (lock || requesting) return;
      requesting = true;
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
        // the session may have ended while we were asking
        if (!wanted()) update();
      } catch (e) {
        // not allowed right now (battery saver, no tap yet…)
      } finally {
        requesting = false;
      }
    } else if (lock) {
      const current = lock;
      lock = null;
      current.release().catch(() => {});
    }
  };

  document.addEventListener("visibilitychange", update);
  document.addEventListener("click", update);
  store.subscribe(({ type }) => {
    if (type === "session/setSessionId") update();
  });
  update();
};
