<template>
  <div class="practice-badge" v-if="practice.active && players.length">
    <font-awesome-icon icon="user-graduate" />
    <span>{{ $t("practice.badge") }}</span>
    <span class="leave" @click="leave">{{ $t("practice.leave") }}</span>
  </div>
</template>

<script>
import { mapState } from "vuex";

/**
 * Top left corner during a practice game (where voice goes in a live one):
 * says it's practice, and leaves it.
 */
export default {
  computed: {
    ...mapState(["practice"]),
    ...mapState("players", ["players"]),
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
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid $townsfolk;
  border-radius: 16px;
  font-size: 90%;

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
