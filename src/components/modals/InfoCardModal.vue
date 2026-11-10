<template>
  <Modal
    class="info-card-modal"
    v-if="shownMessage && !isAnswering"
    @close="close"
  >
    <InfoCard :card="shownMessage.card" />
    <p class="chosen" v-if="shownMessage.choice">
      {{ $t("cards.chosen", { players: shownMessage.choice.join(", ") }) }}
    </p>

    <!-- quick answers, like the official app: one tap, no typing -->
    <template v-if="canReply">
      <ul class="replies" v-if="!mode">
        <li @click="close">
          <font-awesome-icon icon="thumbs-up" />
          <span>{{ $t("cards.gotIt") }}</span>
        </li>
        <li @click="reply($t('cards.yes'))">
          <font-awesome-icon icon="check-circle" />
          <span>{{ $t("cards.yes") }}</span>
        </li>
        <li @click="reply($t('cards.no'))">
          <font-awesome-icon icon="times-circle" />
          <span>{{ $t("cards.no") }}</span>
        </li>
        <li @click="mode = 'player'">
          <font-awesome-icon icon="user" />
          <span>{{ $t("cards.replyPlayer") }}</span>
        </li>
        <li @click="mode = 'character'">
          <font-awesome-icon icon="theater-masks" />
          <span>{{ $t("cards.replyCharacter") }}</span>
        </li>
        <li @click="mode = 'custom'">
          <font-awesome-icon icon="comment-dots" />
          <span>{{ $t("cards.replyCustom") }}</span>
        </li>
      </ul>

      <!-- one or more players -->
      <div class="pick" v-else-if="mode === 'player'">
        <ul class="chips">
          <li
            v-for="name in playerNames"
            :key="name"
            :class="{ selected: picked.includes(name) }"
            @click="toggle(name)"
          >
            {{ name }}
          </li>
        </ul>
      </div>

      <!-- one or more characters of the script -->
      <div class="pick" v-else-if="mode === 'character'">
        <ul class="tokens">
          <li
            v-for="role in scriptRoles"
            :key="role.id"
            :class="[role.team, { selected: picked.includes(role.id) }]"
            @click="toggle(role.id)"
          >
            <Token :role="role" />
          </li>
        </ul>
      </div>

      <!-- anything else, written -->
      <div class="pick" v-else-if="mode === 'custom'">
        <input
          ref="custom"
          class="custom"
          v-model="custom"
          maxlength="300"
          :placeholder="$t('cards.replyPlaceholder')"
          @keyup.stop
          @keydown.stop
          @keyup.enter="sendPicked"
        />
      </div>

      <div class="button-group" v-if="mode">
        <div class="button" @click="back">
          {{ $t("cards.replyBack") }}
        </div>
        <div
          class="button townsfolk"
          :class="{ disabled: !pickedText }"
          @click="sendPicked"
        >
          <font-awesome-icon icon="paper-plane" />
          {{ $t("cards.replySend") }}
        </div>
      </div>
    </template>

    <div class="button-group" v-else>
      <div class="button townsfolk" @click="close">
        {{ $t("cards.gotIt") }}
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import Modal from "./Modal";
import InfoCard from "../InfoCard";
import Token from "../Token";
import { isRoleCard } from "../../store/modules/chat";
import { STORYTELLER } from "../../store/modules/voice";

/**
 * Shows an info card received from the storyteller (or reopened). A player
 * answers it with one tap, like the official app: got it, yes, no, players,
 * characters or a few words. The answer goes to the storyteller's private
 * chat, and the card counts as answered.
 */
export default {
  components: { Modal, InfoCard, Token },
  data() {
    return {
      // what is being picked for the answer: null | player | character | custom
      mode: null,
      picked: [],
      custom: "",
    };
  },
  computed: {
    ...mapGetters("chat", ["isAnswering", "shownMessage", "isConnected"]),
    ...mapState({ scriptRoles: (state) => [...state.roles.values()] }),
    ...mapState("players", ["players"]),
    // players answer the storyteller's cards; "You are" only needs a "got it"
    canReply: function () {
      return (
        this.$store.state.session.isSpectator &&
        this.shownMessage.from === STORYTELLER &&
        !isRoleCard(this.shownMessage)
      );
    },
    playerNames: function () {
      return this.players.map(({ name }) => name).filter(Boolean);
    },
    // the answer as it will be written in the chat
    pickedText: function () {
      if (this.mode === "custom") return this.custom.trim();
      if (this.mode === "player") return this.picked.join(", ");
      if (this.mode === "character") {
        return this.picked
          .map((id) => {
            const role = this.$store.state.roles.get(id);
            return role ? this.$store.getters.localizeRole(role).name : id;
          })
          .join(", ");
      }
      return "";
    },
  },
  watch: {
    // each card starts with the buttons
    shownMessage(message, before) {
      if (!message || !before || message.id !== before.id) this.back();
    },
    mode(mode) {
      if (mode === "custom") {
        this.$nextTick(() => this.$refs.custom && this.$refs.custom.focus());
      }
    },
  },
  methods: {
    toggle(value) {
      const index = this.picked.indexOf(value);
      if (index === -1) this.picked.push(value);
      else this.picked.splice(index, 1);
    },
    back() {
      this.mode = null;
      this.picked = [];
      this.custom = "";
    },
    sendPicked() {
      if (this.pickedText) this.reply(this.pickedText);
    },
    reply(text) {
      this.$store.dispatch("chat/replyToCard", text);
      this.back();
    },
    close() {
      this.back();
      this.$store.dispatch("chat/closeCard");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.info-card-modal :deep(.modal) {
  overflow-y: auto;
  overflow-x: hidden;
  // room for the maximize and close buttons in the top right corner
  padding: 45px 30px 20px;
  // phones: the card uses the whole width of the window, no sideways scroll
  @media (max-width: 767.98px) {
    padding: 40px 12px 15px;
  }
}
.button-group {
  margin-top: 15px;
}
.chosen {
  margin: 12px 0 0;
  text-align: center;
  font-weight: bold;
}

// a row of round buttons, like the official app
.replies {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 72px;
    // phones: two rows of three
    @media (max-width: 767.98px) {
      width: calc((100% - 16px) / 3);
    }
    cursor: pointer;
    font-size: 85%;
    svg {
      font-size: 34px;
      transition: transform 150ms;
    }
    &:hover {
      color: $townsfolk;
      svg {
        transform: scale(1.1);
      }
    }
  }
}

.pick {
  margin-top: 15px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  li {
    padding: 4px 12px;
    border-radius: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
    cursor: pointer;
    &.selected {
      border-color: white;
      background: rgba(255, 255, 255, 0.25);
    }
  }
}

.tokens {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 4px;
  list-style: none;
  li {
    width: 56px;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0.6;
    transition: all 150ms;
    &.selected {
      opacity: 1;
      transform: scale(1.1);
      box-shadow: 0 0 10px white;
    }
  }
}

input.custom {
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: 2px solid black;
  font: inherit;
  user-select: text;
}
</style>
