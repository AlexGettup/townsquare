<template>
  <Modal class="info-card-modal" v-if="chat.shownCard" @close="close">
    <InfoCard :card="chat.shownCard.card" />
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
  },
  methods: {
    close() {
      this.$store.commit("chat/hideCard");
    },
  },
};
</script>

<style scoped lang="scss">
.info-card-modal :deep(.modal) {
  overflow-y: auto;
  padding: 20px 30px;
}
.button-group {
  margin-top: 15px;
}
</style>
