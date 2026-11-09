<template>
  <li class="game-over" v-if="winner" :class="winner">
    {{ $t(`gameOver.${winner}`) }}
  </li>
</template>

<script>
import { mapState } from "vuex";
import { playGatherBell } from "../voice/sounds";

/**
 * "Good wins!" / "Evil wins!" in the middle of the town square once the
 * storyteller ends the game, with the town bell. It stays until they deal
 * again or start a new game.
 */
export default {
  computed: {
    winner() {
      const { gameOver } = this.session;
      return gameOver ? gameOver.winner : null;
    },
    ...mapState(["grimoire", "session"]),
  },
  watch: {
    winner(winner, before) {
      if (winner && !before && !this.grimoire.isMuted) playGatherBell();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../vars.scss";

.game-over {
  // above the seats, like the day counter, and never in the way of a click
  position: relative;
  z-index: 21;
  pointer-events: none;
  margin-top: 6px;
  padding: 4px 16px;
  border-radius: 10px;
  border: 2px solid;
  background: rgba(0, 0, 0, 0.75);
  font-family: PiratesBay, sans-serif;
  font-size: 180%;
  line-height: 1.2;
  white-space: nowrap;
  animation: game-over 900ms ease-out;

  &.good {
    color: lighten($townsfolk, 15%);
    border-color: $townsfolk;
  }
  &.evil {
    color: lighten($demon, 10%);
    border-color: $demon;
  }
}

@keyframes game-over {
  0% {
    opacity: 0;
    transform: scale(0.4);
  }
  60% {
    opacity: 1;
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}
</style>
