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

    <!-- the message so far, line by line, like the official app -->
    <section class="message">
      <h4>{{ $t("cards.message") }}</h4>
      <ol class="lines">
        <li
          v-for="(item, index) in lines"
          :key="index"
          :class="{ current: index === current }"
          :style="{ '--card-color': lookOf(item.phrase).color }"
          @click="current = index"
        >
          <font-awesome-icon :icon="lookOf(item.phrase).icon" />
          <span class="line-text">{{ lineText(item) }}</span>
          <font-awesome-icon
            icon="times-circle"
            class="remove"
            :title="$t('cards.removeLine')"
            @click.stop="removeLine(index)"
          />
        </li>
      </ol>
      <p class="hint">{{ $t("cards.buildHint") }}</p>
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
            :class="{ selected: line.phrase === key }"
            @click="line.phrase = key"
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
          :class="[role.team, { selected: line.roles.includes(role.id) }]"
          @click="toggle(line.roles, role.id)"
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
          :class="{ selected: line.players.includes(player.name) }"
          @click="toggle(line.players, player.name)"
        >
          {{ player.name }}
        </li>
      </ul>
    </section>

    <section class="row">
      <div>
        <h4>{{ $t("cards.number") }}</h4>
        <ul class="chips numbers">
          <li
            :class="{ selected: line.number === null }"
            @click="line.number = null"
          >
            {{ $t("cards.none") }}
          </li>
          <li
            v-for="n in 10"
            :key="n"
            :class="{ selected: line.number === n - 1 }"
            @click="line.number = n - 1"
          >
            {{ n - 1 }}
          </li>
        </ul>
      </div>
      <div>
        <h4>{{ $t("cards.answer") }}</h4>
        <ul class="chips">
          <li
            :class="{ selected: line.answer === null }"
            @click="line.answer = null"
          >
            {{ $t("cards.none") }}
          </li>
          <li
            :class="{ selected: line.answer === 'yes' }"
            @click="line.answer = 'yes'"
          >
            {{ $t("cards.yes") }}
          </li>
          <li
            :class="{ selected: line.answer === 'no' }"
            @click="line.answer = 'no'"
          >
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
import {
  CHOICES,
  MAX_PARTS,
  PHRASES,
  buildCard,
  emptyPart,
  isEmptyPart,
  lookOf,
  partsOf,
  tokenOf,
} from "../../cards";
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
    // the line being written: tokens, characters, players… go into it
    line: function () {
      return this.lines[this.current] || this.lines[0];
    },
    token: function () {
      return tokenOf(this.line.phrase);
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
        (!this.text.trim() && this.lines.every(isEmptyPart))
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
    /**
     * A token starts a new line, like the official app; on an empty line it
     * goes into that one. Only one line can be a choice: tapping "Make a
     * choice" again goes back to it. Tapping the token of a line with
     * nothing else in it takes it away.
     */
    pickPhrase(key) {
      const phrase = key === "makeChoice" ? DEFAULT_CHOICE : key;
      const line = this.line;
      const hasContent = !isEmptyPart({ ...line, phrase: null });
      if (this.token === key && !hasContent) {
        line.phrase = null;
        return;
      }
      if (key === "makeChoice") {
        const choice = this.lines.findIndex((item) =>
          CHOICES.includes(item.phrase),
        );
        if (choice !== -1) {
          this.current = choice;
          return;
        }
      }
      if (!line.phrase && !hasContent) {
        line.phrase = phrase;
      } else if (this.lines.length < MAX_PARTS) {
        this.lines.push(emptyPart(phrase));
        this.current = this.lines.length - 1;
      }
    },
    removeLine(index) {
      if (this.lines.length === 1) {
        this.lines.splice(0, 1, emptyPart());
      } else {
        this.lines.splice(index, 1);
      }
      this.current = Math.min(this.current, this.lines.length - 1);
    },
    // one line of the message, written out
    lineText(line) {
      if (isEmptyPart(line)) return this.$t("cards.emptyLine");
      return this.partText(line);
    },
    partText(part) {
      const items = [];
      if (part.phrase) {
        items.push(this.$t(`cards.phrases.${tokenOf(part.phrase)}`));
        if (tokenOf(part.phrase) !== part.phrase)
          items.push(this.$t(`cards.choices.${part.phrase}`));
      }
      part.roles.forEach((id) => {
        const role = this.roleMap.get(id) || this.rolesJSONbyId.get(id);
        items.push(role ? this.localizeRole(role).name : id);
      });
      items.push(...part.players);
      if (part.number !== null) items.push(String(part.number));
      if (part.answer) items.push(this.$t(`cards.${part.answer}`));
      return items.join(" · ");
    },
    // one line for the history: the token and what the card shows
    summary(card) {
      const lines = partsOf(card).map((part) => this.partText(part));
      if (card.text) lines.push(`«${card.text}»`);
      return lines.join(" / ");
    },
    emptyCard() {
      // also called from data(), before the computed properties exist
      const { composingFor, composePreset } = this.$store.state.chat;
      // the guided night opens it for several players (maybe filled in)
      const card = (composePreset && composePreset.card) || {};
      const lines = partsOf(card).map((part) => ({
        ...part,
        roles: [...part.roles],
        players: [...part.players],
      }));
      return {
        recipients: composePreset
          ? [...composePreset.to]
          : composingFor
            ? [composingFor]
            : [],
        lines: lines.length ? lines : [emptyPart()],
        current: 0,
        text: card.text || "",
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
      this.seatedPlayers
        .filter(({ id }) => this.recipients.includes(id))
        .forEach(({ id }) => {
          this.$store.dispatch("chat/sendCard", {
            to: id,
            card: buildCard(this.lines, this.text),
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

// the message being built: one row per line, the current one highlighted
.message {
  .lines {
    margin: 0;
    padding: 0;
    list-style: none;
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      padding: 4px 10px;
      border-radius: 8px;
      border: 2px solid var(--card-color);
      background: rgba(0, 0, 0, 0.5);
      cursor: pointer;
      font-size: 90%;
      &.current {
        border-color: white;
        box-shadow: 0 0 8px var(--card-color);
      }
      .line-text {
        flex: 1;
      }
      .remove {
        opacity: 0.6;
        &:hover {
          opacity: 1;
          color: red;
        }
      }
    }
  }
  .hint {
    margin: 2px 0 0;
    font-size: 75%;
    color: lightgray;
    text-align: left;
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
