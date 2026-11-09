<template>
  <div class="choose-players" v-if="isPicking">
    <div class="what">
      <h3>{{ $t(`cards.phrases.${message.card.phrase}`) }}</h3>
      <p class="text" v-if="message.card.text">{{ message.card.text }}</p>
      <p class="picked" :class="{ empty: !chat.picked.length }">
        {{ chat.picked.join(", ") || $t("cards.tapSeat") }}
      </p>
      <p class="failed" v-if="chat.answerStatus === 'failed'">
        {{ $t("cards.notSent") }}
      </p>
    </div>
    <div class="actions">
      <div
        class="button townsfolk"
        :class="{ disabled: !canConfirm }"
        @click="$store.dispatch('chat/answerCard')"
      >
        {{ $t("cards.confirm") }}
      </div>
      <a class="later" @click="$store.dispatch('chat/closeCard')">
        {{ $t("cards.later") }}
      </a>
    </div>
  </div>
  <!-- not answered yet: "Later", another card on top, or back after a reload -->
  <div
    class="choose-pending"
    v-else-if="pendingChoice && !chat.shownCard && !session.nomination"
    @click="$store.commit('chat/showCard', pendingChoice)"
  >
    <font-awesome-icon icon="address-card" />
    {{ $t(`cards.phrases.${pendingChoice.card.phrase}`) }}
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";

/**
 * Player answering a "choose a player" card: this box sits outside the
 * circle, so that the seats stay in view and are tapped directly (see
 * onSeatPick in Player.vue).
 */
export default {
  computed: {
    message: function () {
      return this.shownMessage;
    },
    canConfirm: function () {
      return (
        this.isConnected &&
        this.chat.answerStatus !== "sending" &&
        this.chat.picked.length === this.seatsToPick
      );
    },
    ...mapState(["chat", "session"]),
    ...mapGetters("chat", [
      "isPicking",
      "isConnected",
      "pendingChoice",
      "seatsToPick",
      "shownMessage",
    ]),
  },
};
</script>

<style lang="scss">
// the panels leave the seats free, except on screens wide enough for both
@media (max-width: 1199.98px), (max-height: 500px), (orientation: portrait) {
  #app.picking {
    .bluffs,
    .npcs,
    .chat {
      visibility: hidden;
    }
  }
}
</style>

<style scoped lang="scss">
.choose-players {
  // the corner the circle never reaches, below the menu buttons
  position: fixed;
  top: 55px;
  right: 10px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 180px;
  max-height: calc(100% - 65px);
  overflow-y: auto;
  padding: 10px;
  text-align: center;
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid white;
  border-radius: 10px;
  overflow-wrap: anywhere;
  // upright, the free space is a strip below the circle
  @media (orientation: portrait) {
    top: auto;
    bottom: 10px;
    left: 10px;
    width: auto;
    max-height: 30%;
    flex-direction: row;
    justify-content: space-between;
    gap: 10px;
    text-align: left;
  }
}

.what,
.actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.what {
  min-width: 0;
}

.actions {
  flex-shrink: 0;
  align-items: center;
}

h3 {
  font-size: 110%;
  line-height: 1.2;
}

p {
  margin: 0;
  font-size: 85%;
}

.picked {
  font-weight: bold;
  &.empty {
    font-weight: normal;
    color: lightgray;
  }
}

.button {
  margin: 0;
}

.failed {
  color: #ff8080;
}

.choose-pending {
  position: fixed;
  top: 55px;
  right: 10px;
  z-index: 60;
  max-width: 180px;
  padding: 6px 10px;
  font-size: 85%;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid white;
  border-radius: 10px;
  &:hover {
    color: red;
  }
}

.later {
  font-size: 80%;
  color: lightgray;
  cursor: pointer;
  text-decoration: underline;
}
</style>
