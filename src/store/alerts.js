import i18n from "../i18n";
import { flagTitle, vibrate } from "../alerts";
import { playAlert } from "../voice/sounds";

const NOTICE_TIMEOUT = 6 * 1000;

/**
 * Store plugin: tells a seated player when something needs them, so nobody
 * misses it on a phone or with the game in another tab.
 * - woken up at night by the storyteller (voice chat)
 * - a nomination starts
 * - their turn to vote is next
 * Info cards alert from the chat plugin (store/chat.js).
 */
export default (store) => {
  const t = (key, params) => i18n.t(key, store.state.grimoire.locale, params);

  // the seated player (players only, not the storyteller)
  const me = () => {
    const { isSpectator, playerId } = store.state.session;
    if (!isSpectator || !playerId) return null;
    const { players } = store.state.players;
    const index = players.findIndex((player) => player.id === playerId);
    return index < 0 ? null : { player: players[index], index };
  };

  /**
   * notice: on-screen text (null when the screen already shows it, like the
   * vote); title: text for the tab title.
   */
  const alert = ({ notice, icon, title, pattern = [200, 100, 200] }) => {
    if (!store.state.grimoire.isMuted) playAlert();
    vibrate(pattern);
    if (title) flagTitle(title);
    if (notice) {
      store.commit("alerts/add", { key: notice, icon });
      const { id } = store.state.alerts.notices.find(
        ({ key }) => key === notice,
      );
      setTimeout(() => store.commit("alerts/remove", id), NOTICE_TIMEOUT);
    }
  };

  // woken up at night
  store.watch(
    () => {
      const seat = me();
      if (!seat || !store.state.grimoire.isNight) return false;
      return store.getters["voice/isAwake"](seat.player.id);
    },
    (isAwake, wasAwake) => {
      if (isAwake && !wasAwake) {
        alert({
          notice: "voice.youAreAwake",
          icon: "eye",
          title: t("voice.youAreAwake"),
        });
      }
    },
  );

  // a nomination starts: the vote panel shows it, the title and the phone tell
  store.watch(
    () => store.state.session.nomination,
    (nomination, previous) => {
      if (!nomination || previous || !me()) return;
      const { players } = store.state.players;
      const nominator = players[nomination[0]];
      const nominee = players[nomination[1]];
      if (!nominator || !nominee) return;
      alert({
        title: t("vote.nominated", {
          nominator: nominator.name,
          nominee: nominee.name,
        }),
      });
    },
  );

  // the voting hand is one seat away (or the countdown starts and we're first)
  let alertedVote = null;
  store.watch(
    () => {
      const { nomination, lockedVote, isVoteInProgress } = store.state.session;
      const seat = me();
      if (!nomination || !isVoteInProgress || !seat) return null;
      const { player, index } = seat;
      if (!player.connected) return null;
      const players = store.state.players.players;
      const nominee = players[nomination[1]];
      const nomineeIsTraveller = nominee && nominee.role.team === "traveller";
      if (player.isVoteless && !nomineeIsTraveller) return null;
      // seats vote one after the other, starting after the nominee
      const position =
        (index - 1 + players.length - nomination[1]) % players.length;
      return lockedVote === position ? nomination.join("-") : null;
    },
    (vote) => {
      if (!vote || vote === alertedVote) return;
      alertedVote = vote;
      alert({
        notice: "vote.yourTurn",
        icon: "hand-paper",
        title: t("vote.yourTurn"),
      });
    },
  );
  // a new nomination (even between the same players) can alert again
  store.watch(
    () => store.state.session.nomination,
    (nomination) => {
      if (!nomination) alertedVote = null;
    },
  );
};
