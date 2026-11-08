<template>
  <div class="alert-notices">
    <transition-group name="alert" tag="div">
      <div
        class="alert"
        v-for="notice in alerts.notices"
        :key="notice.id"
        @click="$store.commit('alerts/remove', notice.id)"
      >
        <font-awesome-icon :icon="notice.icon" v-if="notice.icon" />
        <span>{{ $t(notice.key) }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script>
import { mapState } from "vuex";

/**
 * Notices that need the player (woken up, their turn to vote), at the top of
 * the screen. A tap dismisses them; they also go away on their own.
 */
export default {
  computed: {
    ...mapState(["alerts"]),
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.alert-notices {
  position: fixed;
  left: 50%;
  top: calc(10px + env(safe-area-inset-top, 0px));
  transform: translateX(-50%);
  z-index: 95;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  max-width: 95vw;
}

.alert {
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  padding: 10px 18px;
  font-size: 120%;
  font-weight: bold;
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid $townsfolk;
  border-radius: 10px;
  box-shadow: 0 0 15px $townsfolk;

  svg {
    color: $townsfolk;
  }
}

.alert-enter-active,
.alert-leave-active {
  transition: all 250ms;
}
.alert-enter,
.alert-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
