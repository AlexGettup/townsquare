<template>
  <Modal
    class="practice-inbox"
    v-if="item && player && !practice.auto && !practice.viewAs"
    @close="done"
  >
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
          <div class="button" @click="answerAtRandom(item)">
            <font-awesome-icon icon="dice" />
            {{ $t("practice.random", { name: player.name }) }}
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
          <div
            class="button"
            v-if="randomAnswerOf(message)"
            @click="answerAtRandom(item)"
          >
            <font-awesome-icon icon="dice" />
            {{ $t("practice.random", { name: player.name }) }}
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
      <div class="button" @click="allAtRandom">
        <font-awesome-icon icon="dice" />
        {{ $t("practice.allRandom") }}
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import Modal from "./Modal";
import InfoCard from "../InfoCard";
import { grimoireSeats } from "../../store/modules/practice";
import { STORYTELLER } from "../../store/modules/voice";
import { SEATS_TO_CHOOSE, decide, knowledgeOf } from "../../practiceBrain";

// automatic players take between this and twice this to answer (ms)
const AUTO_DELAY = 1200;

/**
 * Practice game: what a made-up player received (an info card, the grimoire),
 * one at a time. The storyteller acts for them: closing it is the player
 * seeing it, and they can pick seats or write back. "At random" lets them
 * decide as their character would (src/practiceBrain.js): seats, a
 * character, or yes or no to using their ability.
 */
export default {
  components: { Modal, InfoCard },
  data() {
    return {
      picked: [],
      reply: "",
      // automatic players: items with an answer on the way
      answering: [],
    };
  },
  computed: {
    ...mapState(["practice"]),
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
    // characters a player could name: the script's, without travellers
    scriptRoles() {
      return [...this.$store.state.roles.values()].filter(
        ({ team }) => team !== "traveller" && team !== "fabled",
      );
    },
  },
  watch: {
    // automatic players: everything that arrives gets answered, a moment
    // later (as a person would), one after the other
    inbox: "answerByThemselves",
    "practice.auto": "answerByThemselves",
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
    messageOf(item) {
      if (item.kind !== "card") return null;
      return (
        this.$store.state.chat.messages.find(
          ({ id }) => id === item.messageId,
        ) || null
      );
    },
    /**
     * What a made-up player answers to this card, as their character would
     * (see src/practiceBrain.js), or null when it asks nothing:
     * { seats: [names], text } (text: what they add in the private chat,
     * like the Gambler's guess) or { text }.
     */
    randomAnswerOf(message) {
      if (!message || !message.card) return null;
      const playerId = message.channel.slice("dm:".length);
      const seats = grimoireSeats(this.players);
      const seat = seats.find(({ id }) => id === playerId);
      if (!seat) return null;
      const roleById = (id) =>
        this.$store.state.roles.get(id) ||
        this.$store.getters.rolesJSONbyId.get(id) ||
        null;
      // the cards the storyteller sent them, up to this one
      const cards = this.$store.state.chat.messages
        .filter(
          (other) =>
            other.channel === message.channel &&
            other.from === STORYTELLER &&
            other.card &&
            other.id < message.id,
        )
        .map(({ card, choice }) => ({ card, choice }));
      // what they think of the others, with "Automatic" on (store/practiceTown.js)
      const town = this.$store.$practiceTown;
      const view = town ? town.viewOf(playerId, message.id) : null;
      const me = view ? view.me : knowledgeOf(seat, cards, roleById);
      const answer = decide(me, message.card, {
        players: seats,
        scriptRoles: this.scriptRoles,
        nightCount: this.$store.state.grimoire.nightCount || 1,
        ...(view
          ? { scores: view.scores, opinion: view.opinion, claims: view.claims }
          : {}),
      });
      if (!answer) return null;
      // the Po chooses no-one tonight
      if (answer.nobody) return { text: this.$t("practice.say.nobody") };
      if (answer.seats && answer.guess) {
        const name = this.$store.getters.localizeRole(
          roleById(answer.guess),
        ).name;
        return {
          seats: answer.seats,
          text: this.$t("practice.say.guess", {
            name: answer.seats[0],
            role: name,
          }),
        };
      }
      // the Po's 3 players: the card takes one, the other two in the chat
      if (answer.seats && answer.more && answer.more.length) {
        return {
          seats: answer.seats,
          text: this.$t("practice.say.more", {
            names: answer.more.join(", "),
          }),
        };
      }
      if (answer.seats) return answer;
      if (answer.roleId) {
        return {
          text: this.$store.getters.localizeRole(roleById(answer.roleId)).name,
        };
      }
      return { text: this.$t(`cards.${answer.answer}`) };
    },
    // let them decide (if the card asks something), then close it
    answerAtRandom(item) {
      const message = this.messageOf(item);
      const answer = this.randomAnswerOf(message);
      if (answer && answer.seats) {
        this.$store.$chat.seenBy(message.id);
        this.$store.$chat.answerAs(message.id, answer.seats);
        if (answer.text) this.$store.$chat.writeAs(item.playerId, answer.text);
        this.$store.commit("practice/close", item.id);
        return;
      }
      if (answer) this.$store.$chat.writeAs(item.playerId, answer.text);
      this.finish(item);
    },
    answerByThemselves() {
      if (!this.practice.auto) return;
      this.inbox.forEach((item) => {
        if (this.answering.includes(item.id)) return;
        this.answering.push(item.id);
        const delay = AUTO_DELAY + Math.random() * AUTO_DELAY;
        setTimeout(() => {
          this.answering = this.answering.filter((id) => id !== item.id);
          const still = this.inbox.find(({ id }) => id === item.id);
          if (still && this.practice.auto) this.answerAtRandom(still);
        }, delay);
      });
    },
    allAtRandom() {
      [...this.inbox].forEach((item) => this.answerAtRandom(item));
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
