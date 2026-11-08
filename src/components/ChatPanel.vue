<template>
  <div
    class="chat"
    v-if="voice.isAvailable && session.sessionId"
    :class="{ closed: !chat.isOpen }"
  >
    <h3 @click="!chat.isOpen && setOpen(true)">
      <font-awesome-icon icon="comment-dots" class="title-icon" />
      <span>{{ $t("chat.title") }}</span>
      <em class="badge" v-if="!chat.isOpen && totalUnread">{{
        totalUnread
      }}</em>
      <template v-if="chat.isOpen">
        <font-awesome-icon
          v-if="isStoryteller"
          icon="trash-alt"
          :title="$t('chat.clear')"
          @click.stop="clear"
        />
        <font-awesome-icon icon="times-circle" @click.stop="setOpen(false)" />
      </template>
      <font-awesome-icon v-else icon="plus-circle" />
    </h3>

    <template v-if="chat.isOpen">
      <ul class="tabs">
        <li
          v-for="tab in tabs"
          :key="tab.id"
          :class="{ active: tab.id === chat.tab }"
          :style="{ borderColor: tab.color }"
          :title="tab.label"
          @click="setTab(tab.id)"
        >
          <span>{{ tab.label }}</span>
          <em class="badge" v-if="chat.unread[tab.id]">{{
            chat.unread[tab.id]
          }}</em>
        </li>
      </ul>

      <div class="messages" ref="messages">
        <p v-if="!messages.length" class="empty">{{ $t("chat.empty") }}</p>
        <p
          v-for="message in messages"
          :key="message.id"
          :class="{ mine: message.from === selfPeerId }"
        >
          <small class="time">{{ time(message.at) }}</small>
          <b>{{ peerName(message.from) }}:</b>
          <a
            v-if="message.card"
            class="card-link"
            @click="$store.commit('chat/showCard', message)"
          >
            <font-awesome-icon icon="address-card" />
            {{ cardSummary(message.card) }}
          </a>
          <span v-if="message.card" class="card-details">{{
            cardDetails(message.card)
          }}</span>
          {{ message.text }}
        </p>
      </div>

      <p class="notice" v-if="isLocked || chat.error === 'night'">
        {{ $t("chat.nightLocked") }}
      </p>
      <p class="notice" v-else-if="!isConnected">
        {{ $t("chat.connecting") }}
      </p>
      <form v-if="!isLocked" class="input" @submit.prevent="send">
        <input
          v-model="text"
          maxlength="500"
          :placeholder="$t('chat.placeholder')"
          @keyup.stop
          @keydown.stop
        />
        <button type="submit" :title="$t('chat.send')">
          <font-awesome-icon icon="paper-plane" />
        </button>
      </form>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import peerNames from "../voice/peerNames";
import { PLACE_TAB } from "../store/modules/chat";
import { STORYTELLER } from "../store/modules/voice";

/**
 * Text chat panel (bottom right): what is said around us, and the private
 * channel(s) with the storyteller.
 */
