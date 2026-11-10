<template>
  <Modal class="practice-inbox" v-if="item && player" @close="done">
    <h3>{{ $t("practice.sees", { name: player.name }) }}</h3>
    <p class="count" v-if="inbox.length > 1">
      {{ $t("practice.count", { count: inbox.length - 1 }) }}
    </p>

    <!-- an info card, as the player gets it -->
    <template v-if="item.kind === 'card' && message">
      <InfoCard :card="message.card" />

      <!-- "choose a player": the player taps seats, here the names -->
      <template v-if="seatsToChoose">
        <p class="hint">
          {{ $tc("practice.choose", seatsToChoose, { name: player.name }) }}
        </p>
        <ul class="names">
          <li
            v-for="name in names"
            :key="name"
            :class="{ picked: picked.includes(name) }"
            @click="pick(name)"
          >
            {{ name }}
          </li>
        </ul>
        <div class="button-group">
          <div
            class="button townsfolk"
            :class="{ disabled: picked.length !== seatsToChoose }"
            @click="answer"
          >
            {{ $t("practice.answer") }}
          </div>
          <div class="button" @click="done">{{ $t("cards.later") }}</div>
        </div>
      </template>

      <!-- anything else: they can write back in the private chat -->
      <template v-else>
        <textarea
          v-model="reply"
          :placeholder="$t('practice.reply', { name: player.name })"
          rows="2"
          @keyup.stop=""
        ></textarea>
        <div class="button-group">
          <div class="button townsfolk" @click="done">
            {{ reply.trim() ? $t("practice.sendAndClose") : $t("cards.gotIt") }}
          </div>
        </div>
      </template>
    </template>

    <!-- the grimoire shown to them (Spy) -->
    <template v-if="item.kind === 'grimoire'">
      <p class="grimoire">
        <font-awesome-icon icon="book-open" />
        {{ $t("practice.grimoire", { name: player.name }) }}
      </p>
      <div class="button-group">
        <div class="button townsfolk" @click="done">
          {{ $t("practice.closeAs", { name: player.name }) }}
        </div>
      </div>
    </template>

    <div class="button-group skip" v-if="inbox.length > 1">
      <div class="button" @click="doneAll">{{ $t("practice.seeAll") }}</div>
    </div>
  </Modal>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import Modal from "./Modal";
import InfoCard from "../InfoCard";

// cards answered by tapping seats: how many to pick
const SEATS_TO_CHOOSE = {
  choosePlayer: 1,
  chooseTwoPlayers: 2,
  // the pointing vote (Boomdandy)
  pointAtPlayer: 1,
};

/**
 * Practice game: what a made-up player received (an info card, the grimoire),
 * one at a time. The storyteller acts for them: closing it is the player
 * seeing it, and they can pick seats or write back.
 */
export default {
  components: { Modal, InfoCard },
  data() {
    return {
      picked: [],
      reply: "",
    };
  },
  computed: {
    ...mapState("practice", ["inbox"]),
    ...mapState("players", ["players"]),
    ...mapGetters("practice", { item: "current" }),
    player() {
      return this.item
        ? this.players.find(({ id }) => id === this.item.playerId) || null
        : null;
    },
    message() {
      if (!this.item || !this.item.messageId) return null;
      return (
        this.$store.state.chat.messages.find(
          ({ id }) => id === this.item.messageId,
        ) || null
      );
    },
    seatsToChoose() {
      return (this.message && SEATS_TO_CHOOSE[this.message.card.phrase]) || 0;
    },
    // anyone can be picked, themselves and the dead included
    names() {
      return this.players.map(({ name }) => name);
    },
  },
  watch: {
    item() {
      this.picked = [];
      this.reply = "";
    },
    // a player removed from the game, or the chat emptied: it goes too
    player(player) {
      if (this.item && !player)
        this.$store.commit("practice/close", this.item.id);
    },
    message(message) {
      if (this.item && this.item.kind === "card" && !message)
        this.$store.commit("practice/close", this.item.id);
    },
  },
  methods: {
    pick(name) {
      this.picked = this.picked.includes(name)
        ? this.picked.filter((picked) => picked !== name)
        : [...this.picked, name].slice(-this.seatsToChoose);
    },
    answer() {
      if (this.picked.length !== this.seatsToChoose) return;
      this.$store.$chat.seenBy(this.message.id);
      this.$store.$chat.answerAs(this.message.id, this.picked);
      this.$store.commit("practice/close", this.item.id);
    },
    // the player closes it: the storyteller gets the tick
    finish(item) {
      if (item.kind === "card") {
        this.$store.$chat.seenBy(item.messageId);
      } else if (this.$store.state.session.grimoireViews[item.playerId]) {
        this.$store.commit("session/setGrimoireView", {
          playerId: item.playerId,
          status: "seen",
        });
      }
      this.$store.commit("practice/close", item.id);
    },
    done() {
      if (!this.item) return;
      if (this.item.kind === "card" && this.reply.trim()) {
        this.$store.$chat.writeAs(this.item.playerId, this.reply);
      }
      this.finish(this.item);
    },
    doneAll() {
      this.done();
      [...this.inbox].forEach((item) => this.finish(item));
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.practice-inbox :deep(.modal) {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 45px 30px 20px;
  max-width: min(520px, 95vw);
  @media (max-width: 767.98px) {
    padding: 40px 12px 15px;
  }
}

h3 {
  margin: 0 0 10px;
  text-align: center;
  color: $townsfolk;
}

.count,
.hint,
.grimoire {
  margin: 0 0 12px;
  text-align: center;
  font-size: 90%;
  color: lightgray;
}

.grimoire {
  font-size: 110%;
  color: white;
}

.names {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  li {
    padding: 4px 12px;
    border: 2px solid black;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.12);
    cursor: pointer;
    &.picked {
      background: $townsfolk;
    }
  }
}

textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 15px 0 0;
  padding: 6px 8px;
  color: white;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  font: inherit;
  resize: vertical;
}

.button-group {
  margin-top: 12px;
  justify-content: center;
}

.skip .button {
  font-size: 80%;
}
</style>
