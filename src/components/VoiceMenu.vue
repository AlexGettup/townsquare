<template>
  <div class="voice-menu" :class="{ open: isOpen }">
    <span
      class="toggle"
      :class="[
        'status-' + voice.status,
        { muted: voice.muted, speaking: !!voice.speaking[selfPeerId] },
      ]"
      @click="toggle"
      :title="$t('voice.title')"
    >
      <font-awesome-icon :icon="icon" />
    </span>
    <ul>
      <li class="headline">{{ $t("voice.title") }}</li>

      <template v-if="!isConnected">
        <li class="error" v-if="voice.status === 'error'">
          <small>{{ errorMessage }}</small>
        </li>
        <li v-if="voice.status === 'connecting'" class="disabled">
          {{ $t("voice.connecting") }}
        </li>
        <li v-else @click="join">
          {{ $t("voice.join") }}
          <em><font-awesome-icon icon="headset" /></em>
        </li>
      </template>

      <template v-else>
        <li @click="toggleMute">
          {{ $t("voice.muteMicrophone") }}
          <em>
            [M]
            <font-awesome-icon
              :icon="['fas', voice.muted ? 'check-square' : 'square']"
            />
          </em>
        </li>
        <li @click="leave">
          {{ $t("voice.leave") }}
          <em><font-awesome-icon icon="sign-out-alt" /></em>
        </li>

        <li class="headline">{{ $t("voice.participants") }}</li>
        <li
          v-for="participant in participants"
          :key="participant.peerId"
          class="participant"
          :class="{
            speaking: participant.speaking,
            muted: participant.muted,
            mutable: canMute(participant),
          }"
          :title="canMute(participant) ? $t('voice.mutePlayer') : ''"
          @click="mute(participant)"
        >
          <span class="name">{{ participant.name }}</span>
          <em>
            <font-awesome-icon
              :icon="participant.muted ? 'microphone-slash' : 'microphone'"
            />
          </em>
        </li>
      </template>
    </ul>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";

/**
 * Voice chat button and dropdown menu, next to the options menu.
 * Groups every voice control: join / leave, mute and the participant list
 * (where the storyteller can mute players).
 */
export default {
  data() {
    return {
      isOpen: false,
    };
  },
  computed: {
    icon: function () {
      if (!this.isConnected) return "headset";
      return this.voice.muted ? "microphone-slash" : "microphone";
    },
    errorMessage: function () {
      const key = `voice.errors.${this.voice.error}`;
      return this.$te(key) ? this.$t(key) : this.$t("voice.errors.generic");
    },
    // everyone in the voice room, ourselves first, then the storyteller and
    // the players in seat order
    participants: function () {
      const others = Object.entries(this.voice.peers).map(
        ([peerId, { muted }]) => ({
          peerId,
          muted,
          speaking: !!this.voice.speaking[peerId],
        }),
      );
      const self = {
        peerId: this.selfPeerId,
        muted: this.voice.muted,
        speaking: !!this.voice.speaking[this.selfPeerId],
        isSelf: true,
      };
      const order = (peerId) => {
        if (peerId === "host") return -1;
        const seat = this.players.findIndex((player) => player.id === peerId);
        return seat === -1 ? this.players.length : seat;
      };
      return [
        self,
        ...others.sort((a, b) => order(a.peerId) - order(b.peerId)),
      ].map((participant) => ({
        ...participant,
        name: this.nameOf(participant),
      }));
    },
    ...mapState(["voice", "session", "grimoire"]),
    ...mapState("players", ["players"]),
    ...mapGetters("voice", ["isConnected", "selfPeerId"]),
  },
  methods: {
    nameOf({ peerId, isSelf }) {
      let name;
      if (peerId === "host") {
        name = this.$t("voice.storyteller");
      } else {
        const player = this.players.find((player) => player.id === peerId);
        name = player ? player.name : this.$t("voice.spectator");
      }
      return isSelf ? `${name} (${this.$t("voice.you")})` : name;
    },
    toggle() {
      this.isOpen = !this.isOpen;
      // only one dropdown at a time
      if (this.isOpen && this.grimoire.isMenuOpen) {
        this.$store.commit("toggleMenu");
      }
    },
    join() {
      this.$store.dispatch("voice/join");
    },
    leave() {
      this.$store.dispatch("voice/leave");
    },
    toggleMute() {
      this.$store.dispatch("voice/toggleMute");
    },
    canMute(participant) {
      return (
        !this.session.isSpectator && !participant.isSelf && !participant.muted
      );
    },
    mute(participant) {
      if (this.canMute(participant)) {
        this.$store.dispatch("voice/mutePeer", participant.peerId);
      }
    },
  },
  watch: {
    // opening the options menu closes this one
    "grimoire.isMenuOpen"(isMenuOpen) {
      if (isMenuOpen) this.isOpen = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.voice-menu {
  display: inline-block;
  position: relative;
  vertical-align: top;
  margin-left: 10px;
  text-align: left;
}

// boxed like the options cog
.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 40px;
  height: 40px;
  font-size: 20px;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.5);
  border: 3px solid black;
  border-radius: 10px;
  transition:
    color 250ms,
    box-shadow 250ms;

  svg {
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
  }

  &:hover {
    color: red;
  }
  &.status-connecting {
    animation: blink 1s infinite;
  }
  &.status-connected {
    color: $voice-speaking;
    &.muted {
      color: $demon;
    }
    &.speaking {
      box-shadow: 0 0 10px 3px $voice-speaking;
    }
  }
  &.status-error {
    color: $demon;
  }
}

@keyframes blink {
  50% {
    opacity: 0.5;
    color: gray;
  }
}

// dropdown, unfolding like the options menu
ul {
  position: absolute;
  top: 43px;
  right: 0;
  width: 220px;
  display: flex;
  flex-direction: column;
  list-style-type: none;
  padding: 0;
  margin: 0;
  overflow: hidden;
  box-shadow: 0 0 10px black;
  border: 3px solid black;
  border-radius: 10px 0 10px 10px;
  transform-origin: 100% 0;
  transform: rotate(-90deg);
  opacity: 0;
  pointer-events: none;
  transition:
    transform 500ms cubic-bezier(0.68, -0.55, 0.27, 1.55),
    opacity 300ms;

  .open & {
    transform: rotate(0deg);
    opacity: 1;
    pointer-events: auto;
  }

  li {
    padding: 2px 5px;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 30px;

    @media (orientation: portrait) {
      font-size: 16px;
    }

    &:not(.headline):not(.disabled):not(.error):not(.participant):hover,
    &.participant.mutable:hover {
      cursor: pointer;
      color: red;
    }

    &.disabled {
      color: gray;
    }

    &.error {
      color: $demon;
    }

    em {
      flex-grow: 0;
      font-style: normal;
      margin-left: 10px;
      font-size: 80%;
    }

    &.participant {
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      &.speaking em {
        color: $voice-speaking;
        filter: drop-shadow(0 0 4px $voice-speaking);
      }
      &.muted em {
        color: $demon;
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
</style>
