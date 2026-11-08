<template>
  <Modal class="info-card-composer" v-if="playerId" @close="close">
    <h3>{{ $t("cards.title", { name: playerName }) }}</h3>

    <section>
      <h4>{{ $t("cards.phrase") }}</h4>
      <ul class="chips">
        <li
          v-for="key in phrases"
          :key="key"
          :class="{ selected: phrase === key }"
          @click="phrase = phrase === key ? null : key"
        >
          {{ $t(`cards.phrases.${key}`) }}
        </li>
      </ul>
      <input
        class="text"
        v-model="text"
        maxlength="300"
        :placeholder="$t('cards.text')"
        @keyup.stop
        @keydown.stop="onKeydown"
      />
    </section>

    <section>
      <h4>{{ $t("cards.characters") }}</h4>
      <ul class="tokens">
        <li
          v-for="role in scriptRoles"
          :key="role.id"
          :class="[role.team, { selected: roles.includes(role.id) }]"
          @click="toggle(roles, role.id)"
        >
          <Token :role="role" />
        </li>
      </ul>
    </section>

    <section>
      <h4>{{ $t("cards.players") }}</h4>
      <ul class="chips">
        <li
          v-for="(player, index) in players"
          :key="index"
          :class="{ selected: chosenPlayers.includes(player.name) }"
          @click="toggle(chosenPlayers, player.name)"
        >
          {{ player.name }}
        </li>
      </ul>
    </section>

    <section class="row">
      <div>
        <h4>{{ $t("cards.number") }}</h4>
        <ul class="chips numbers">
          <li :class="{ selected: number === null }" @click="number = null">
            {{ $t("cards.none") }}
          </li>
          <li
            v-for="n in 10"
            :key="n"
            :class="{ selected: number === n - 1 }"
            @click="number = n - 1"
          >
            {{ n - 1 }}
          </li>
        </ul>
      </div>
      <div>
        <h4>{{ $t("cards.answer") }}</h4>
        <ul class="chips">
          <li :class="{ selected: answer === null }" @click="answer = null">
            {{ $t("cards.none") }}
          </li>
          <li :class="{ selected: answer === 'yes' }" @click="answer = 'yes'">
            {{ $t("cards.yes") }}
          </li>
          <li :class="{ selected: answer === 'no' }" @click="answer = 'no'">
            {{ $t("cards.no") }}
          </li>
        </ul>
      </div>
    </section>

    <div class="button-group">
      <div
        class="button townsfolk"
        :class="{ disabled: isEmpty }"
        @click="send"
      >
        <font-awesome-icon icon="paper-plane" />
        {{ $t("cards.sendButton") }}
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapState } from "vuex";
import Modal from "./Modal";
import Token from "../Token";

const PHRASES = [
  "youAre",
  "thisIsTheDemon",
  "theseAreYourMinions",
  "notInPlay",
  "thisPlayerIs",
  "characterSelectedYou",
  "youLearn",
  "useAbility",
  "choosePlayer",
  "chooseTwoPlayers",
  "chooseCharacter",
];

/**
 * Storyteller: write an info card for a player (phrase, characters,
 * players, number, yes/no) and send it through the private chat.
 */
export default {
  components: { Modal, Token },
  data() {
    return {
      phrases: PHRASES,
      ...this.emptyCard(),
    };
  },
  computed: {
    playerId: function () {
      return this.chat.composingFor;
    },
    playerName: function () {
      const player = this.players.find(({ id }) => id === this.playerId);
      return player ? player.name : "";
    },
    scriptRoles: function () {
      return [...this.roleMap.values()];
    },
    isEmpty: function () {
      return (
        !this.phrase &&
        !this.text.trim() &&
        !this.roles.length &&
        !this.chosenPlayers.length &&
        this.number === null &&
        !this.answer
      );
    },
    ...mapState(["chat"]),
    ...mapState({ roleMap: "roles" }),
    ...mapState("players", ["players"]),
  },
  watch: {
    // a fresh card every time it opens
    playerId() {
      Object.assign(this, this.emptyCard());
    },
  },
  mounted() {
    window.addEventListener("keydown", this.onKeydown);
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKeydown);
  },
  methods: {
    emptyCard() {
      return {
        phrase: null,
        text: "",
        roles: [],
        chosenPlayers: [],
        number: null,
        answer: null,
      };
    },
    // Enter sends the card, anywhere in the window
    onKeydown(event) {
      if (!this.playerId || event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      this.send();
    },
    toggle(list, value) {
      const index = list.indexOf(value);
      if (index === -1) list.push(value);
      else list.splice(index, 1);
    },
    send() {
      if (this.isEmpty) return;
      this.$store.dispatch("chat/sendCard", {
        to: this.playerId,
        card: {
          phrase: this.phrase,
          text: this.text.trim(),
          roles: this.roles,
          players: this.chosenPlayers,
          number: this.number,
          answer: this.answer,
        },
      });
      this.close();
    },
    close() {
      this.$store.commit("chat/composeCard", null);
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.info-card-composer :deep(.modal) {
  overflow-y: auto;
  overflow-x: hidden;
  width: 900px;
  // phones: fit the screen, no sideways scroll
  @media (max-width: 767.98px) {
    padding: 10px 12px;
    .tokens li {
      width: 48px;
    }
  }
}

h3 {
  margin-bottom: 5px;
}

section {
  margin-bottom: 10px;
  &.row {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  }
}

h4 {
  font-family: "Roboto Condensed", sans-serif;
  text-align: left;
  font-size: 80%;
  color: lightgray;
  margin-bottom: 4px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  li {
    padding: 2px 10px;
    border-radius: 12px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
    cursor: pointer;
    font-size: 85%;
    &:hover {
      color: red;
    }
    &.selected {
      border-color: white;
      background: rgba(255, 255, 255, 0.25);
    }
  }
  &.numbers li {
    min-width: 2em;
    text-align: center;
  }
}

input.text {
  width: 100%;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 2px solid black;
  font: inherit;
  font-size: 85%;
  user-select: text;
}

.tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  // room for the zoom of selected tokens, so they don't stick out
  padding: 4px;
  li {
    width: 60px;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0.5;
    transition: all 150ms;
    &.selected {
      opacity: 1;
      transform: scale(1.1);
      box-shadow: 0 0 10px white;
    }
  }
}

.button-group {
  margin-top: 5px;
}
</style>
