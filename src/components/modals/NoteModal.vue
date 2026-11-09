<template>
  <Modal class="note-modal" v-if="isDisplayed" @close="close">
    <h3>{{ $t("modals.note.title", { name }) }}</h3>
    <textarea
      ref="text"
      class="note-text"
      rows="6"
      maxlength="2000"
      :placeholder="$t('modals.note.placeholder')"
      v-model="text"
      @keyup="keyup"
    ></textarea>
    <p class="note-hint">{{ $t("modals.note.hint") }}</p>
    <div class="note-actions">
      <a class="clear" v-if="hasNotes" @click="clearAll">
        <font-awesome-icon icon="trash-alt" />
        {{ $t("modals.note.clearAll") }}
      </a>
      <div class="button" @click="close">{{ $t("player.closeMenu") }}</div>
    </div>
  </Modal>
</template>

<script>
import { mapGetters, mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import { isTouchScreen } from "../../touch";

/**
 * Your note about a player, saved as you type. Only you see it.
 */
export default {
  components: { Modal },
  props: ["playerIndex"],
  data() {
    return {
      // kept while open: the seats can move during the game, the note can't
      player: null,
    };
  },
  computed: {
    isDisplayed() {
      return !!(this.modals.note && this.player);
    },
    name() {
      return this.player ? this.player.name : "";
    },
    text: {
      get() {
        return this.noteOf(this.name);
      },
      set(text) {
        this.$store.commit("notes/set", { name: this.name, text });
      },
    },
    ...mapState(["modals"]),
    ...mapState("players", ["players"]),
    ...mapGetters("notes", ["noteOf", "hasNotes"]),
  },
  watch: {
    "modals.note": {
      immediate: true,
      handler(isOpen) {
        this.player = isOpen ? this.players[this.playerIndex] || null : null;
        if (!this.isDisplayed) return;
        // a note to read doesn't need the on-screen keyboard
        if (isTouchScreen() && this.text) return;
        this.$nextTick(() => {
          const { text } = this.$refs;
          if (!text) return;
          text.focus();
          text.selectionStart = text.selectionEnd = text.value.length;
        });
      },
    },
  },
  methods: {
    close() {
      this.toggleModal("note");
    },
    // the letters typed here aren't the app's keyboard shortcuts
    keyup(event) {
      if (event.key === "Esc" || event.key === "Escape") return;
      event.stopPropagation();
    },
    clearAll() {
      if (confirm(this.$t("dialogs.clearNotes"))) {
        this.$store.commit("notes/clear");
      }
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.note-text {
  display: block;
  box-sizing: border-box;
  width: min(480px, 80vw);
  margin-top: 8px;
  padding: 8px;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  outline: none;
  // below 16 px, iPhones zoom in on the page when writing
  font:
    16px/1.3 "Roboto Condensed",
    sans-serif;
  resize: vertical;
  user-select: text;
  -webkit-user-select: text;

  &:focus {
    border-color: white;
  }
}

.note-hint {
  margin: 6px 0;
  color: #bbb;
  font-size: 75%;
}

.note-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;

  .clear {
    margin-right: auto;
    color: #bbb;
    font-size: 80%;
    cursor: pointer;

    &:hover {
      color: $demon;
    }
  }
  .button {
    margin: 0;
    min-width: 90px;
    text-align: center;
  }
}
</style>

<style lang="scss">
// touch screens: at the top, where the on-screen keyboard doesn't cover it
@media (hover: none) {
  .modal-backdrop.note-modal {
    align-items: flex-start;
    padding-top: 12px;
  }
}
</style>