export default {
  mixins: [peerNames],
  data() {
    return {
      text: "",
    };
  },
  computed: {
    tabs: function () {
      const here = this.voice.location;
      return [
        {
          id: PLACE_TAB,
          label: this.placeName(here) || this.$t("voice.places.plaza"),
          color: this.placeColor(here),
        },
        ...this.privateTabs.map((id) => {
          const peerId = id.slice("dm:".length);
          return {
            id,
            label: this.isStoryteller
              ? this.peerName(peerId)
              : this.$t("voice.storyteller"),
            color: null,
          };
        }),
      ];
    },
    messages: function () {
      return this.messagesOf(this.chat.tab);
    },
    isStoryteller: function () {
      return this.selfPeerId === STORYTELLER;
    },
    // at night players can only write to the storyteller
    isLocked: function () {
      return (
        !this.isStoryteller &&
        this.grimoire.isNight &&
        this.chat.tab === PLACE_TAB
      );
    },
    ...mapState(["chat", "voice", "session", "grimoire"]),
    ...mapGetters("chat", [
      "isConnected",
      "messagesOf",
      "privateTabs",
      "totalUnread",
    ]),
  },
  watch: {
    messages() {
      this.scrollToBottom();
    },
    "chat.isOpen"() {
      this.scrollToBottom();
    },
  },
  methods: {
    setOpen(isOpen) {
      this.$store.commit("chat/setOpen", isOpen);
    },
    setTab(tab) {
      this.$store.commit("chat/setTab", tab);
    },
    send() {
      this.$store.dispatch("chat/send", this.text);
      this.text = "";
    },
    clear() {
      if (confirm(this.$t("chat.clearConfirm"))) {
        this.$store.dispatch("chat/clear");
      }
    },
    cardSummary(card) {
      if (card.phrase) return this.$t(`cards.phrases.${card.phrase}`);
      return this.$t("cards.card");
    },
    // what the card says, written out: text, characters, players, number…
    cardDetails(card) {
      const roleName = (id) => {
        const role =
          this.$store.state.roles.get(id) ||
          this.$store.getters.rolesJSONbyId.get(id) ||
          this.$store.state.otherTravellers.get(id);
        return role ? this.$store.getters.localizeRole(role).name : id;
      };
      const parts = [];
      if (card.text) parts.push(card.text);
      if (card.roles && card.roles.length) {
        parts.push(card.roles.map(roleName).join(", "));
      }
      if (card.players && card.players.length) {
        parts.push(card.players.join(", "));
      }
      if (card.number !== null && card.number !== undefined) {
        parts.push(String(card.number));
      }
      if (card.answer) parts.push(this.$t(`cards.${card.answer}`));
      return parts.length ? "— " + parts.join(" · ") : "";
    },
    time(at) {
      return new Date(at).toLocaleTimeString(this.grimoire.locale, {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const list = this.$refs.messages;
        if (list) list.scrollTop = list.scrollHeight;
      });
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

// same look as the conversations / demon bluffs panels
.chat {
  position: absolute;
  right: 10px;
  bottom: 30px;
  width: 340px;
  max-width: calc(100vw - 20px);
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 10px;
  border: 3px solid black;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
  z-index: 60;

  &.closed {
    width: auto;
    h3 {
      cursor: pointer;
    }
  }

  h3 {
    margin: 5px 1vh;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 110%;
    span {
      flex-grow: 1;
      text-align: left;
    }
    svg:not(.title-icon) {
      cursor: pointer;
      &:hover {
        color: red;
      }
    }
  }
}

.badge {
  font-style: normal;
  font-family: "Roboto Condensed", sans-serif;
  font-size: 70%;
  line-height: 1.6;
  min-width: 1.6em;
  padding: 0 4px;
  text-align: center;
  border-radius: 1em;
  background: $demon;
  color: white;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 6px 4px;
  font-size: 80%;
  li {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 150px;
    padding: 1px 8px;
    border-radius: 10px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
    cursor: pointer;
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    &:hover {
      color: red;
    }
    &.active {
      background: rgba(255, 255, 255, 0.2);
      border-color: white;
    }
  }
}

.messages {
  height: 35vh;
  overflow-y: auto;
  margin: 0 6px;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.5);
  font-size: 85%;
  user-select: text;
  * {
    user-select: text;
  }
  p {
    margin: 0 0 3px;
    overflow-wrap: anywhere;
    &.mine b {
      color: $townsfolk;
    }
    &.empty {
      color: gray;
      text-align: center;
      margin-top: 1em;
    }
  }
  .time {
    color: gray;
    margin-right: 4px;
  }
  .card-link {
    cursor: pointer;
    color: $outsider;
    &:hover {
      color: red;
    }
  }
  .card-details {
    user-select: text;
  }
}

// phones: a compact panel showing the last few lines, so it doesn't cover
// the town square; it grows while typing
@media screen and (max-width: 767.98px), screen and (max-height: 500px) {
  .chat {
    width: 220px;
    bottom: 20px;
    background: rgba(0, 0, 0, 0.45);
    h3 {
      margin: 2px 6px;
      font-size: 90%;
    }
  }
  .messages {
    height: 5.2em;
    font-size: 75%;
    margin: 0 4px;
    padding: 2px 4px;
    background: rgba(0, 0, 0, 0.3);
    transition: height 200ms;
  }
  .chat:focus-within .messages {
    height: 30vh;
  }
  .tabs {
    font-size: 65%;
    padding: 0 4px 2px;
  }
  .input {
    margin: 3px 4px 4px;
    input {
      font-size: 75%;
      padding: 1px 6px;
    }
    button {
      padding: 0 8px;
    }
  }
}

.notice {
  margin: 4px 8px 0;
  font-size: 80%;
  color: lightgray;
}

.input {
  display: flex;
  gap: 6px;
  margin: 6px;
  input {
    flex-grow: 1;
    min-width: 0;
    padding: 4px 8px;
    border-radius: 6px;
    border: 2px solid black;
    background: rgba(255, 255, 255, 0.9);
    font: inherit;
    font-size: 85%;
    user-select: text;
  }
  button {
    border: 0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    cursor: pointer;
    padding: 0 10px;
    &:hover {
      color: red;
    }
  }
}
</style>
