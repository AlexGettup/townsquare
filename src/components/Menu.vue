<template>
  <div id="controls">
    <span
      class="nomlog-summary"
      v-show="session.voteHistory.length && session.sessionId"
      @click="toggleModal('voteHistory')"
      :title="
        $tc('menu.recentNominations', session.voteHistory.length, {
          count: session.voteHistory.length,
        })
      "
    >
      <font-awesome-icon icon="book-dead" />
      {{ session.voteHistory.length }}
    </span>
    <span
      class="session"
      :class="{
        spectator: session.isSpectator,
        reconnecting: session.isReconnecting,
        speaking:
          session.isSpectator && !!voice.speaking.host && canHearVoice('host'),
      }"
      v-if="session.sessionId"
      @click="leaveSession"
      :title="
        $t('menu.sessionPlayers', { count: session.playerCount }) +
        (session.ping
          ? ' ' + $t('menu.sessionLatency', { ms: session.ping })
          : '')
      "
    >
      <font-awesome-icon icon="broadcast-tower" />
      {{ session.playerCount }}
    </span>
    <span
      class="reference"
      @click="toggleModal('reference')"
      :title="$t('menu.referenceSheet') + ' [R]'"
    >
      <font-awesome-icon icon="address-card" />
    </span>
    <div class="menu" :class="{ open: grimoire.isMenuOpen }">
      <font-awesome-icon icon="cog" @click="toggleMenu" />
      <ul>
        <li class="tabs" :class="tab">
          <font-awesome-icon icon="book-open" @click="tab = 'grimoire'" />
          <font-awesome-icon icon="broadcast-tower" @click="tab = 'session'" />
          <font-awesome-icon
            icon="users"
            v-if="!session.isSpectator"
            @click="tab = 'players'"
          />
          <font-awesome-icon icon="theater-masks" @click="tab = 'characters'" />
          <font-awesome-icon icon="question" @click="tab = 'help'" />
        </li>

        <template v-if="tab === 'grimoire'">
          <!-- Grimoire -->
          <li class="headline">{{ $t("menu.grimoire") }}</li>
          <li @click="toggleGrimoire" v-if="players.length">
            <template v-if="!grimoire.isPublic">{{ $t("menu.hide") }}</template>
            <template v-if="grimoire.isPublic">{{ $t("menu.show") }}</template>
            <em>[G]</em>
          </li>
          <li @click="toggleNight" v-if="!session.isSpectator">
            <template v-if="!grimoire.isNight">{{
              $t("menu.switchToNight")
            }}</template>
            <template v-if="grimoire.isNight">{{
              $t("menu.switchToDay")
            }}</template>
            <em>[S]</em>
          </li>
          <li
            @click="toggleNightOrder"
            v-if="players.length && !session.isSpectator"
          >
            {{ $t("menu.nightOrder") }}
            <em>
              <font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isNightOrder ? 'check-square' : 'square',
                ]"
              />
            </em>
          </li>
          <li v-if="players.length">
            {{ $t("menu.zoom") }}
            <em>
              <font-awesome-icon
                @click="setZoom(grimoire.zoom - 1)"
                icon="search-minus"
              />
              {{ Math.round(100 + grimoire.zoom * 10) }}%
              <font-awesome-icon
                @click="setZoom(grimoire.zoom + 1)"
                icon="search-plus"
              />
            </em>
          </li>
          <li @click="setBackground">
            {{ $t("menu.backgroundImage") }}
            <em><font-awesome-icon icon="image" /></em>
          </li>
          <li @click="toggleUnofficial">
            <small>{{ $t("menu.useUnofficialArt") }}</small>
            <em
              ><font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isArtUnofficial ? 'check-square' : 'square',
                ]"
            /></em>
          </li>
          <li v-if="!edition.isOfficial" @click="imageOptIn">
            <small>{{ $t("menu.showCustomImages") }}</small>
            <em
              ><font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isImageOptIn ? 'check-square' : 'square',
                ]"
            /></em>
          </li>
          <li @click="toggleStatic">
            {{ $t("menu.disableAnimations") }}
            <em
              ><font-awesome-icon
                :icon="['fas', grimoire.isStatic ? 'check-square' : 'square']"
            /></em>
          </li>
          <li @click="toggleMuted">
            {{ $t("menu.muteSounds") }}
            <em
              ><font-awesome-icon
                :icon="['fas', grimoire.isMuted ? 'volume-mute' : 'volume-up']"
            /></em>
          </li>
          <li class="language" @click="cycleLocale">
            {{ $t("menu.language") }}
            <em>
              <span
                v-for="locale in locales"
                :key="locale.code"
                :class="{ active: grimoire.locale === locale.code }"
                :title="locale.name"
                @click.stop="setLocale(locale.code)"
                >{{ locale.code.toUpperCase() }}</span
              >
            </em>
          </li>
        </template>

        <template v-if="tab === 'session'">
          <!-- Session -->
          <li class="headline" v-if="session.sessionId">
            {{ session.isSpectator ? $t("menu.playing") : $t("menu.hosting") }}
          </li>
          <li class="headline" v-else>{{ $t("menu.liveSession") }}</li>
          <template v-if="!session.sessionId">
            <li @click="hostSession">{{ $t("menu.host") }}<em>[H]</em></li>
            <li @click="joinSession">{{ $t("menu.join") }}<em>[J]</em></li>
          </template>
          <template v-else>
            <li v-if="session.ping">
              <small>
                {{
                  session.isSpectator
                    ? $t("menu.delayToHost")
                    : $t("menu.delayToPlayers")
                }}
              </small>
              <em>{{ session.ping }}ms</em>
            </li>
            <li @click="copySessionUrl">
              {{ $t("menu.copyPlayerLink") }}
              <em><font-awesome-icon icon="copy" /></em>
            </li>
            <li
              v-if="!session.isSpectator && showSendCharacters"
              @click="distributeRoles"
            >
              {{ $t("menu.sendCharacters") }}
              <em><font-awesome-icon icon="seedling" /></em>
            </li>
            <li
              v-if="session.voteHistory.length || !session.isSpectator"
              @click="toggleModal('voteHistory')"
            >
              {{ $t("menu.voteHistory") }}<em>[V]</em>
            </li>
            <li v-if="!session.isSpectator" @click="setVoteWatching">
              {{ $t("menu.secretVote") }}
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    !session.isVoteWatchingAllowed ? 'check-square' : 'square',
                  ]"
              /></em>
            </li>
            <li v-if="!session.isSpectator" @click="setTwoVotes">
              {{ $t("menu.votingTwice") }}
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    session.isTwoVotesEnabled ? 'check-square' : 'square',
                  ]"
              /></em>
            </li>
            <li @click="leaveSession">
              {{ $t("menu.leaveSession") }}
              <em>{{ session.sessionId }}</em>
            </li>
          </template>
        </template>

        <template v-if="tab === 'players' && !session.isSpectator">
          <!-- Users -->
          <li class="headline">{{ $t("menu.players") }}</li>
          <li @click="addPlayer" v-if="players.length < 20">
            {{ $t("menu.add") }}<em>[A]</em>
          </li>
          <li v-if="!session.isSpectator" @click="toggleSelfNaming">
            {{ $t("menu.allowSelfNaming") }}
            <em
              ><font-awesome-icon
                :icon="[
                  'fas',
                  session.allowSelfNaming ? 'check-square' : 'square',
                ]"
            /></em>
          </li>
          <li @click="lowerHands" v-if="players.length">
            {{ $t("menu.lowerAllHands") }}
            <em><font-awesome-icon icon="sign-language" /></em>
          </li>
          <li @click="randomizeSeatings" v-if="players.length > 2">
            {{ $t("menu.randomize") }}
            <em><font-awesome-icon icon="dice" /></em>
          </li>
          <li @click="clearPlayers" v-if="players.length">
            {{ $t("menu.removeAll") }}
            <em><font-awesome-icon icon="trash-alt" /></em>
          </li>
        </template>

        <template v-if="tab === 'characters'">
          <!-- Characters -->
          <li class="headline">{{ $t("menu.characters") }}</li>
          <li v-if="!session.isSpectator" @click="toggleModal('edition')">
            {{ $t("menu.selectEdition") }}
            <em>[E]</em>
          </li>
          <li
            @click="toggleModal('roles')"
            v-if="!session.isSpectator && players.length > 4"
          >
            {{ $t("menu.chooseAndAssign") }}
            <em>[C]</em>
          </li>
          <li v-if="!session.isSpectator" @click="toggleModal('npc')">
            {{ $t("menu.addNpcs") }}
            <em><font-awesome-icon icon="dragon" /></em>
          </li>
          <li @click="clearRoles" v-if="players.length">
            {{ $t("menu.clearAll") }}
            <em><font-awesome-icon icon="trash-alt" /></em>
          </li>
        </template>

        <template v-if="tab === 'help'">
          <!-- Help -->
          <li class="headline">{{ $t("menu.help") }}</li>
          <li @click="toggleModal('nightOrder')">
            {{ $t("menu.nightOrderSheet") }}
            <em>[N]</em>
          </li>
          <li @click="toggleModal('gameState')">
            {{ $t("menu.gameStateJson") }}
            <em><font-awesome-icon icon="file-code" /></em>
          </li>
          <li @click="toggleModal('changelog')">
            {{ $t("menu.whatsNew") }}
            <em><font-awesome-icon icon="newspaper" /></em>
          </li>
          <li>
            <a href="https://github.com/AlexGettup/townsquare" target="_blank">
              {{ $t("menu.sourceCode") }}
            </a>
            <em>
              <a
                href="https://github.com/AlexGettup/townsquare"
                target="_blank"
              >
                <font-awesome-icon :icon="['fab', 'github']" />
              </a>
            </em>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations, mapState } from "vuex";
