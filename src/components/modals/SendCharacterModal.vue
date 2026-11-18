<template>
  <Modal class="send-character" v-if="isDisplayed" @close="close">
    <h3>{{ $t("sendCharacter.title", { name: player.name }) }}</h3>

    <h4>{{ $t("sendCharacter.character") }}</h4>
    <ul class="tokens">
      <li
        v-for="role in roleList"
        :key="role.id"
        :class="[role.team, { selected: role.id === roleId }]"
        @click="pickRole(role)"
      >
        <Token :role="role" />
      </li>
    </ul>

    <h4>{{ $t("sendCharacter.alignment") }}</h4>
    <ul class="chips">
      <li
        v-for="option in alignments"
        :key="option"
        :class="[option, { selected: alignment === option }]"
        @click="alignment = option"
      >
        {{ $t(`modals.role.alignment.${option}`) }}
      </li>
    </ul>

    <p class="hint">{{ $t("sendCharacter.hint") }}</p>
    <div class="button-group">
      <div class="button townsfolk" :class="{ disabled: !role }" @click="send">
        <font-awesome-icon icon="paper-plane" />
        {{ $t("sendCharacter.send") }}
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapGetters, mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import Token from "../Token";
import { ALIGNMENTS, alignmentIndexOf, alignmentOf } from "../../cards";

const TEAMS = ["townsfolk", "outsider", "minion", "demon", "traveller"];

/**
 * Storyteller: give one player a new character and alignment (Snake
 * Charmer, Pit-Hag, Barber, Fang Gu, Goon…). Changes their token here and on
 * their device and sends them a "You are" card; nobody else gets anything.
 */
export default {
  components: { Modal, Token },
  props: ["playerIndex"],
  data() {
    return {
      // kept while open: seats can move during the game
      player: null,
      roleId: null,
      alignment: "good",
      alignments: ALIGNMENTS,
    };
  },
  computed: {
    isDisplayed() {
      return !!(this.modals.sendCharacter && this.player);
    },
    // the script's characters, plus the player's own if it isn't in it
    roleList() {
      const list = [...this.roles.values()];
      const own = this.player && this.player.role;
      if (own && own.id && !list.some(({ id }) => id === own.id))
        list.push(own);
      return list
        .filter(({ team }) => TEAMS.includes(team))
        .sort((a, b) => TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team));
    },
    role() {
      return this.roleList.find(({ id }) => id === this.roleId) || null;
    },
    ...mapState(["modals", "roles"]),
    ...mapState("players", ["players"]),
    ...mapGetters(["localizeRole"]),
  },
  watch: {
    "modals.sendCharacter": {
      immediate: true,
      handler(isOpen) {
        this.player = isOpen ? this.players[this.playerIndex] || null : null;
        if (!this.player) return;
        const { role, alignmentIndex } = this.player;
        this.roleId = (role && role.id) || null;
        this.alignment =
          (role && alignmentOf(role.team, alignmentIndex)) || "good";
      },
    },
  },
  methods: {
    // a new character comes with its team's usual alignment
    pickRole(role) {
      this.roleId = role.id;
      this.alignment = alignmentOf(role.team, 0) || "good";
    },
    send() {
      if (!this.role) return;
      this.$store.dispatch("session/sendCharacter", {
        player: this.player,
        role: this.role,
        alignmentIndex: alignmentIndexOf(this.role.team, this.alignment),
      });
      this.close();
    },
    close() {
      if (this.modals.sendCharacter) this.toggleModal("sendCharacter");
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

.send-character :deep(.modal) {
  width: 600px;
  max-width: 100%;
  overflow-x: hidden;
}

h4 {
  margin: 10px 0 6px;
}

// like the character window (RoleModal): faded until picked
ul.tokens {
  justify-content: center;
  li {
    border-radius: 50%;
    width: 64px;
    margin: 4px;
    cursor: pointer;
    opacity: 0.45;
    transition: transform 200ms ease;
    &.townsfolk {
      box-shadow: 0 0 8px $townsfolk;
    }
    &.outsider {
      box-shadow: 0 0 8px $outsider;
    }
    &.minion {
      box-shadow: 0 0 8px $minion;
    }
    &.demon {
      box-shadow: 0 0 8px $demon;
    }
    &.traveller {
      box-shadow: 0 0 8px $traveller;
    }
    &:hover {
      opacity: 0.8;
    }
    &.selected {
      opacity: 1;
      transform: scale(1.15);
      z-index: 1;
    }
  }
}

.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 8px;
  li {
    padding: 4px 16px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    &.selected.good {
      background: $townsfolk;
      border-color: $townsfolk;
    }
    &.selected.evil {
      background: $demon;
      border-color: $demon;
    }
  }
}

.hint {
  margin: 12px 0 0;
  font-size: 90%;
  opacity: 0.8;
}

.button-group {
  justify-content: flex-end;
}
</style>
