<template>
  <li class="voice-noise" @click.stop="">
    <label class="check" :class="{ unavailable: !canDenoise }">
      <input
        type="checkbox"
        :checked="processing.denoise && canDenoise"
        :disabled="!canDenoise"
        @change="set({ denoise: $event.target.checked })"
      />
      {{ $t("voice.denoise") }}
    </label>
    <small class="hint" v-if="!canDenoise">
      {{ $t("voice.denoiseUnavailable") }}
    </small>

    <label class="check">
      <input
        type="checkbox"
        :checked="processing.auto"
        @change="set({ auto: $event.target.checked })"
      />
      {{ $t("voice.autoSensitivity") }}
    </label>

    <div class="sensitivity">
      <span>{{ $t("voice.sensitivity") }}</span>
      <div class="meter" :class="{ open: level && level.open }">
        <div class="fill" :style="{ width: percent(level && level.level) }" />
        <div
          class="mark"
          v-if="shownThreshold !== null"
          :style="{ left: percent(shownThreshold) }"
        />
        <input
          type="range"
          v-if="!processing.auto"
          :min="MIN_DB"
          :max="MAX_DB"
          step="1"
          :value="processing.threshold"
          @input="set({ threshold: Number($event.target.value) })"
          @keyup.stop=""
        />
      </div>
      <small class="hint">{{ $t("voice.sensitivityHint") }}</small>
      <small class="hint" v-if="voice.status !== 'connected'">
        {{ $t("voice.meterOffline") }}
      </small>
    </div>
  </li>
</template>

<script>
import { mapState } from "vuex";

const MIN_DB = -80;
const MAX_DB = -10;

/**
 * Noise suppression and the voice gate's sensitivity, like Discord: a live
 * level meter with the threshold line, set automatically or by hand.
 */
export default {
  data() {
    return {
      MIN_DB,
      MAX_DB,
      level: null,
      frame: null,
    };
  },
  computed: {
    processing() {
      return this.voice.processing;
    },
    // until the meter says otherwise, assume it works
    canDenoise() {
      return !this.level || this.level.canDenoise;
    },
    shownThreshold() {
      if (!this.processing.auto) return this.processing.threshold;
      return this.level ? this.level.threshold : null;
    },
    ...mapState(["voice"]),
  },
  mounted() {
    const update = () => {
      this.level = this.$store.$voice ? this.$store.$voice.getMicLevel() : null;
      this.frame = requestAnimationFrame(update);
    };
    update();
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frame);
  },
  methods: {
    set(changes) {
      this.$store.dispatch("voice/setProcessing", changes);
    },
    percent(db) {
      if (typeof db !== "number") return "0%";
      const share = (db - MIN_DB) / (MAX_DB - MIN_DB);
      return Math.round(Math.min(1, Math.max(0, share)) * 1000) / 10 + "%";
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../vars.scss";

.voice-noise {
  display: flex;
  flex-direction: column;
  // the menu's rows centre their content
  align-items: stretch !important;
  gap: 6px;
  padding: 4px 10px 8px;
  cursor: default;
  font-size: 90%;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  &.unavailable {
    opacity: 0.6;
    cursor: default;
  }
  input {
    width: 16px;
    height: 16px;
  }
}

.hint {
  color: lightgray;
  font-size: 80%;
}

.sensitivity {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meter {
  position: relative;
  height: 14px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;

  .fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: #888;
    transition: width 60ms linear;
  }
  &.open .fill {
    background: #3ba55c;
  }
  .mark {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    margin-left: -1px;
    background: $fabled;
  }
  // the slider lies over the meter: its thumb is the threshold
  input[type="range"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
}
</style>
