<template>
  <div class="voice-corner" v-if="voice.isAvailable && session.sessionId">
    <VoiceMenu />
    <VoiceConversations />
  </div>
</template>

<script>
import { mapState } from "vuex";
import VoiceMenu from "./VoiceMenu";
import VoiceConversations from "./VoiceConversations";

/**
 * Top left corner: everything about voice chat. The voice button (its menu
 * unfolds downwards) and, below it, the conversations and rooms.
 */
export default {
  components: { VoiceMenu, VoiceConversations },
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  max-width: calc(100vw - 20px);
}
</style>
