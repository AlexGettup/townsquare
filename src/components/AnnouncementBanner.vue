<template>
  <transition name="announce">
    <div
      class="announcement"
      v-if="shown"
      role="status"
      aria-live="polite"
      @click="shown = null"
    >
      <font-awesome-icon icon="bullhorn" />
      <span>{{ text }}</span>
    </div>
  </transition>
</template>

<script>
import { mapState } from "vuex";
import { announcementText } from "../announcements";
import { playAnnounceBell } from "../voice/sounds";

// how long an announcement stays on screen (a tap closes it sooner)
const SHOWN_FOR = 8 * 1000;

/**
 * The storyteller's announcement to the town ("Everyone to the town
 * square", "Nominations are open"…): a strip at the top for a few seconds,
 * with one soft bell. It stays in the chat and the diary afterwards.
 */
export default {
  data() {
    return { shown: null, timer: null };
  },
  computed: {
    ...mapState(["session", "grimoire"]),
    text() {
      return this.shown ? announcementText(this.shown, this.$t.bind(this)) : "";
    },
  },
  watch: {
    "session.announcement"(announcement, before) {
      if (!announcement || (before && before.id === announcement.id)) return;
      this.shown = announcement;
      if (!this.grimoire.isMuted) playAnnounceBell();
      clearTimeout(this.timer);
      this.timer = setTimeout(() => (this.shown = null), SHOWN_FOR);
    },
  },
  beforeDestroy() {
    clearTimeout(this.timer);
  },
};
</script>

<style scoped lang="scss">
.announcement {
  position: fixed;
  top: 52px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 75;
  max-width: min(520px, calc(100vw - 32px));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 200, 80, 0.6);
  background: rgba(20, 16, 28, 0.94);
  box-shadow: 0 0 16px black;
  color: #ffd88a;
  font-size: 18px;
  font-weight: bold;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;

  svg {
    flex: 0 0 auto;
  }
}

.announce-enter-active,
.announce-leave-active {
  transition:
    opacity 250ms,
    transform 250ms;
}
.announce-enter,
.announce-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}
</style>
