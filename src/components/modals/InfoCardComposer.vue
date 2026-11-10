<template>
  <Modal class="info-card-composer" v-if="playerId" @close="close">
    <h3>{{ $t("cards.title", { name: recipientNames }) }}</h3>

    <!-- what their character does tonight, as in the night order -->
    <p class="night-reminder" v-if="nightReminder">
      <font-awesome-icon icon="moon" />
      <span v-html="nightReminder"></span>
    </p>

    <!-- what they were sent and answered since nightfall (or dawn) -->
    <ul class="history" v-if="history.length">
      <li
        v-for="item in history"
        :key="item.key"
        :class="item.sent ? 'sent' : 'received'"
      >
        <font-awesome-icon :icon="item.sent ? 'paper-plane' : 'reply'" />
        <span>{{ item.text }}</span>
      </li>
    </ul>

    <section>
      <h4>{{ $t("cards.to") }}</h4>
      <ul class="chips">
        <li
          v-for="player in seatedPlayers"
          :key="player.id"
          :class="{ selected: recipients.includes(player.id) }"
          @click="toggle(recipients, player.id)"
        >
          {{ player.name }}
        </li>
      </ul>
    </section>

    <section>
      <h4>{{ $t("cards.phrase") }}</h4>
      <ul class="chips phrases">
        <li
          v-for="key in phrases"
          :key="key"
          :class="{ selected: token === key }"
          :style="{ '--card-color': lookOf(key).color }"
          @click="pickPhrase(key)"
        >
          <font-awesome-icon :icon="lookOf(key).icon" />
          {{ $t(`cards.phrases.${key}`) }}
        </li>
      </ul>
      <div class="choices" v-if="token === 'makeChoice'">
        <h4>{{ $t("cards.askToChoose") }}</h4>
        <ul class="chips">
          <li
            v-for="key in choices"
            :key="key"
            :class="{ selected: phrase === key }"
            @click="phrase = key"
          >
            {{ $t(`cards.choices.${key}`) }}
          </li>
        </ul>
      </div>
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
import { mapGetters, mapState } from "vuex";
import Modal from "./Modal";
import Token from "../Token";
import { CHOICES, PHRASES, lookOf, tokenOf } from "../../cards";
import { STORYTELLER } from "../../store/modules/voice";

// "Make a choice" says what to choose: an hour of the night is short
const DEFAULT_CHOICE = "choosePlayer";
// lines of history shown, the latest
const HISTORY_LINES = 8;

/**
 * Storyteller: write an info card for a player (phrase, characters,
 * players, number, yes/no) and send it through the private chat. On top,
 * what their character does tonight and what they were sent and answered,
 * like the official app's "Wake" window.
 */
