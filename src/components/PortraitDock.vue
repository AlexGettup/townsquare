<template>
  <nav class="portrait-dock" v-if="tabs.length" :class="{ closed: !isOpen }">
    <ul class="dock-tabs" role="tablist">
      <li
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="isOpen && tab.id === current ? 'true' : 'false'"
        :class="{ active: isOpen && tab.id === current }"
        @click="select(tab.id)"
      >
        <span>{{ tab.label }}</span>
        <em class="badge" v-if="tab.badge">{{ tab.badge }}</em>
      </li>
    </ul>
  </nav>
</template>

<script>
import { mapGetters, mapState } from "vuex";

const STORAGE_KEY = "portraitDock";
const PORTRAIT = "(orientation: portrait)";

/**
 * Upright screens: the guided night (storyteller), demon bluffs, NPCs and
 * text chat panels stop floating
 * over the seats and share a strip at the bottom, one at a time, picked with
 * these tabs. Tapping the open tab folds the strip and the town square grows.
 * The panels keep their own components: the classes this sets on <html>
 * (has-dock, dock-<tab>, dock-closed) place them in the strip, see the
 * "portrait dock" styles in TownSquare.vue and ChatPanel.vue. Landscape
 * screens don't show it and keep the floating panels.
 */
export default {
  data() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      // starts on the first tab, open
    }
    return {
      chosen: saved.tab || "chat",
      isOpen: saved.isOpen !== false,
      isPortrait: false,
    };
  },
  computed: {
    tabs: function () {
      if (!this.players.length) return [];
      const tabs = [];
      // storyteller: the guided night, first while it's on
      if (this.isGuidedNightShown) {
        tabs.push({ id: "night", label: this.$t("guidedNight.tab") });
      }
      if (
        (this.voice.isAvailable && this.session.sessionId) ||
        this.practice.active
      ) {
        tabs.push({
          id: "chat",
          label: this.$t("chat.title"),
          badge: this.chat.isOpen ? 0 : this.totalUnread,
        });
      }
      // the storyteller hiding the grimoire hides the bluffs too
      if (!this.grimoire.isPublic) {
        tabs.push({
          id: "bluffs",
          label:
            this.session.isSpectator && !this.revealedGrimoire
              ? this.$t("townSquare.otherCharacters")
              : this.$t("townSquare.demonBluffsShort"),
        });
      }
      if (this.npcs.length) {
        tabs.push({ id: "npcs", label: this.$t("townSquare.npcs") });
      }
      return tabs;
    },
    // the tab chosen, or the first one when that one isn't there
    current: function () {
      const ids = this.tabs.map(({ id }) => id);
      return ids.includes(this.chosen) ? this.chosen : ids[0] || "";
    },
    // set on <html>: which panel the strip shows
    appClasses: function () {
      if (!this.tabs.length) return [];
      return [
        "has-dock",
        "dock-" + this.current,
        ...(this.isOpen ? [] : ["dock-closed"]),
      ];
    },
    // upright, the chat panel is open only while its tab is showing
    isChatShown: function () {
      return this.isOpen && this.current === "chat";
    },
    revealedGrimoire: function () {
      return this.$store.getters["session/revealedGrimoire"];
    },
    ...mapState([
      "chat",
      "voice",
      "session",
      "grimoire",
      "practice",
      "npcs",
      "isGuidedNightShown",
    ]),
    ...mapState("players", ["players"]),
    ...mapGetters("chat", ["totalUnread"]),
  },
  watch: {
    appClasses: {
      handler(classes, previous) {
        // on <html>: Vue rewrites #app's own classes when it updates them
        const root = document.documentElement;
        (previous || []).forEach((name) => root.classList.remove(name));
        classes.forEach((name) => root.classList.add(name));
        this.$nextTick(() => this.reportHeight());
      },
      immediate: true,
    },
    isChatShown() {
      this.syncChat();
    },
    // night falls with the guided night on: its tab opens, and at day the
    // strip goes back to the tab it showed before
    isGuidedNightShown(isShown) {
      if (isShown) {
        if (this.chosen !== "night") this.beforeNight = this.chosen;
        this.chosen = "night";
        this.isOpen = true;
      } else if (this.chosen === "night") {
        this.chosen = this.beforeNight || "chat";
      }
      this.save();
    },
    isPortrait(isPortrait) {
      // back to landscape: the chat panel as it was before turning
      if (!isPortrait && this.landscapeChat !== undefined) {
        this.$store.commit("chat/setOpen", this.landscapeChat);
        this.landscapeChat = undefined;
      }
      this.syncChat();
    },
  },
  mounted() {
    this.query = window.matchMedia ? window.matchMedia(PORTRAIT) : null;
    this.onTurn = () => {
      this.isPortrait = !!this.query && this.query.matches;
      this.$nextTick(() => this.reportHeight());
    };
    if (this.query) {
      this.query.addEventListener
        ? this.query.addEventListener("change", this.onTurn)
        : this.query.addListener(this.onTurn);
    }
    window.addEventListener("resize", this.onTurn);
    this.onTurn();
  },
  updated() {
    this.reportHeight();
  },
  beforeDestroy() {
    if (this.query) {
      this.query.removeEventListener
        ? this.query.removeEventListener("change", this.onTurn)
        : this.query.removeListener(this.onTurn);
    }
    window.removeEventListener("resize", this.onTurn);
    this.appClasses.forEach((name) =>
      document.documentElement.classList.remove(name),
    );
    document.documentElement.style.setProperty("--dock-space", "0px");
  },
  methods: {
    select(tab) {
      if (tab === this.current) {
        this.isOpen = !this.isOpen;
      } else {
        this.chosen = tab;
        this.isOpen = true;
      }
      this.save();
    },
    save() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ tab: this.chosen, isOpen: this.isOpen }),
        );
      } catch (e) {
        // only remembered until the page reloads
      }
    },
    syncChat() {
      if (!this.isPortrait || !this.tabs.some(({ id }) => id === "chat"))
        return;
      if (this.landscapeChat === undefined) {
        this.landscapeChat = this.chat.isOpen;
      }
      if (this.chat.isOpen !== this.isChatShown) {
        this.$store.commit("chat/setOpen", this.isChatShown);
      }
    },
    // the room the strip takes at the bottom (0 in landscape, where it's
    // hidden): the town square is laid out above it (App.vue)
    reportHeight() {
      const height =
        this.isPortrait && this.$el && this.$el.nodeType === 1
          ? this.$el.offsetHeight
          : 0;
      document.documentElement.style.setProperty("--dock-space", height + "px");
    },
  },
};
</script>

