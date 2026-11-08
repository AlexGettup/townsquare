<template>
  <Modal class="info-card-modal" v-if="chat.shownCard" @close="close">
    <InfoCard :card="chat.shownCard.card" />
    <p class="hint" v-if="isChoice">{{ $t("cards.choiceHint") }}</p>
    <div class="button-group">
      <div class="button townsfolk" @click="close">
        {{ $t("cards.gotIt") }}
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapState } from "vuex";
import Modal from "./Modal";
import InfoCard from "../InfoCard";

/** Shows an info card received from the storyteller (or reopened). */
export default {
  components: { Modal, InfoCard },
  computed: {
    ...mapState(["chat"]),
    // the player answers a "choose…" card in the private chat
    isChoice: function () {
      const { phrase } = this.chat.shownCard.card;
      return !!phrase && phrase.startsWith("choose");
    },
  },
  methods: {
    close() {
      this.$store.dispatch("chat/closeCard");
    },
  },
};
</script>

<style scoped lang="scss">
.info-card-modal :deep(.modal) {
  overflow-y: auto;
  // room for the maximize and close buttons in the top right corner
  padding: 45px 30px 20px;
}
.button-group {
  margin-top: 15px;
}
.hint {
  margin: 12px 0 0;
  text-align: center;
  font-size: 85%;
  color: lightgray;
}
</style>
