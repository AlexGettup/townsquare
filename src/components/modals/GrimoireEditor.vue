<template>
  <Modal class="grimoire-editor" v-if="player" @close="close">
    <h3>{{ $t("grimoireEditor.title", { name: player.name }) }}</h3>
    <p class="hint">{{ $t("grimoireEditor.hint") }}</p>

    <!-- one row per seat: character, then its reminders -->
    <ul class="seats">
      <li
        v-for="(seat, index) in draft.players"
        :key="index"
        :class="{ changed: isChanged(index) }"
      >
        <span class="name">{{ players[index] && players[index].name }}</span>
        <div
          class="token-slot"
          :class="[roleOf(seat.roleId).team, { picking: picking === index }]"
          :title="$t('grimoireEditor.changeCharacter')"
          @click="pick(index)"
        >
          <Token :role="roleOf(seat.roleId)" />
        </div>
        <ul class="reminders">
          <li
            v-for="(reminder, i) in seat.reminders"
            :key="i"
            :title="$t('grimoireEditor.removeReminder')"
            @click="seat.reminders.splice(i, 1)"
          >
            {{ localizeReminder(reminder) }}
            <font-awesome-icon icon="times-circle" />
          </li>
        </ul>
      </li>
    </ul>

    <!-- the Demon's bluffs -->
    <h4>{{ $t("grimoireEditor.bluffs") }}</h4>
    <ul class="bluffs">
      <li
        v-for="(roleId, index) in draft.bluffs"
        :key="index"
        class="token-slot"
        :class="[roleOf(roleId).team, { picking: picking === 'bluff' + index }]"
        @click="pick('bluff' + index)"
      >
        <Token :role="roleOf(roleId)" />
      </li>
    </ul>

    <!-- the characters to put on the seat or bluff being changed -->
    <section class="picker" v-if="picking !== null">
      <h4>{{ $t("grimoireEditor.pickCharacter") }}</h4>
      <ul class="tokens">
        <li class="none" @click="setRole('')">
          {{ $t("grimoireEditor.noCharacter") }}
        </li>
        <li
          v-for="role in scriptRoles"
          :key="role.id"
          :class="role.team"
          @click="setRole(role.id)"
        >
          <Token :role="role" />
        </li>
      </ul>
    </section>

    <div class="button-group">
      <div class="button" v-if="isEdited" @click="reset">
        <font-awesome-icon icon="undo" />
        {{ $t("grimoireEditor.reset") }}
      </div>
      <div class="button townsfolk" @click="send">
        <font-awesome-icon icon="book-open" />
        {{ $t("grimoireEditor.send") }}
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import Modal from "./Modal";
import Token from "../Token";

const copy = (grimoire) => JSON.parse(JSON.stringify(grimoire));

/**
 * Storyteller: the grimoire a player (Spy, Widow) is about to see, as it is
 * now, to change before sending, like the official app: another character on
 * a seat, fewer reminders, other bluffs. The real grimoire stays as it is.
 */
export default {
  components: { Modal, Token },
  data() {
    return {
      draft: { players: [], bluffs: [] },
      original: { players: [], bluffs: [] },
      // the seat index or "bluff<n>" whose character is being changed
      picking: null,
    };
  },
  computed: {
    playerId: function () {
      return this.session.editingGrimoireFor;
    },
    player: function () {
      return this.players.find(({ id }) => id === this.playerId) || null;
    },
    scriptRoles: function () {
      return [...this.roleMap.values()];
    },
    isEdited: function () {
      return JSON.stringify(this.draft) !== JSON.stringify(this.original);
    },
    ...mapState(["session"]),
    ...mapState({ roleMap: "roles" }),
    ...mapState("players", ["players"]),
    ...mapGetters(["rolesJSONbyId", "localizeReminder"]),
  },
  watch: {
    // the grimoire is only shown at night
    "$store.state.grimoire.isNight"(isNight) {
      if (!isNight && this.playerId) this.close();
    },
    // a fresh copy of the grimoire each time it opens
    playerId: {
      immediate: true,
      handler(playerId) {
        if (!playerId) return;
        this.original = copy(this.$store.getters["session/grimoireSnapshot"]);
        this.draft = copy(this.original);
        this.picking = null;
      },
    },
  },
  methods: {
    roleOf(roleId) {
      if (!roleId) return {};
      return (
        this.roleMap.get(roleId) ||
        this.rolesJSONbyId.get(roleId) ||
        this.$store.state.otherTravellers.get(roleId) || { id: roleId }
      );
    },
    isChanged(index) {
      return (
        JSON.stringify(this.draft.players[index]) !==
        JSON.stringify(this.original.players[index])
      );
    },
    pick(target) {
      this.picking = this.picking === target ? null : target;
    },
    setRole(roleId) {
      if (typeof this.picking === "number") {
        this.draft.players[this.picking].roleId = roleId;
      } else if (this.picking !== null) {
        const index = Number(this.picking.slice("bluff".length));
        this.draft.bluffs.splice(index, 1, roleId);
      }
      this.picking = null;
    },
    reset() {
      this.draft = copy(this.original);
      this.picking = null;
    },
    send() {
      this.$store.commit("session/setGrimoireView", {
        playerId: this.playerId,
        status: "sent",
        grimoire: copy(this.draft),
      });
      this.close();
    },
    close() {
      this.$store.commit("session/setEditingGrimoire", null);
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.grimoire-editor :deep(.modal) {
  overflow-y: auto;
  overflow-x: hidden;
  width: 760px;
  @media (max-width: 767.98px) {
    padding: 10px 12px;
  }
}

h3 {
  margin-bottom: 2px;
}

h4 {
  font-family: "Roboto Condensed", sans-serif;
  text-align: left;
  font-size: 80%;
  color: lightgray;
  margin: 8px 0 4px;
}

.hint {
  margin: 0 0 8px;
  font-size: 80%;
  color: lightgray;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

// seats in columns, as many as fit
.seats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 4px 10px;
}

.seats > li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  // changed from the real grimoire
  &.changed {
    box-shadow: inset 3px 0 0 #e8b04a;
  }
  .name {
    width: 70px;
    flex-shrink: 0;
    text-align: left;
    font-size: 90%;
  }
}

.token-slot {
  width: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 150ms;
  &:hover {
    transform: scale(1.08);
  }
  &.picking {
    box-shadow: 0 0 0 3px white;
  }
}

.reminders {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  li {
    padding: 1px 8px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 75%;
    cursor: pointer;
    svg {
      margin-left: 3px;
      opacity: 0.6;
    }
    &:hover {
      color: red;
      svg {
        opacity: 1;
      }
    }
  }
}

.bluffs {
  display: flex;
  gap: 10px;
}

.picker .tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px;
  li {
    width: 52px;
    border-radius: 50%;
    cursor: pointer;
    &:hover {
      transform: scale(1.08);
    }
    &.none {
      display: flex;
      align-items: center;
      justify-content: center;
      width: auto;
      padding: 0 10px;
      border-radius: 12px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      font-size: 80%;
    }
  }
}

.button-group {
  margin-top: 10px;
}
</style>