<style lang="scss">
@import "../vars.scss";

:root {
  // the screen's visible height (on phones 100vh includes what the browser's
  // bars cover)
  --app-height: 100vh;
  @supports (height: 100dvh) {
    --app-height: 100dvh;
  }
  // the tabs, and the panel above them: what's left below a full-width
  // circle and the menu buttons, between 150 and 300 pixels
  --dock-bar: 42px;
  --dock-body: clamp(150px, var(--app-height) - 100vw - 90px, 300px);
}
// the guided night needs its buttons in view: a bit more room, the circle
// shrinks a little
html.dock-night {
  --dock-body: clamp(210px, var(--app-height) - 100vw - 90px, 300px);
}

.portrait-dock {
  display: none;

  @media (orientation: portrait) {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 55;
    height: calc(
      var(--dock-bar) + var(--dock-body) + env(safe-area-inset-bottom, 0px)
    );
    background: rgba(0, 0, 0, 0.85);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 0 20px black;

    &.closed {
      height: calc(var(--dock-bar) + env(safe-area-inset-bottom, 0px));
    }
  }
}

.dock-tabs {
  display: flex;
  height: var(--dock-bar);
  margin-bottom: env(safe-area-inset-bottom, 0px);
  padding: 0 max(4px, env(safe-area-inset-right, 0px)) 0
    max(4px, env(safe-area-inset-left, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.15);

  li {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 4px;
    border-top: 3px solid transparent;
    color: lightgray;
    font-size: 16px;
    cursor: pointer;
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    &.active {
      color: white;
      font-weight: bold;
      border-top-color: $townsfolk;
    }
  }

  .badge {
    font-style: normal;
    font-size: 75%;
    line-height: 1.6;
    min-width: 1.6em;
    padding: 0 4px;
    text-align: center;
    border-radius: 1em;
    background: $demon;
    color: white;
  }
}
</style>
