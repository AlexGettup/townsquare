<template>
  <Modal class="night-summary" v-if="modals.nightSummary" @close="close">
    <div class="top">
      <span class="nav" :class="{ off: index <= 0 }" @click="go(-1)">
        <font-awesome-icon icon="chevron-left" />
      </span>
      <h3>
        <font-awesome-icon icon="moon" />
        {{ night ? $t("nightSummary.title", { night: night.night }) : "" }}
      </h3>
      <span
        class="nav"
        :class="{ off: index >= nights.length - 1 }"
        @click="go(1)"
      >
        <font-awesome-icon icon="chevron-right" />
      </span>
    </div>
    <p class="hint">{{ $t("nightSummary.hint") }}</p>

    <p class="empty" v-if="!night">{{ $t("nightSummary.noNights") }}</p>
    <ul class="players" v-else>
      <li
        v-for="row in rows"
        :key="row.id"
        :class="{ quiet: !row.items.length }"
      >
        <div class="who">
          {{ row.name }}
          <span class="role" v-if="row.role">· {{ row.role }}</span>
          <span class="nothing" v-if="!row.items.length">
            — {{ $t("nightSummary.nothing") }}
          </span>
        </div>
        <p
          v-for="(item, i) in row.items"
          :key="i"
          class="item"
          :class="item.kind"
        >
          <font-awesome-icon :icon="item.icon" />
          {{ item.text }}
        </p>
      </li>
    </ul>
  </Modal>
</template>

<script>
import { mapGetters, mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import { CHOICES, describePart, partsOf } from "../../cards";
import { STORYTELLER } from "../../store/modules/voice";

/**
 * Storyteller: what was sent and answered each night, player by player in
 * seat order (players who got nothing last, greyed). Built from the private
 * chats and the night log (store/modules/nightLog.js); the latest night
 * first, the arrows go to earlier ones.
 */
export default {
  components: { Modal },
  data() {
    return { index: 0 };
  },
  computed: {
    ...mapState(["modals", "chat", "roles"]),
    ...mapState("players", ["players"]),
    ...mapState("nightLog", ["nights"]),
    ...mapGetters(["localizeRole", "rolesJSONbyId"]),
    night() {
      return this.nights[this.index] || null;
    },
    rows() {
      if (!this.night) return [];
      const { start, end, grimoire } = this.night;
      const until = end === null ? Infinity : end;
      const rows = this.players
        .filter(({ id }) => id)
        .map((player) => {
          const channel = "dm:" + player.id;
          const items = [];
          this.chat.messages.forEach((message) => {
            if (message.channel !== channel) return;
            if (message.at < start || message.at > until) return;
            items.push(...this.itemsOf(message, player));
          });
          if (grimoire[player.id]) {
            items.push({
              kind: "sent",
              icon: "book-open",
              text:
                this.$t("nightSummary.grimoire") +
                " · " +
                (grimoire[player.id] === "seen"
                  ? this.$t("nightSummary.closed")
                  : this.$t("nightSummary.notClosed")),
            });
          }
          return {
            id: player.id,
            name: player.name,
            role:
              player.role && player.role.id
                ? this.localizeRole(player.role).name
                : "",
            items,
          };
        });
      // who got nothing tonight goes last
      return [
        ...rows.filter(({ items }) => items.length),
        ...rows.filter(({ items }) => !items.length),
      ];
    },
  },
  watch: {
    // opens on the latest night
    "modals.nightSummary"(isOpen) {
      if (isOpen) this.index = Math.max(0, this.nights.length - 1);
    },
  },
  methods: {
    roleName(id) {
      const role =
        this.roles.get(id) ||
        this.rolesJSONbyId.get(id) ||
        this.$store.state.otherTravellers.get(id);
      return role ? this.localizeRole(role).name : id;
    },
    itemsOf(message, player) {
      const fromStoryteller = message.from === STORYTELLER;
      if (!message.card) {
        return [
          {
            kind: fromStoryteller ? "sent" : "answer",
            icon: fromStoryteller ? "comment-dots" : "reply",
            text: `«${message.text}»`,
          },
        ];
      }
      const card = message.card;
      const lines = partsOf(card).map((part) =>
        describePart(part, this.$t.bind(this), this.roleName),
      );
      if (card.text) lines.push(`«${card.text}»`);
      const items = [
        {
          kind: "sent",
          icon: "paper-plane",
          text:
            lines.join(" / ") +
            (message.seen && !message.choice
              ? " · " + this.$t("nightSummary.seen")
              : ""),
        },
      ];
      const isChoice = partsOf(card).some(({ phrase }) =>
        CHOICES.includes(phrase),
      );
      if (message.choice) {
        items.push({
          kind: "answer",
          icon: "check",
          text: this.$t("cards.chosen", {
            players: message.choice.join(", "),
          }),
        });
      } else if (isChoice && card.phrase !== "chooseCharacter") {
        items.push({
          kind: "waiting",
          icon: "clock",
          text: this.$t("nightSummary.noAnswer"),
        });
      } else if (!message.seen) {
        items.push({
          kind: "waiting",
          icon: "clock",
          text: this.$t("nightSummary.notSeen", { name: player.name }),
        });
      }
      return items;
    },
    go(step) {
      const index = this.index + step;
      if (index >= 0 && index < this.nights.length) this.index = index;
    },
    close() {
      if (this.modals.nightSummary) this.toggleModal("nightSummary");
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.night-summary :deep(.modal) {
  width: 520px;
  max-width: 100%;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  h3 {
    margin: 0;
    svg {
      margin-right: 6px;
    }
  }
  .nav {
    cursor: pointer;
    padding: 4px 10px;
    &.off {
      opacity: 0.25;
      cursor: default;
    }
  }
}

.hint {
  margin: 4px 0 10px;
  font-size: 90%;
  opacity: 0.75;
  text-align: center;
}

.empty {
  text-align: center;
  opacity: 0.8;
}

.players {
  display: block;
  list-style: none;
  margin: 0;
  padding: 0;
  text-align: left;
  li {
    display: block;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding: 6px 0;
    &.quiet {
      opacity: 0.45;
    }
  }
  .who {
    font-weight: bold;
    .role,
    .nothing {
      font-weight: normal;
      opacity: 0.8;
    }
  }
  .item {
    margin: 2px 0 0 4px;
    font-size: 92%;
    svg {
      width: 14px;
      margin-right: 6px;
    }
    &.answer {
      color: #8fd18f;
    }
    &.waiting {
      color: #ffb347;
    }
  }
}
</style>
