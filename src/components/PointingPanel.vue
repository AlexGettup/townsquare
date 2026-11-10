<template>
  <div class="pointing-panel" v-if="isShown">
    <h3>
      <font-awesome-icon icon="hand-point-up" />
      {{ $t("pointing.title") }}
    </h3>

    <!-- storyteller, while players point: who has, at whom -->
    <p class="status" v-if="!isRevealed">
      {{ $t("pointing.progress", { done: done, total: rows.length }) }}
    </p>
    <p class="status" v-else>{{ $t("pointing.revealed") }}</p>

    <!-- the most pointed at first -->
    <ul class="tally" v-if="tally.length">
      <li v-for="[name, count] in tally" :key="name">
        <span class="name">{{ name }}</span>
        <span class="count">
          <font-awesome-icon icon="hand-point-up" /> {{ count }}
        </span>
      </li>
    </ul>

    <ul class="who">
      <li v-for="row in rows" :key="row.from" :class="{ waiting: !row.to }">
        {{ row.from }} → {{ row.to || "…" }}
      </li>
    </ul>

    <div class="button-group" v-if="!session.isSpectator">
      <div
        class="button townsfolk"
        v-if="!isRevealed"
        :class="{ disabled: !done }"
        @click="reveal"
      >
        {{ $t("pointing.reveal") }}
      </div>
      <div class="button" @click="close">
        {{ isRevealed ? $t("pointing.close") : $t("pointing.cancel") }}
      </div>
    </div>
    <div class="button-group" v-else>
      <div class="button" @click="hidden = session.pointing.since">
        {{ $t("pointing.close") }}
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";

/**
 * Pointing vote (Boomdandy): the storyteller sees who points at whom as the
 * answers come; once revealed, everyone sees it, most pointed at first.
 */
export default {
  data() {
    return {
      // player: the pointing vote they closed (by its start)
      hidden: null,
    };
  },
  computed: {
    ...mapState(["session"]),
    ...mapGetters({ pointingRows: "chat/pointingRows" }),
    isRevealed: function () {
      return !!this.session.pointing && !!this.session.pointing.pairs;
    },
    isShown: function () {
      const { pointing } = this.session;
      if (!pointing) return false;
      if (!this.session.isSpectator) return true;
      return this.isRevealed && this.hidden !== pointing.since;
    },
    // [{ from, to }] by seat: live for the storyteller, the revealed ones after
    rows: function () {
      if (this.isRevealed) {
        return this.session.pointing.pairs.map(([from, to]) => ({ from, to }));
      }
      return this.pointingRows;
    },
    done: function () {
      return this.rows.filter(({ to }) => to).length;
    },
    tally: function () {
      const counts = {};
      this.rows.forEach(({ to }) => {
        if (to) counts[to] = (counts[to] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    },
  },
  methods: {
    reveal() {
      if (!this.done) return;
      this.$store.commit("session/setPointing", {
        since: this.session.pointing.since,
        pairs: this.rows.map(({ from, to }) => [from, to || ""]),
      });
    },
    close() {
      this.$store.commit("session/setPointing", null);
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.pointing-panel {
  // the corner the circle never reaches, below the menu buttons
  position: fixed;
  top: 55px;
  right: 10px;
  z-index: 60;
  width: 220px;
  max-height: calc(100% - 65px);
  overflow-y: auto;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid #b8561b;
  border-radius: 10px;
  font-size: 90%;
  overflow-wrap: anywhere;
  // upright, the free space is a strip below the circle
  @media (orientation: portrait) {
    top: auto;
    bottom: 10px;
    left: 10px;
    right: 10px;
    width: auto;
    max-height: 40%;
  }
}

h3 {
  margin: 0 0 4px;
  font-size: 110%;
  svg {
    margin-right: 4px;
    color: #e8b04a;
  }
}

.status {
  margin: 0 0 6px;
  color: lightgray;
  font-size: 90%;
}

ul {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}

.tally li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-weight: bold;
  .count svg {
    color: #e8b04a;
  }
}

.who li {
  font-size: 90%;
  &.waiting {
    color: gray;
  }
}

.button-group .button {
  font-size: 85%;
}
</style>
