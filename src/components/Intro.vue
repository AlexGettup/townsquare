<template>
  <div class="intro">
    <img src="static/apple-icon.png" alt="" class="logo" />
    <div class="box">
      <i18n path="intro.welcome" tag="p">
        <template #title>
          <b>{{ $t("intro.title") }}</b>
        </template>
      </i18n>

      <!-- joined a session that has no game yet (or a wrong code) -->
      <p v-if="isWaiting" class="waiting">
        <font-awesome-icon icon="users" />
        {{ $t("intro.waiting", { code: session.sessionId }) }}
      </p>

      <!-- the two ways in: run the game, or play in someone else's -->
      <div class="start">
        <div class="option">
          <span class="button townsfolk" @click="host">
            <font-awesome-icon icon="book-open" /> {{ $t("intro.host") }}
          </span>
          <small>{{ $t("intro.hostHint") }}</small>
        </div>
        <div class="option">
          <span class="button" @click="join">
            <font-awesome-icon icon="users" /> {{ $t("intro.join") }}
          </span>
          <small>{{ $t("intro.joinHint") }}</small>
        </div>
      </div>

      <i18n path="intro.offline" tag="p" class="offline">
        <template #menu>
          <span class="button small" data-menu-toggle @click="toggleMenu">
            <font-awesome-icon icon="cog" /> {{ $t("intro.menu") }}
          </span>
        </template>
      </i18n>
      <i18n path="intro.footer" tag="div" class="footer">
        <template #github>
          <a href="https://github.com/AlexGettup/townsquare" target="_blank"
            >GitHub</a
          >
        </template>
      </i18n>
    </div>
    <img src="../assets/community-created-content.webp" alt="" class="ccc" />
    <a
      class="redirect"
      v-if="language === 'zh-CN'"
      href="https://clocktower.gstonegames.com"
    >
      <img src="../assets/gstone.webp" class="gstone" alt="" />
      你想使用中文版魔典吗？
    </a>
  </div>
</template>

<script>
import { mapMutations, mapState } from "vuex";

const MAX_PLAYERS = 20;
const NOTICE_TIMEOUT = 8 * 1000;

/**
 * First screen (no players yet): create a game as the storyteller or join one
 * as a player, each with a line on what happens next.
 */
export default {
  data() {
    return {
      language: window.navigator.userLanguage || window.navigator.language,
    };
  },
  computed: {
    ...mapState(["session"]),
    isWaiting() {
      return !!this.session.sessionId && this.session.isSpectator;
    },
  },
  // this screen goes away when the seats arrive: only now is the player in
  beforeDestroy() {
    if (this.isWaiting) this.notify("intro.joined", "chair");
  },
  methods: {
    ...mapMutations(["toggleMenu"]),
    // a notice at the top of the screen saying what to do next
    notify(key, icon) {
      this.$store.commit("alerts/add", { key, icon });
      const notice = this.$store.state.alerts.notices.find(
        (notice) => notice.key === key,
      );
      setTimeout(
        () => this.$store.commit("alerts/remove", notice.id),
        NOTICE_TIMEOUT,
      );
    },
    // storyteller: how many players, the session code, then the seats
    host() {
      const answer = prompt(this.$t("dialogs.playerCount"), "8");
      if (answer === null) return;
      const count = parseInt(answer, 10);
      if (!(count >= 1 && count <= MAX_PLAYERS)) {
        alert(this.$t("dialogs.playerCountInvalid", { max: MAX_PLAYERS }));
        return;
      }
      const sessionId = prompt(
        this.$t("dialogs.hostChannel"),
        Math.round(Math.random() * 10000),
      );
      if (!sessionId) return;
      for (let n = 1; n <= count; n++) {
        this.$store.commit(
          "players/add",
          this.$t("dialogs.defaultPlayerName", { n }),
        );
      }
      this.$store.commit("session/clearVoteHistory");
      this.$store.commit("session/setSpectator", false);
      this.$store.commit("session/setSessionId", sessionId);
      // the players' link, ready to paste
      const link = window.location.href.split("#")[0] + "#" + sessionId;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link).catch(() => {});
      }
      this.notify("intro.hosted", "book-open");
    },
    // player: the code or link from the storyteller. A session saved from
    // before (a wrong code, a game that never started) is simply replaced
    join() {
      let sessionId = prompt(this.$t("dialogs.joinChannel"));
      if (!sessionId) return;
      if (sessionId.match(/^https?:\/\//i)) {
        sessionId = sessionId.split("#").pop();
      }
      if (!sessionId) return;
      this.$store.commit("session/clearVoteHistory");
      this.$store.commit("session/setSpectator", true);
      this.$store.commit("toggleGrimoire", false);
      this.$store.commit("session/setSessionId", sessionId);
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

// logo, box and badge stacked in a column that scrolls on very short windows,
// so nothing ends up cut off above or below the screen
.intro {
  text-align: center;
  width: 60%;
  @media screen and (max-width: 767.98px) {
    width: 85%;
    font-size: 100%;
  }
  font-size: 120%;
  position: absolute;
  max-height: 100vh;
  box-sizing: border-box;
  padding: 1vh 10px;
  overflow-y: auto;
  scrollbar-width: none;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;

  > * {
    flex-shrink: 0;
  }

  .box {
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    border-radius: 10px;
  }

  a {
    color: white;
  }
  a.redirect {
    display: block;
    text-decoration: none;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    border-radius: 10px;

    &:hover {
      color: red;
    }
    img {
      width: 120px;
      display: block;
      margin: auto auto 1vh;
    }
  }

  img.logo {
    width: 20vh;
    max-width: 192px;
    box-sizing: border-box;
    border-radius: 50%;
    box-shadow: 0 0 10px black;
    border: 3px solid black;
  }

  img.ccc {
    width: 20vh;
    max-width: 192px;
    filter: drop-shadow(0 0 10px black);
  }

  .footer {
    font-size: 60%;
    opacity: 0.75;
  }

  p {
    margin: 0 0 10px;
  }

  .waiting {
    padding: 6px 10px;
    border: 1px solid $fabled;
    border-radius: 6px;
    color: $fabled;
  }

  .start {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin: 10px 0;
  }

  .option {
    flex: 1 1 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;

    .button {
      font-size: 90%;
      @media screen and (max-width: 767.98px) {
        font-size: 110%;
      }
      padding: 6px 16px;
      white-space: nowrap;
    }

    small {
      font-size: 75%;
      opacity: 0.85;
    }
  }

  .offline {
    font-size: 75%;
    opacity: 0.85;

    .button.small {
      font-size: 100%;
      padding: 0 8px;
    }
  }
}
</style>
