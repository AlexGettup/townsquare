<template>
  <li class="shown-grimoire" v-if="isShown">
    <span class="title">
      <font-awesome-icon icon="book-open" />
      {{ $t("shownGrimoire.title") }}
    </span>
    <span class="button" @click="close">{{ $t("player.closeMenu") }}</span>
  </li>
</template>

<script>
import { mapState } from "vuex";

/**
 * Player (Spy): the storyteller showed us their grimoire, which the town
 * square shows until we close it (the storyteller then sees we saw it) or
 * day comes.
 */
export default {
  computed: {
    isShown() {
      return !!this.session.shownGrimoire && !this.session.gameOver;
    },
    ...mapState(["session"]),
  },
  methods: {
    close() {
      this.$store.commit("session/closeShownGrimoire");
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../vars.scss";

.shown-grimoire {
  // above the seats, like the day counter
  position: relative;
  z-index: 21;
  margin-top: 6px;
  padding: 4px 6px 4px 14px;
  border-radius: 10px;
  border: 2px solid $fabled;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;

  .title {
    font-family: PiratesBay, sans-serif;
    font-size: 130%;
    color: $fabled;
    svg {
      margin-right: 6px;
    }
  }

  .button {
    margin: 0;
    padding: 2px 14px;
    font-size: 90%;
  }
}
</style>
