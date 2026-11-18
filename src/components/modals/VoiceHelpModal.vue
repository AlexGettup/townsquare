<template>
  <Modal class="voice-help" v-if="modals.voiceHelp" @close="close">
    <h3>
      <font-awesome-icon icon="exclamation-triangle" />
      {{ $t("voice.help.title") }}
    </h3>
    <p class="hint">{{ $t("voice.help.hint") }}</p>

    <!-- in voice (or it failed): fix it from here -->
    <div class="fixes" v-if="voice.status !== 'off'">
      <button
        class="button"
        v-if="isConnected"
        :disabled="busy"
        @click="checkAudio"
      >
        <span class="inner">
          <font-awesome-icon icon="volume-up" />
          {{ $t("voice.cantHear") }}
          <small>{{ $t("voice.cantHearHint") }}</small>
        </span>
      </button>
      <button class="button" :disabled="busy" @click="reconnect">
        <span class="inner">
          <font-awesome-icon icon="redo-alt" />
          {{ $t("voice.help.reconnect") }}
          <small>{{ $t("voice.help.reconnectHint") }}</small>
        </span>
      </button>
    </div>

    <!-- or tell what happened -->
    <form class="report" @submit.prevent="sendReport">
      <label for="voice-help-text">{{ $t("voice.help.describe") }}</label>
      <textarea
        id="voice-help-text"
        v-model="text"
        rows="3"
        maxlength="500"
        :placeholder="$t('voice.help.placeholder')"
        @keyup.stop
        @keydown.stop
      ></textarea>
      <button class="button townsfolk" :disabled="busy || !text.trim()">
        <font-awesome-icon icon="paper-plane" />
        {{ $t("voice.help.send") }}
      </button>
    </form>
  </Modal>
</template>

<script>
import { mapGetters, mapMutations, mapState } from "vuex";
import Modal from "./Modal";

/**
 * Voice chat trouble (the warning button beside the voice button): receive
 * everyone again, reconnect, or tell what went wrong. Each one sends the
 * voice server's logs what this device sees (never any audio).
 */
export default {
  components: { Modal },
  data() {
    return { text: "", busy: false };
  },
  computed: {
    ...mapState(["modals", "voice"]),
    ...mapGetters("voice", ["isConnected"]),
  },
  methods: {
    async run(action, payload) {
      this.busy = true;
      try {
        await this.$store.dispatch(action, payload);
      } finally {
        this.busy = false;
      }
      this.close();
    },
    checkAudio() {
      return this.run("voice/checkAudio");
    },
    reconnect() {
      return this.run("voice/reconnect");
    },
    async sendReport() {
      const text = this.text.trim();
      if (!text) return;
      await this.run("voice/sendReport", text);
      this.text = "";
    },
    close() {
      if (this.modals.voiceHelp) this.toggleModal("voiceHelp");
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
.voice-help :deep(.modal) {
  width: 480px;
  max-width: 100%;
}

h3 svg {
  margin-right: 6px;
  color: #ffb347;
}

.hint {
  margin: 0 0 12px;
  opacity: 0.8;
  font-size: 90%;
}

.fixes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  .button {
    margin: 0;
    display: block;
    width: 100%;
    height: auto;
    text-align: left;
    line-height: 1.3;
    white-space: normal;
    // the buttons' usual spacers would add an empty line here
    &:before,
    &:after {
      display: none;
    }
    .inner {
      display: block;
      padding: 8px 12px;
    }
    svg {
      margin-right: 6px;
    }
    small {
      display: block;
      margin-top: 2px;
      opacity: 0.75;
      font-weight: normal;
    }
  }
}

.report {
  display: flex;
  flex-direction: column;
  gap: 6px;
  label {
    font-size: 90%;
  }
  textarea {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.4);
    color: white;
    font: inherit;
    resize: vertical;
  }
  .button {
    margin: 0;
    align-self: flex-end;
    svg {
      margin-right: 6px;
    }
  }
}
</style>
