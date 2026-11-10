<template>
  <div
    class="guided-night"
    :class="{ collapsed: isCollapsed }"
    v-if="isShown"
    @click.stop
  >
    <!-- folded: one line, tap to unfold -->
    <div v-if="isCollapsed" class="pill" @click="isCollapsed = false">
      <font-awesome-icon icon="moon" />
      {{ $t("guidedNight.title") }} ·
      {{
        isDone
          ? $t("guidedNight.done", { night: grimoire.nightCount })
          : $t("guidedNight.stepOf", {
              step: index + 1,
              total: steps.length,
            })
      }}
      <font-awesome-icon icon="chevron-up" />
    </div>

    <template v-else>
      <div class="top">
        <span class="nav" :class="{ off: index === 0 }" @click="previous">
          <font-awesome-icon icon="chevron-left" />
        </span>
        <span class="where">
          {{ $t("guidedNight.night", { night: grimoire.nightCount }) }} ·
          {{
            isDone
              ? $t("guidedNight.allDone")
              : $t("guidedNight.stepOf", {
                  step: index + 1,
                  total: steps.length,
                })
          }}
        </span>
        <span class="nav" :class="{ off: isDone }" @click="skip">
          <font-awesome-icon icon="chevron-right" />
        </span>
        <span class="tool" :title="$t('guidedNight.fold')" @click="fold">
          <font-awesome-icon icon="chevron-down" />
        </span>
        <span class="tool" :title="$t('guidedNight.hide')" @click="hide">
          <font-awesome-icon icon="times-circle" />
        </span>
      </div>

      <!-- every step done: on to the day -->
      <template v-if="isDone">
        <h4>{{ $t("guidedNight.done", { night: grimoire.nightCount }) }}</h4>
        <div class="actions">
          <span class="button townsfolk" @click="toDay">
            <font-awesome-icon icon="sun" />
            {{ $t("guidedNight.toDay") }}
          </span>
          <span class="button" @click="goTo(0)">
            {{ $t("guidedNight.restart") }}
          </span>
        </div>
      </template>

      <template v-else>
        <h4>
          {{ roleName }} —
          <span
            v-for="(player, i) in step.players"
            :key="player.id"
            :class="{ dead: player.isDead }"
            >{{ player.name
            }}{{ i < step.players.length - 1 ? ", " : "" }}</span
          >
        </h4>
        <p class="reminder" v-if="reminder" v-html="reminder"></p>

        <div class="actions">
          <span
            v-if="canWake"
            class="button"
            :class="{ on: isAwake }"
            @click="wake"
          >
            <font-awesome-icon icon="eye" />
            {{ isAwake ? $t("guidedNight.awake") : $t("guidedNight.wake") }}
          </span>
          <span class="button" @click="compose">
            <font-awesome-icon icon="comment-dots" />
            {{ $t("guidedNight.sendCard") }}
          </span>
        </div>

        <!-- what came back since this step started -->
        <ul class="answers" v-if="answers.length">
          <li v-for="answer in answers" :key="answer.key">
            <font-awesome-icon :icon="answer.icon" />
            {{ answer.text }}
          </li>
        </ul>

        <div class="actions">
          <span class="button townsfolk" @click="next">
            {{ canWake ? $t("guidedNight.sleepNext") : $t("guidedNight.next") }}
            <font-awesome-icon icon="chevron-right" />
          </span>
          <span class="button" @click="skip">{{ $t("guidedNight.skip") }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { nightSteps } from "../guidedNight";
import { STORYTELLER } from "../store/modules/voice";

// where we are, so a reload doesn't start the night again
const STORAGE_KEY = "guidedNight";

/**
 * Storyteller: step through tonight's night order. Each step names the
 * character and its player, lights up their seat, wakes them, opens the info
 * card window for them (empty: what to send is up to the storyteller), shows
 * what they answered, and puts them back to sleep. Nothing happens without a
 * tap: reminders, deaths and odd characters (Lunatic…) stay by hand.
 */
export default {
  data() {
    return {
      index: 0,
      // when the current step began: answers after it belong to it
      since: Date.now(),
      isCollapsed: false,
      hiddenNight: null,
    };
  },
  computed: {
    ...mapState([
      "grimoire",
      "session",
      "edition",
      "roles",
      "otherTravellers",
      "npcs",
      "chat",
    ]),
    ...mapState("players", ["players"]),
    ...mapState("practice", { isPractice: "active" }),
    ...mapGetters(["getFirstNightOrder", "getOtherNightOrder", "localizeRole"]),
    ...mapGetters("voice", ["isConnected"]),
    isShown() {
      return (
        !this.session.isSpectator &&
        this.grimoire.isNight &&
        this.grimoire.isGuidedNight &&
        !this.session.gameOver &&
        this.hiddenNight !== this.grimoire.nightCount &&
        this.steps.length > 0
      );
    },
    steps() {
      if (!this.grimoire.isNight) return [];
      return nightSteps(this.grimoire.nightCount <= 1, this);
    },
    isDone() {
      return this.index >= this.steps.length;
    },
    step() {
      return this.steps[this.index] || null;
    },
    roleName() {
      return this.step ? this.localizeRole(this.step.role).name : "";
    },
    reminder() {
      if (!this.step) return "";
      const key =
        this.grimoire.nightCount <= 1
          ? "firstNightReminder"
          : "otherNightReminder";
      const text = this.localizeRole(this.step.role)[key] || "";
      return text
        .replace(/</g, "&lt;")
        .replace(/\*(.*?)\*/g, "<b>$1</b>")
        .replace(/:reminder:/g, "")
        .trim();
    },
    // waking goes through voice: in voice, or in a practice game
    canWake() {
      return this.isConnected || this.isPractice;
    },
    isAwake() {
      return (
        !!this.step &&
        this.step.players.every(({ id }) =>
          this.$store.state.voice.awake.includes(id),
        )
      );
    },
    guidedPlayers() {
      return this.isShown && this.step
        ? this.step.players.map(({ id }) => id)
        : [];
    },
    answers() {
      if (!this.step) return [];
      const list = [];
      this.step.players.forEach((player) => {
        const channel = "dm:" + player.id;
        this.chat.messages.forEach((message) => {
          if (message.channel !== channel || message.at < this.since) return;
          if (message.from !== STORYTELLER) {
            list.push({
              key: message.id,
              icon: "reply",
              text: `${player.name}: ${message.text}`,
            });
          } else if (message.card && message.choice) {
            list.push({
              key: message.id,
              icon: "check",
              text: `${player.name}: ${this.$t("cards.chosen", {
                players: message.choice.join(", "),
              })}`,
            });
          } else if (message.card) {
            list.push({
              key: message.id,
              icon: message.seen ? "check" : "paper-plane",
              text: `${player.name}: ${
                message.seen
                  ? this.$t("guidedNight.seen")
                  : this.$t("guidedNight.waiting")
              }`,
            });
          }
        });
        const view = this.session.grimoireViews[player.id];
        // shown from their seat menu (Spy): sent, then closed
        if (view) {
          list.push({
            key: "grimoire-" + player.id,
            icon: view === "seen" ? "check" : "book-open",
            text: `${player.name}: ${
              view === "seen"
                ? this.$t("guidedNight.seen")
                : this.$t("guidedNight.waiting")
            }`,
          });
        }
      });
      return list;
    },
  },
  watch: {
    // their seats light up on the town square
    guidedPlayers: {
      immediate: true,
      handler(ids) {
        this.$store.commit("setGuidedPlayers", ids);
      },
    },
    // a new night starts at the first step
    "grimoire.nightCount"() {
      this.goTo(0);
      this.isCollapsed = false;
    },
    // turned back on in the menu: shown again, also if hidden tonight
    "grimoire.isGuidedNight"(isOn) {
      if (isOn && this.hiddenNight !== null) {
        this.hiddenNight = null;
        this.save();
      }
    },
    // the list changed under us (a death, a new character): stay in range
    steps(steps) {
      if (this.index > steps.length) this.index = steps.length;
    },
  },
  created() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.night === this.grimoire.nightCount) {
        this.index = saved.index || 0;
        this.since = saved.since || Date.now();
        this.hiddenNight = saved.hidden ? saved.night : null;
      }
    } catch (e) {
      // nothing saved: start at the first step
    }
  },
  methods: {
    save() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            night: this.grimoire.nightCount,
            index: this.index,
            since: this.since,
            hidden: this.hiddenNight === this.grimoire.nightCount,
          }),
        );
      } catch (e) {
        // private window: progress just isn't kept
      }
    },
    goTo(index) {
      this.index = Math.max(0, Math.min(index, this.steps.length));
      this.since = Date.now();
      this.save();
    },
    previous() {
      if (this.index > 0) this.goTo(this.index - 1);
    },
    skip() {
      if (!this.isDone) this.goTo(this.index + 1);
    },
    next() {
      if (this.canWake) this.sleep();
      this.goTo(this.index + 1);
    },
    wake() {
      const { awake } = this.$store.state.voice;
      this.step.players.forEach(({ id }) => {
        if (!awake.includes(id)) this.$store.dispatch("voice/toggleAwake", id);
      });
    },
    sleep() {
      if (!this.step) return;
      const { awake } = this.$store.state.voice;
      this.step.players.forEach(({ id }) => {
        if (awake.includes(id)) this.$store.dispatch("voice/toggleAwake", id);
      });
    },
    // the card window, empty, for this step's players: what to send is
    // the storyteller's call (no guessing from the character's text)
    compose() {
      this.$store.commit("chat/composeCard", {
        to: this.step.players.map(({ id }) => id),
      });
    },
    toDay() {
      this.$store.commit("toggleNight", false);
    },
    fold() {
      this.isCollapsed = true;
    },
    // hidden until the next night; the menu setting turns it off for good
    hide() {
      this.hiddenNight = this.grimoire.nightCount;
      this.save();
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.guided-night {
  position: fixed;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  z-index: 70;
  width: min(560px, calc(100vw - 20px));
  box-sizing: border-box;
  padding: 8px 14px 12px;
  background: rgba(20, 16, 28, 0.94);
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  box-shadow: 0 0 20px black;
  font-size: 75%;

  // phones: a bottom sheet, like the player menu
  @media (max-width: 767.98px) {
    left: 0;
    bottom: 0;
    transform: none;
    width: 100%;
    border-radius: 14px 14px 0 0;
    border-width: 2px 0 0;
    font-size: 15px;
  }

  // wide screens: top right, between the menu buttons and the chat. At the
  // bottom it covered the seats down there, the current one included
  @media (min-width: 1100px) and (orientation: landscape) {
    left: auto;
    right: 10px;
    top: 52px;
    bottom: auto;
    transform: none;
    width: 330px;
  }

  &.collapsed {
    width: auto;
    padding: 6px 14px;
    cursor: pointer;
    @media (max-width: 767.98px) {
      left: 50%;
      bottom: 6px;
      transform: translateX(-50%);
      border-radius: 18px;
      border-width: 2px;
    }
  }
}

.pill {
  white-space: nowrap;
  svg {
    margin: 0 4px;
  }
}

.top {
  display: flex;
  align-items: center;
  gap: 6px;
  color: lightgray;
  font-size: 90%;

  .where {
    flex: 1;
    text-align: center;
  }
  .nav,
  .tool {
    cursor: pointer;
    padding: 2px 6px;
    &.off {
      opacity: 0.3;
      cursor: default;
    }
  }
}

h4 {
  margin: 6px 0 2px;
  font-size: 130%;
  color: $townsfolk;
  .dead {
    text-decoration: line-through;
    opacity: 0.7;
  }
}

.reminder {
  margin: 2px 0 6px;
  font-style: italic;
  color: #ddd;
  max-height: 4.6em;
  overflow-y: auto;
}

.hint {
  margin: 0 0 6px;
  font-size: 90%;
  color: lightgray;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;

  .button {
    display: inline-flex;
    align-items: center;
    width: auto;
    margin: 0;
    padding: 0 10px;
    font-size: 90%;
    &.on {
      background: rgba(255, 255, 255, 0.2);
    }
    svg {
      margin-right: 4px;
    }
  }
}

.answers {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  color: lightgray;
  li svg {
    margin-right: 6px;
    color: $townsfolk;
  }
}
</style>