import { LOCALES } from "../i18n";

export default {
  computed: {
    showSendCharacters: function () {
      return (
        this.npcs.some((npc) => npc.id === "gardener") &&
        !this.npcs.some((npc) => npc.id === "tor")
      );
    },
    ...mapState(["grimoire", "session", "edition", "npcs", "voice"]),
    ...mapState("players", ["players"]),
    ...mapGetters("voice", { canHearVoice: "canHear" }),
  },
  data() {
    return {
      tab: "grimoire",
      locales: LOCALES,
    };
  },
  methods: {
    cycleLocale() {
      const index = this.locales.findIndex(
        ({ code }) => code === this.grimoire.locale,
      );
      this.setLocale(this.locales[(index + 1) % this.locales.length].code);
    },
    setBackground() {
      const background = prompt(this.$t("dialogs.backgroundUrl"));
      if (background || background === "") {
        this.$store.commit("setBackground", background);
      }
    },
    hostSession() {
      if (this.session.sessionId) return;
      const sessionId = prompt(
        this.$t("dialogs.hostChannel"),
        Math.round(Math.random() * 10000),
      );
      if (sessionId) {
        this.$store.commit("session/clearVoteHistory");
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", sessionId);
        this.copySessionUrl();
      }
    },
    copySessionUrl() {
      const url = window.location.href.split("#")[0];
      const link = url + "#" + this.session.sessionId;
      navigator.clipboard.writeText(link);
    },
    distributeRoles() {
      if (this.session.isSpectator) return;
      if (confirm(this.$t("dialogs.distributeRoles"))) {
        this.$store.commit("session/distributeRoles", true);
        setTimeout(
          (() => {
            this.$store.commit("session/distributeRoles", false);
          }).bind(this),
          2000,
        );
      }
    },
    imageOptIn() {
      if (
        this.grimoire.isImageOptIn ||
        confirm(this.$t("dialogs.imageOptIn"))
      ) {
        this.toggleImageOptIn();
      }
    },
    joinSession() {
      if (this.session.sessionId) return this.leaveSession();
      let sessionId = prompt(this.$t("dialogs.joinChannel"));
      if (sessionId.match(/^https?:\/\//i)) {
        sessionId = sessionId.split("#").pop();
      }
      if (sessionId) {
        this.$store.commit("session/clearVoteHistory");
        this.$store.commit("session/setSpectator", true);
        this.$store.commit("toggleGrimoire", false);
        this.$store.commit("session/setSessionId", sessionId);
      }
    },
    leaveSession() {
      if (confirm(this.$t("dialogs.leaveSession"))) {
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", "");
      }
    },
    addPlayer() {
      if (this.session.isSpectator) return;
      if (this.players.length >= 20) return;
      const name = prompt(
        this.$t("dialogs.playerName"),
        this.$t("dialogs.defaultPlayerName", { n: this.players.length + 1 }),
      );
      if (name) {
        this.$store.commit("players/add", name);
      }
    },
    lowerHands() {
      if (this.session.isSpectator) return;
      this.players.forEach((player) => {
        this.$store.commit("players/update", {
          player,
          property: "handRaised",
          value: false,
        });
      });
    },
    randomizeSeatings() {
      if (this.session.isSpectator) return;
      if (confirm(this.$t("dialogs.randomizeSeats"))) {
        this.$store.dispatch("players/randomize");
      }
    },
    clearPlayers() {
      if (this.session.isSpectator) return;
      if (confirm(this.$t("dialogs.removeAllPlayers"))) {
        // abort vote if in progress
        if (this.session.nomination) {
          this.$store.commit("session/nomination");
        }
        this.$store.commit("players/clear");
        this.$store.commit("setBluff");
      }
    },
    clearRoles() {
      if (confirm(this.$t("dialogs.removeAllRoles"))) {
        this.$store.dispatch("players/clearRoles");
      }
    },
    toggleNight() {
      this.$store.commit("toggleNight");
      if (this.grimoire.isNight) {
        this.$store.commit("session/setMarkedPlayer", -1);
      }
    },
    toggleSelfNaming() {
      if (this.session.isSpectator) return;
      this.$store.commit(
        "session/setAllowSelfNaming",
        !this.session.allowSelfNaming,
      );
    },
    setTwoVotes() {
      if (this.session.isSpectator) return;
      this.$store.commit(
        "session/setTwoVotesEnabled",
        !this.session.isTwoVotesEnabled,
      );

      if (!this.session.isTwoVotesEnabled) {
        // Disable two votes for all players
        this.players.forEach((player) => {
          if (player.hasTwoVotes) {
            this.$store.commit("players/update", {
              player: player,
              property: "hasTwoVotes",
              value: false,
            });
          }
        });
      }
    },
    setVoteWatching() {
      if (this.session.isSpectator) return;
      this.$store.commit(
        "session/setVoteWatchingAllowed",
        !this.session.isVoteWatchingAllowed,
      );

      if (!this.session.isVoteWatchingAllowed) {
        // Disable vote history if votes are hidden
        this.$store.commit("session/setVoteHistoryAllowed", false);
      }
    },
    ...mapMutations([
      "toggleGrimoire",
      "toggleMenu",
      "toggleUnofficial",
      "toggleImageOptIn",
      "toggleMuted",
      "toggleNightOrder",
      "toggleStatic",
      "setZoom",
      "setLocale",
      "toggleModal",
    ]),
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

// success animation
@keyframes greenToWhite {
  from {
    color: green;
  }
  to {
    color: white;
  }
}

// Controls
#controls {
  position: absolute;
  right: 3px;
  top: 3px;
  text-align: right;
  padding-right: 50px;
  z-index: 75;

  svg {
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
    &.success {
      animation: greenToWhite 1s normal forwards;
      animation-iteration-count: 1;
    }
  }

  > span {
    display: inline-block;
    cursor: pointer;
    z-index: 5;
    margin-top: 7px;
    margin-left: 10px;
  }

  span.nomlog-summary {
    color: $townsfolk;
  }

  span.session {
    color: $demon;
    &.spectator {
      color: $townsfolk;
    }
    &.reconnecting {
      animation: blink 1s infinite;
    }
    // the storyteller is talking on voice chat
    &.speaking svg {
      color: $voice-speaking;
      filter: drop-shadow(0 0 6px $voice-speaking);
    }
  }

  // character reference sheet, always at hand for players.
  // Boxed like the menu cog: translucent black background, solid black border
  span.reference {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: top;
    box-sizing: border-box;
    width: 40px;
    height: 40px;
    margin-top: 0;
    font-size: 20px;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    border-radius: 10px;
    transition: color 250ms;
    &:hover {
      color: red;
    }
  }
}

@keyframes blink {
  50% {
    opacity: 0.5;
    color: gray;
  }
}

.menu {
  width: 220px;
  transform-origin: 200px 22px;
  transition: transform 500ms cubic-bezier(0.68, -0.55, 0.27, 1.55);
  transform: rotate(-90deg);
  position: absolute;
  right: 0;
  top: 0;
  // the empty area beside the cog must not block the buttons next to it
  // (e.g. the voice chat menu): only the cog and the list take clicks
  pointer-events: none;

  &.open {
    transform: rotate(0deg);
  }

  > svg,
  ul {
    pointer-events: auto;
  }

  > svg {
    cursor: pointer;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    width: 40px;
    height: 50px;
    margin-bottom: -8px;
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
    padding: 5px 5px 15px;
  }

  a {
    color: white;
    text-decoration: none;
    &:hover {
      color: red;
    }
  }

  ul {
    display: flex;
    list-style-type: none;
    padding: 0;
    margin: 0;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 0 10px black;
    border: 3px solid black;
    border-radius: 10px 0 10px 10px;

    li {
      padding: 2px 5px;
      color: white;
      text-align: left;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 30px;

      @media (orientation: portrait) {
        font-size: 16px;
      }

      &.tabs {
        display: flex;
        padding: 0;
        svg {
          flex-grow: 1;
          flex-shrink: 0;
          height: 35px;
          border-bottom: 3px solid black;
          border-right: 3px solid black;
          padding: 5px 0;
          cursor: pointer;
          transition: color 250ms;
          &:hover {
            color: red;
          }
          &:last-child {
            border-right: 0;
          }
        }
        &.grimoire .fa-book-open,
        &.players .fa-users,
        &.settings .fa-tools,
        &.characters .fa-theater-masks,
        &.session .fa-broadcast-tower,
        &.help .fa-question {
          background: linear-gradient(
            to bottom,
            $townsfolk 0%,
            rgba(0, 0, 0, 0.5) 100%
          );
        }
      }

      &:not(.headline):not(.tabs):hover {
        cursor: pointer;
        color: red;
      }

      em {
        flex-grow: 0;
        font-style: normal;
        margin-left: 10px;
        font-size: 80%;
      }

      &.language {
        em span {
          color: white;
          opacity: 0.5;
          margin-left: 6px;
          transition: opacity 250ms;
          &:hover {
            color: red;
            opacity: 1;
          }
          &.active {
            opacity: 1;
            font-weight: bold;
          }
        }
      }
    }

    .headline {
      font-family: PiratesBay, sans-serif;
      letter-spacing: 1px;
      padding: 0 10px;
      text-align: center;
      justify-content: center;
      background: linear-gradient(
        to right,
        $townsfolk 0%,
        rgba(0, 0, 0, 0.5) 20%,
        rgba(0, 0, 0, 0.5) 80%,
        $demon 100%
      );

      @media (orientation: portrait) {
        font-size: 16px;
      }
    }
  }
}
</style>
