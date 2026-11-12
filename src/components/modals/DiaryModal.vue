<template>
  <Modal class="diary" v-if="modals.diary" @close="toggleModal('diary')">
    <h3>
      <font-awesome-icon icon="book" />
      {{ $t("diary.title") }}
    </h3>

    <p class="empty" v-if="!hasAnything">{{ $t("diary.empty") }}</p>

    <!-- newest first: what happens now is at the top -->
    <section
      v-for="section in sections"
      :key="section.key"
      :class="{ now: section.isCurrent, night: section.isNight }"
    >
      <h4>
        <font-awesome-icon :icon="section.isNight ? 'moon' : 'sun'" />
        {{ section.label }}
        <small v-if="section.isCurrent">{{ $t("diary.now") }}</small>
      </h4>

      <!-- the day so far: who is about to die, what a vote needs -->
      <p class="summary" v-if="section.summary">
        <font-awesome-icon icon="balance-scale" />
        {{ section.summary }}
      </p>

      <ul>
        <li
          v-for="item in section.items"
          :key="item.key"
          :class="[item.kind, { reached: item.reached, me: item.isMe }]"
          :style="item.color ? { '--card-color': item.color } : null"
        >
          <font-awesome-icon :icon="item.icon" class="icon" />
          <div class="body">
            <template v-if="item.kind === 'card'">
              <span v-for="(line, n) in item.lines" :key="n" class="line">
                {{ line }}
              </span>
              <span class="answer" v-if="item.answer">
                <font-awesome-icon icon="reply" />
                {{ item.answer }}
              </span>
            </template>
            <template v-else-if="item.kind === 'vote'">
              <span class="line">{{ item.text }}</span>
              <span class="voters" v-if="item.voters">{{ item.voters }}</span>
            </template>
            <span class="line" v-else>{{ item.text }}</span>
          </div>
          <time>{{ item.time }}</time>
        </li>
      </ul>
    </section>

    <div class="button-group">
      <div
        class="button"
        v-if="session.voteHistory.length"
        @click="toggleModal('voteHistory')"
      >
        <font-awesome-icon icon="book-dead" />
        {{ $t("diary.voteTable") }}
      </div>
      <div class="button townsfolk" @click="toggleModal('diary')">
        {{ $t("player.closeMenu") }}
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapGetters, mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import { describePart, lookOf, partsOf } from "../../cards";
import { STORYTELLER } from "../../store/modules/voice";
import { dmTab } from "../../store/modules/chat";

const timeOf = (at) => {
  const date = new Date(at);
  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
};

/**
 * Players: the diary of the game, night by night and day by day. What the
 * storyteller told you (info cards and private messages) and what you
 * answered, deaths, the grimoire shown to you, and each day's nominations
 * and votes, with who is about to be executed. Built from the private chat
 * and the diary this device keeps (store/modules/diary.js).
 */
