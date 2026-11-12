<template>
  <div class="practice-badge" v-if="practice.active && players.length">
    <font-awesome-icon icon="user-graduate" />
    <span>{{ $t("practice.badge") }}</span>
    <span class="leave" @click="leave">{{ $t("practice.leave") }}</span>
    <!-- by day: a made-up player nominates another, at random -->
    <span
      class="nominate"
      v-if="canNominate"
      :title="$t('practice.nominateHint')"
      @click="$store.dispatch('practice/randomNomination')"
    >
      <font-awesome-icon icon="dice" />
      {{ $t("practice.nominate") }}
    </span>
    <!-- the made-up players answer cards and choices by themselves -->
    <span
      class="nominate auto"
      :class="{ on: practice.auto }"
      :title="$t('practice.autoHint')"
      @click="$store.commit('practice/setAuto', !practice.auto)"
    >
      <font-awesome-icon icon="robot" />
      {{ $t("practice.auto") }}
    </span>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";

/**
 * Top left corner during a practice game (where voice goes in a live one):
 * says it's practice, leaves it, and by day makes a random nomination.
 */
export default {
  computed: {
    ...mapState(["practice"]),
    ...mapState("players", ["players"]),
    ...mapGetters("practice", ["canNominate"]),
  },
  methods: {
    leave() {
      if (confirm(this.$t("practice.leaveConfirm"))) {
        this.$store.dispatch("practice/stop");
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.practice-badge {
  position: absolute;
  left: 10px;
  top: 8px;
  z-index: 76;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  // the menu buttons are on the right: below them on narrow phones
  max-width: calc(100% - 175px);
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid $townsfolk;
  border-radius: 16px;
  font-size: 90%;

  .nominate {
    cursor: pointer;
    padding: 1px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.12);
    white-space: nowrap;
    &:hover {
      color: $townsfolk;
    }
    &.on {
      background: $townsfolk;
      color: white;
    }
  }

  .leave {
    cursor: pointer;
    text-decoration: underline;
    opacity: 0.85;
    &:hover {
      color: red;
    }
  }
}
</style>