export default {
  components: { Modal, Token },
  data() {
    return {
      phrases: PHRASES,
      choices: CHOICES,
      ...this.emptyCard(),
    };
  },
  computed: {
    playerId: function () {
      return this.chat.composingFor;
    },
    // who can get a card: seated players
    seatedPlayers: function () {
      return this.players.filter(({ id }) => id);
    },
    // in seat order, whatever the order they were picked in
    recipientNames: function () {
      return this.seatedPlayers
        .filter(({ id }) => this.recipients.includes(id))
        .map(({ name }) => name)
        .join(", ");
    },
    scriptRoles: function () {
      return [...this.roleMap.values()];
    },
    token: function () {
      return tokenOf(this.phrase);
    },
    player: function () {
      return this.players.find(({ id }) => id === this.playerId) || null;
    },
    nightReminder: function () {
      if (!this.grimoire.isNight || !this.player) return null;
      const { role } = this.player;
      if (!role || !role.id) return null;
      const localized = this.localizeRole(role);
      const text =
        this.grimoire.nightCount <= 1
          ? localized.firstNightReminder
          : localized.otherNightReminder;
      if (!text) return null;
      return text
        .replace(/</g, "&lt;")
        .replace(/\*(.*?)\*/g, "<b>$1</b>")
        .replace(/:reminder:/g, "")
        .trim();
    },
    history: function () {
      if (!this.playerId) return [];
      const channel = "dm:" + this.playerId;
      const items = [];
      this.chat.messages.forEach((message) => {
        if (message.channel !== channel || message.at < this.chat.cardsSince)
          return;
        const sent = message.from === STORYTELLER;
        const key = message.id;
        if (!message.card) {
          items.push({ key, sent, text: message.text });
          return;
        }
        items.push({ key, sent, text: this.summary(message.card) });
        if (message.choice) {
          items.push({
            key: key + "-choice",
            sent: false,
            text: this.$t("cards.chosen", {
              players: message.choice.join(", "),
            }),
          });
        } else if (message.seen) {
          items.push({
            key: key + "-seen",
            sent: false,
            text: this.$t("cards.gotIt"),
          });
        }
      });
      return items.slice(-HISTORY_LINES);
    },
    isEmpty: function () {
      return (
        !this.recipients.length ||
        (!this.phrase &&
          !this.text.trim() &&
          !this.roles.length &&
          !this.chosenPlayers.length &&
          this.number === null &&
          !this.answer)
      );
    },
    ...mapState(["chat", "grimoire"]),
    ...mapGetters(["localizeRole", "rolesJSONbyId"]),
    ...mapState({ roleMap: "roles" }),
    ...mapState("players", ["players"]),
  },
  watch: {
    // a fresh card every time it opens, for the player it was opened on
    playerId() {
      Object.assign(this, this.emptyCard());
    },
    "chat.composePreset"() {
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
    lookOf,
    pickPhrase(key) {
      if (key !== "makeChoice") {
        this.phrase = this.phrase === key ? null : key;
      } else {
        this.phrase = this.token === key ? null : DEFAULT_CHOICE;
      }
    },
    // one line for the history: the token and what the card shows
    summary(card) {
      const parts = [];
      if (card.phrase) {
        parts.push(this.$t(`cards.phrases.${tokenOf(card.phrase)}`));
        if (tokenOf(card.phrase) !== card.phrase)
          parts.push(this.$t(`cards.choices.${card.phrase}`));
      }
      (card.roles || []).forEach((id) => {
        const role = this.roleMap.get(id) || this.rolesJSONbyId.get(id);
        parts.push(role ? this.localizeRole(role).name : id);
      });
      parts.push(...(card.players || []));
      if (card.number !== null && card.number !== undefined)
        parts.push(String(card.number));
      if (card.answer) parts.push(this.$t(`cards.${card.answer}`));
      if (card.text) parts.push(`«${card.text}»`);
      return parts.join(" · ");
    },
    emptyCard() {
      // also called from data(), before the computed properties exist
      const { composingFor, composePreset } = this.$store.state.chat;
      // the guided night opens it filled in, maybe for several players
      const card = (composePreset && composePreset.card) || {};
      return {
        recipients: composePreset
          ? [...composePreset.to]
          : composingFor
            ? [composingFor]
            : [],
        phrase: card.phrase || null,
        text: card.text || "",
        roles: [...(card.roles || [])],
        chosenPlayers: [...(card.players || [])],
        number: card.number === undefined ? null : card.number,
        answer: card.answer || null,
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
      // the same card to each one, in their own private chat
      const card = {
        phrase: this.phrase,
        text: this.text.trim(),
        roles: this.roles,
        players: this.chosenPlayers,
        number: this.number,
        answer: this.answer,
      };
      this.seatedPlayers
        .filter(({ id }) => this.recipients.includes(id))
        .forEach(({ id }) => {
          this.$store.dispatch("chat/sendCard", {
            to: id,
            card: {
              ...card,
              roles: [...card.roles],
              players: [...card.players],
            },
          });
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

// each token in its colour, like the card the player gets
.chips.phrases li {
  border-color: var(--card-color);
  svg {
    margin-right: 3px;
  }
  &.selected {
    border-color: white;
    background: var(--card-color);
  }
}

.choices {
  margin-top: 6px;
  h4 {
    font-size: 85%;
  }
}

.night-reminder {
  margin: 0 0 8px;
  padding: 6px 10px;
  border-left: 3px solid $fabled;
  background: rgba(0, 0, 0, 0.35);
  font-size: 90%;
  svg {
    margin-right: 6px;
    color: $fabled;
  }
}

.history {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
  font-size: 85%;
  li {
    display: flex;
    gap: 6px;
    align-items: baseline;
    padding: 1px 0;
    &.sent svg {
      color: orange;
    }
    &.received svg {
      color: violet;
    }
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
