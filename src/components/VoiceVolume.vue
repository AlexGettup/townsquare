<template>
  <li class="voice-volume" @click.stop="">
    <font-awesome-icon :icon="percent ? 'volume-up' : 'volume-mute'" />
    <input
      type="range"
      min="0"
      max="200"
      step="10"
      :value="percent"
      :aria-label="$t('voice.volume')"
      :title="$t('voice.volume')"
      @input="setVolume"
    />
    <span class="percent">{{ percent }}%</span>
  </li>
</template>

<script>
import { mapGetters } from "vuex";

/**
 * How loud we play one person in voice chat, in the voice panel.
 */
export default {
  props: {
    peerId: {
      type: String,
      required: true,
    },
  },
  computed: {
    percent: function () {
      return Math.round(this.volumeOf(this.peerId) * 100);
    },
    ...mapGetters("voice", ["volumeOf"]),
  },
  methods: {
    setVolume({ target }) {
      this.$store.commit("voice/setVolume", {
        peerId: this.peerId,
        volume: Number(target.value) / 100,
      });
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.voice-volume {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 32px !important;
  color: $outsider;
  cursor: default !important;

  input {
    flex: 1;
    min-width: 0;
    margin: 0;
    accent-color: $outsider;
    cursor: pointer;
    // dragging the slider must not scroll the bottom panel sideways
    touch-action: pan-y;
  }

  // wide enough for 200% so that the slider doesn't jump while moving
  .percent {
    flex-shrink: 0;
    min-width: 3em;
    font-size: 85%;
    text-align: right;
  }

  svg {
    flex-shrink: 0;
    width: 1.2em;
    margin: 0 !important;
  }
}
</style>
