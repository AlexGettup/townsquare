<template>
  <Modal class="announce" v-if="modals.announce" @close="close">
    <h3>
      <font-awesome-icon icon="bullhorn" />
      {{ $t("announce.title") }}
    </h3>
    <p class="hint">{{ $t("announce.hint") }}</p>

    <!-- one tap: the usual ones -->
    <div class="presets">
      <button
        v-for="key in presets"
        :key="key"
        class="button"
        @click="announce({ key })"
      >
        {{ $t(`announce.presets.${key}`) }}
      </button>
    </div>

    <!-- or their own words -->
    <form class="own" @submit.prevent="announce({ text })">
      <input
        ref="input"
        v-model="text"
        :maxlength="maxText"
        :placeholder="$t('announce.placeholder')"
        @keyup.stop
        @keydown.stop
      />
      <button class="button townsfolk" :disabled="!text.trim()">
        {{ $t("announce.send") }}
      </button>
    </form>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import { MAX_TEXT, PRESETS } from "../../announcements";

/**
 * Storyteller: announce something to the whole town (back to the town
 * square, nominations open…). Everyone sees it at the top of the screen with
 * a soft bell (AnnouncementBanner).
 */
export default {
  components: { Modal },
  data() {
    return { text: "", presets: PRESETS, maxText: MAX_TEXT };
  },
  computed: {
    ...mapState(["modals"]),
  },
  methods: {
    announce({ key = null, text = null }) {
      const words = text ? text.trim().slice(0, MAX_TEXT) : null;
      if (!key && !words) return;
      this.$store.commit("session/setAnnouncement", {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        key,
        text: key ? null : words,
      });
      this.text = "";
      this.close();
    },
    close() {
      this.toggleModal("announce");
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
.announce :deep(.modal) {
  width: 480px;
  max-width: 100%;
}

h3 svg {
  margin-right: 6px;
}

.hint {
  margin: 0 0 12px;
  opacity: 0.8;
  font-size: 90%;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-bottom: 14px;
  .button {
    margin: 0;
  }
}

.own {
  display: flex;
  gap: 6px;
  input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.4);
    color: white;
    font: inherit;
  }
  .button {
    margin: 0;
  }
}
</style>