export default {
  components: { Modal },
  computed: {
    ...mapState(["modals", "session", "grimoire", "diary"]),
    ...mapState("players", ["players"]),
    ...mapGetters(["localizeRole", "rolesJSONbyId"]),
    ...mapGetters("voice", ["selfPeerId"]),
    myName() {
      const me = this.players.find(({ id }) => id === this.session.playerId);
      return me ? me.name : "";
    },
    // the private chat with the storyteller, as diary items
    messageItems() {
      const channel = dmTab(this.selfPeerId);
      return this.$store.state.chat.messages
        .filter((message) => message.channel === channel)
        .map((message) => {
          const fromStoryteller = message.from === STORYTELLER;
          const base = { key: "m" + message.id, at: message.at };
          if (message.card) {
            const look = lookOf(message.card.phrase);
            const lines = partsOf(message.card).map((part) =>
              describePart(part, this.$t.bind(this), this.roleName),
            );
            if (message.card.text) lines.push(`«${message.card.text}»`);
            return {
              ...base,
              kind: "card",
              icon: look.icon,
              color: look.color,
              lines: lines.filter(Boolean),
              answer: message.choice
                ? this.$t("diary.chose", { players: message.choice.join(", ") })
                : "",
            };
          }
          return {
            ...base,
            kind: fromStoryteller ? "told" : "said",
            icon: fromStoryteller ? "comment-dots" : "reply",
            text: fromStoryteller
              ? this.$t("diary.told", { text: message.text })
              : this.$t("diary.said", { text: message.text }),
          };
        });
    },
    eventItems() {
      return this.diary.events.map((event, index) => {
        const base = { key: "e" + index, at: event.at, kind: event.kind };
        if (event.kind === "grimoire") {
          return {
            ...base,
            icon: "book-open",
            text: this.$t("diary.grimoire"),
          };
        }
        const isMe = event.name === this.myName;
        const key =
          event.kind === "death"
            ? isMe
              ? "diary.youDied"
              : "diary.died"
            : isMe
              ? "diary.youRevived"
              : "diary.revived";
        return {
          ...base,
          icon: event.kind === "death" ? "skull" : "heartbeat",
          isMe,
          text: this.$t(key, { name: event.name }),
        };
      });
    },
    voteItems() {
      return this.diary.votes.map((vote, index) => {
        const reached = vote.count >= vote.majority;
        const mine = this.myName && vote.votes.includes(this.myName);
        return {
          key: "v" + index,
          at: vote.at,
          kind: "vote",
          icon: vote.type === "Exile" ? "door-open" : "hand-point-right",
          vote,
          text: this.$t(
            vote.type === "Exile" ? "diary.exile" : "diary.nominated",
            {
              nominator: vote.nominator,
              nominee: vote.nominee,
              count: vote.count,
              majority: vote.majority,
            },
          ),
          reached,
          voters:
            (vote.votes.length
              ? this.$t("diary.voters", { names: vote.votes.join(", ") })
              : this.$t("diary.noVoters")) +
            (mine ? " " + this.$t("diary.youVoted") : ""),
        };
      });
    },
    hasAnything() {
      return (
        this.messageItems.length ||
        this.eventItems.length ||
        this.voteItems.length
      );
    },
    /**
     * Each night and day since this device joined, newest first, with what
     * happened in it. What came before the first one goes into "Before".
     */
    sections() {
      const items = [
        ...this.messageItems,
        ...this.eventItems,
        ...this.voteItems,
      ].sort((a, b) => a.at - b.at);
      const sections = this.diary.phases.map((phase, index) => ({
        key: "p" + index,
        from: phase.at,
        night: phase.night,
        isNight: phase.isNight,
        label: this.labelOf(phase),
        items: [],
      }));
      const earlier = {
        key: "earlier",
        from: -Infinity,
        isNight: false,
        label: this.$t("diary.earlier"),
        items: [],
      };
      items.forEach((item) => {
        let section = earlier;
        sections.forEach((candidate) => {
          if (candidate.from <= item.at) section = candidate;
        });
        section.items.push({ ...item, time: timeOf(item.at) });
      });
      const last = sections[sections.length - 1];
      if (last) last.isCurrent = true;
      return [earlier, ...sections]
        .filter((section) => section.items.length || section.isCurrent)
        .map((section) => ({
          ...section,
          summary: section.isNight ? "" : this.summaryOf(section),
        }))
        .reverse();
    },
  },
  methods: {
    roleName(id) {
      const role =
        this.$store.state.roles.get(id) || this.rolesJSONbyId.get(id);
      return role ? this.localizeRole(role).name : id;
    },
    labelOf({ night, isNight }) {
      if (isNight) return this.$t("diary.night", { count: night });
      if (!night) return this.$t("diary.setup");
      return this.$t("diary.day", { count: night });
    },
    /**
     * A day's executions: the top vote that reached the majority is about to
     * die, or a tie saves everyone. Today, also what a new vote needs.
     */
    summaryOf(section) {
      const reached = section.items
        .filter(
          ({ kind, reached, vote }) =>
            kind === "vote" && reached && vote.type === "Execution",
        )
        .map(({ vote }) => vote);
      if (!reached.length) return "";
      const count = Math.max(...reached.map((vote) => vote.count));
      const names = reached
        .filter((vote) => vote.count === count)
        .map(({ nominee }) => nominee);
      const tie = names.length > 1;
      if (!section.isCurrent) {
        return tie
          ? this.$t("diary.wasTie", { count, names: names.join(", ") })
          : this.$t("diary.wasOnTheBlock", { count, name: names[0] });
      }
      return tie
        ? this.$t("diary.tie", {
            count,
            names: names.join(", "),
            more: count + 1,
          })
        : this.$t("diary.onTheBlock", {
            count,
            name: names[0],
            more: count + 1,
          });
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.diary :deep(.modal) {
  width: 560px;
  max-width: 100%;
  overflow-y: auto;
  @media (max-width: 767.98px) {
    padding: 40px 12px 15px;
  }
}

h3 svg {
  margin-right: 6px;
}

.empty {
  text-align: center;
  opacity: 0.8;
}

section {
  text-align: left;
  margin: 0 0 14px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  &.now {
    border: 1px solid rgba(255, 255, 255, 0.35);
  }
  &.night {
    background: rgba(40, 60, 140, 0.18);
  }
}

h4 {
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  small {
    font-weight: normal;
    opacity: 0.7;
  }
}

.summary {
  margin: 0 0 8px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(206, 1, 0, 0.25);
  font-weight: bold;
  svg {
    margin-right: 4px;
  }
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  &:first-child {
    border-top: 0;
  }
  .icon {
    flex: 0 0 18px;
    margin-top: 3px;
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  time {
    font-size: 75%;
    opacity: 0.6;
    margin-top: 3px;
  }
  .answer,
  .voters {
    font-size: 85%;
    opacity: 0.8;
  }
  .answer svg {
    margin-right: 3px;
  }
  // info cards in the colour of their token, like the card itself
  &.card .icon {
    color: var(--card-color);
    filter: brightness(1.6);
  }
  &.death .icon {
    color: $demon;
  }
  &.said {
    opacity: 0.8;
  }
  &.me,
  &.reached .line {
    font-weight: bold;
  }
  &.vote.reached .icon {
    color: $demon;
    filter: brightness(1.4);
  }
}
</style>
