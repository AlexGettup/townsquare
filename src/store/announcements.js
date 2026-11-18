import { TIME_UP } from "../announcements";

// a timer that ran out longer ago than this (a reload) isn't announced again
const LATE = 3 * 1000;

/**
 * Store plugin: when the day timer runs out, "Time's up" is announced like
 * the storyteller's announcements. Every device announces it by itself (the
 * timer is synced), so it isn't sent over the live session.
 */
export default (store) => {
  let timeout = null;

  const schedule = (timer) => {
    clearTimeout(timeout);
    if (!timer) return;
    const left = timer.endsAt - Date.now();
    if (left < -LATE) return;
    timeout = setTimeout(
      () => {
        if (store.state.session.dayTimer !== timer) return;
        store.commit("session/setAnnouncement", {
          id: "time-up-" + timer.endsAt,
          key: TIME_UP,
          text: null,
          local: true,
        });
      },
      Math.max(0, left),
    );
  };

  store.watch((state) => state.session.dayTimer, schedule);
  schedule(store.state.session.dayTimer);
};
