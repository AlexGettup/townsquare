<template>
  <li class="day-phase">
    <span
      class="phase"
      :class="{ editable: isStoryteller }"
      :title="isStoryteller ? $t('dayPhase.editCount') : ''"
      @click="editCount"
    >
      <font-awesome-icon :icon="grimoire.isNight ? 'cloud-moon' : 'sun'" />
      {{ label }}
    </span>
    <span
      class="timer"
      v-if="timer"
      :class="{ over: remaining === 0, soon: remaining > 0 && remaining <= 30 }"
      :title="isStoryteller ? $t('dayPhase.stopTimer') : ''"
      @click="stopTimer"
    >
      <font-awesome-icon icon="hourglass-half" />
      {{ remaining === 0 ? $t("dayPhase.timeUp") : clock }}
    </span>
    <span
      class="timer start"
      v-else-if="isStoryteller && !grimoire.isNight"
      :title="$t('dayPhase.startTimer')"
      @click="startTimer"
    >
      <font-awesome-icon icon="hourglass-start" />
    </span>
  </li>
</template>

<script>
import { mapState } from "vuex";
import { playChime } from "../voice/sounds";

// how long "Time's up" stays on screen
const TIME_UP_SHOWN = 15 * 1000;

/**
 * "Day 2" / "Night 3" and the day timer, in the middle of the town square.
 * The storyteller counts the nights by switching to night, can correct the
 * count by clicking it, and starts and stops the timer that everyone sees.
 */
export default {
  data() {
    return {
      now: Date.now(),
      ticker: null,
    };
  },
  computed: {
    isStoryteller() {
      return !this.session.isSpectator;
    },
    label() {
      const count = this.grimoire.nightCount;
      if (this.grimoire.isNight) {
        return count
          ? this.$t("dayPhase.night", { count })
          : this.$t("townInfo.nightPhase");
      }
      return count
        ? this.$t("dayPhase.day", { count })
        : this.$t("dayPhase.setup");
    },
    timer() {
      const timer = this.session.dayTimer;
      if (!timer || this.now - timer.endsAt > TIME_UP_SHOWN) return null;
      return timer;
    },
    // seconds left, 0 once it's over
    remaining() {
      if (!this.timer) return 0;
      return Math.max(0, Math.ceil((this.timer.endsAt - this.now) / 1000));
    },
    clock() {
      const minutes = Math.floor(this.remaining / 60);
      const seconds = String(this.remaining % 60).padStart(2, "0");
      return `${minutes}:${seconds}`;
    },
    ...mapState(["grimoire", "session"]),
  },
  watch: {
    "session.dayTimer": {
      immediate: true,
      handler(timer) {
        clearInterval(this.ticker);
        this.now = Date.now();
        if (timer) this.ticker = setInterval(this.tick, 250);
      },
    },
    remaining(seconds, before) {
      if (seconds === 0 && before > 0 && !this.grimoire.isMuted) playChime();
    },
  },
  beforeDestroy() {
    clearInterval(this.ticker);
  },
  methods: {
    tick() {
      this.now = Date.now();
      if (!this.timer) clearInterval(this.ticker);
    },
    editCount() {
      if (!this.isStoryteller) return;
      const answer = prompt(
        this.$t(
          this.grimoire.isNight ? "dialogs.nightCount" : "dialogs.dayCount",
        ),
        this.grimoire.nightCount,
      );
      if (answer === null) return;
      const count = parseInt(answer, 10);
      if (count >= 0 && count < 100) this.$store.commit("setNightCount", count);
    },
    startTimer() {
      const answer = prompt(this.$t("dialogs.dayTimer"), 5);
      if (answer === null) return;
      const minutes = parseFloat(String(answer).replace(",", "."));
      if (!(minutes > 0 && minutes <= 120)) return;
      const duration = Math.round(minutes * 60) * 1000;
      this.$store.commit("session/setDayTimer", {
        remaining: duration,
        duration,
      });
    },
    stopTimer() {
      if (!this.isStoryteller) return;
      if (this.remaining === 0 || confirm(this.$t("dialogs.stopDayTimer"))) {
        this.$store.commit("session/setDayTimer", null);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../vars.scss";

.day-phase {
  gap: 4px 14px;
  margin-top: 2px;
  // above the circle of seats and their reminders, which reach the middle
  // (seats go up to 20), but below a seat under the mouse (25) and its menu.
  // Only the parts you can click catch clicks
  position: relative;
  z-index: 21;
  pointer-events: none;

  .phase.editable,
  .timer {
    cursor: pointer;
    pointer-events: all;
  }

  svg {
    margin-right: 5px !important;
  }

  .phase svg {
    color: $fabled;
  }

  .timer {
    font-variant-numeric: tabular-nums;

    &.start {
      opacity: 0.8;
      &:hover {
        opacity: 1;
        color: $fabled;
      }
    }
    &.soon {
      color: #ffb347;
    }
    &.over {
      color: $demon;
      animation: time-up 1s ease-in-out infinite;
    }
  }
}

@keyframes time-up {
  50% {
    opacity: 0.4;
  }
}
</style>
