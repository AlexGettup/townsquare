<template>
  <div class="voice-corner" v-if="voice.isAvailable && session.sessionId">
    <VoicePanel />
  </div>
</template>

<script>
import { mapState } from "vuex";
import VoicePanel from "./VoicePanel";

/**
 * Top left corner: the voice button and its panel.
 */
export default {
  components: { VoicePanel },
  computed: {
    ...mapState(["voice", "session"]),
  },
};
</script>

<style scoped lang="scss">
.voice-corner {
  position: absolute;
  left: 10px;
  top: 3px;
  z-index: 76;
  max-width: calc(100vw - 20px);
}
</style>
