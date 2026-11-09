<template>
  <Modal class="end-game-modal" v-if="modals.endGame" @close="close">
    <h3>{{ $t("modals.endGame.title") }}</h3>
    <div class="winners">
      <div class="button good" @click="end('good')">
        {{ $t("modals.endGame.good") }}
      </div>
      <div class="button evil" @click="end('evil')">
        {{ $t("modals.endGame.evil") }}
      </div>
    </div>
    <p class="hint">{{ $t("modals.endGame.hint") }}</p>
  </Modal>
</template>

<script>
import { mapState } from "vuex";
import Modal from "./Modal";

/**
 * Storyteller: who won? Ends the game for everyone.
 */
export default {
  components: { Modal },
  computed: {
    ...mapState(["modals"]),
  },
  methods: {
    end(winner) {
      this.$store.dispatch("session/endGame", winner);
      this.close();
    },
    close() {
      this.$store.commit("toggleModal", "endGame");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.end-game-modal :deep(.modal) {
  min-width: min(380px, 90vw);
  max-width: 460px;
}

// clear of the window's buttons in the top corner
.end-game-modal h3 {
  margin: 0 50px 15px;
}

.winners {
  display: flex;
  gap: 12px;
  .button {
    flex: 1;
    margin: 0;
    padding: 12px 0;
    font-size: 120%;
    text-align: center;
  }
  .good {
    background: linear-gradient(#4e4e4e, $townsfolk);
  }
  .evil {
    background: linear-gradient(#4e4e4e, $demon);
  }
}

.hint {
  margin-top: 12px;
  font-size: 85%;
  color: lightgray;
  text-align: center;
}
</style>
