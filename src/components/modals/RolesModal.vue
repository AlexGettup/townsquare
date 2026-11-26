<template>
  <Modal
    class="roles"
    v-if="modals.roles && nonTravellers >= 5"
    @close="toggleModal('roles')"
  >
    <h3>{{ $t("modals.roles.title", { count: nonTravellers }) }}</h3>
    <ul class="tokens" v-for="(teamRoles, team) in roleSelection" :key="team">
      <li
        class="count"
        :class="[
          team,
          {
            off: !isCountRight(team),
            range: formatCounts(expected[team]).length > 1,
          },
        ]"
        :title="countTitle(team)"
      >
        <span>{{
          teamRoles.reduce((a, { selected }) => a + selected, 0)
        }}</span>
        <span>/ {{ formatCounts(expected[team]) }}</span>
      </li>
      <li
        v-for="role in teamRoles"
        :class="[
          {
            selected: role.selected,
            disabled: isDisabled(role),
          },
          role.team,
        ]"
        :key="role.id"
        @click="role.selected = role.selected ? 0 : 1"
      >
        <Token :role="role" />
        <font-awesome-icon
          icon="exclamation-triangle"
          v-if="role.setup || isDisabled(role)"
        />
        <div class="buttons" v-if="canRepeat(role)">
          <font-awesome-icon
            icon="minus-circle"
            @click.stop="role.selected--"
          />
          <span>{{ role.selected > 1 ? "x" + role.selected : "" }}</span>
          <font-awesome-icon
            icon="plus-circle"
            :class="{ spent: role.selected >= maxCopies(role) }"
            @click.stop="addCopy(role)"
          />
        </div>
      </li>
    </ul>
    <label class="multiple" :class="{ checked: allowMultiple }">
      <font-awesome-icon :icon="allowMultiple ? 'check-square' : 'square'" />
      <input type="checkbox" name="allow-multiple" v-model="allowMultiple" />
      {{ $t("modals.roles.allowDuplicates") }}
    </label>
    <div class="bottom">
      <div class="button-group">
        <!-- deal the characters in the grimoire only, without sending them
             (to try a setup, or to hand out physical tokens) -->
        <div
          class="button"
          @click="assignRoles"
          :class="{
            disabled:
              selectedRoles !== nonTravellers ||
              !selectedRoles ||
              isIllegalTokenSelected,
          }"
        >
          <font-awesome-icon
            :icon="isGardenerOrTorActive ? 'theater-masks' : 'search'"
          />
          {{
            isGardenerOrTorActive
              ? $t("modals.roles.assignRandomly", { count: selectedRoles })
              : $t("modals.roles.mockAssignment")
          }}
        </div>
        <div
          class="button"
          v-if="!isGardenerOrTorActive"
          @click="assignAndSendRoles"
          :class="{
            disabled:
              selectedRoles !== nonTravellers ||
              !selectedRoles ||
              isIllegalTokenSelected,
          }"
        >
          <font-awesome-icon icon="people-arrows" />
          {{ $t("modals.roles.passOutRandomly", { count: selectedRoles }) }}
        </div>
        <div class="button" @click="selectRandomRoles">
          <font-awesome-icon icon="random" />
          {{ $t("modals.roles.shuffle") }}
        </div>
        <div
          class="button clear"
          :class="{ disabled: !selectedRoles }"
          :title="$t('modals.roles.clear')"
          :aria-label="$t('modals.roles.clear')"
          role="button"
          @click="clearSelection"
        >
          <font-awesome-icon icon="trash-alt" />
        </div>
      </div>
    </div>
    <!-- what the chosen characters change in the setup, one line each -->
    <ul class="notes" v-if="notes.length">
      <li
        v-for="note in notes"
        :key="note.id"
        :class="{ illegal: note.illegal, missing: note.missing }"
      >
        <font-awesome-icon icon="exclamation-triangle" />
        <span>
          <strong>{{ note.name }}</strong>
          <template v-if="note.setup">[{{ note.setup }}]</template>
          {{ note.text }}
        </span>
        <span
          class="add"
          v-if="note.add"
          role="button"
          @click="addRequired(note.add)"
        >
          {{ $t("modals.roles.add", { name: note.addName }) }}
        </span>
      </li>
    </ul>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import gameJSON from "./../../counts.json";
import Token from "./../Token";
import { mapGetters, mapMutations, mapState } from "vuex";
import {
  RULES,
  allowsGoodDuplicates,
  canRepeat,
  expectedCounts,
  formatCounts,
  isBagDisabled,
  maxCopies,
  setupText,
} from "../../setupRules";

const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default {
  components: {
    Token,
    Modal,
  },
  data: function () {
    return {
      roleSelection: {},
      game: gameJSON,
      allowMultiple: false,
    };
  },
  computed: {
    selectedRoles: function () {
      return Object.values(this.roleSelection)
        .map((roles) => roles.reduce((a, { selected }) => a + selected, 0))
        .reduce((a, b) => a + b, 0);
    },
    chosenRoles: function () {
      return Object.values(this.roleSelection)
        .reduce((all, roles) => [...all, ...roles], [])
        .filter((role) => role.selected);
    },
    // usual counts for the number of players, then what the characters change
    expected: function () {
      const base = this.game[Math.max(5, this.nonTravellers) - 5];
      return expectedCounts(
        base,
        [
          ...this.chosenRoles.map((role) => role.id),
          ...this.npcs.map((npc) => npc.id),
        ],
        this.roles.has("drunk"),
      );
    },
    repeatOptions: function () {
      return {
        allowMultiple: this.allowMultiple,
        goodDuplicates: allowsGoodDuplicates([
          ...this.chosenRoles,
          ...this.npcs,
        ]),
      };
    },
    notes: function () {
      const sources = [...this.chosenRoles, ...this.npcs];
      return sources
        .filter(
          (role) =>
            role.setup ||
            RULES[role.id] ||
            isBagDisabled(role) ||
            this.$te(`modals.roles.notes.${role.id}`),
        )
        .filter(
          (role, index, shown) =>
            shown.findIndex((r) => r.id === role.id) === index,
        )
        .map((role) => {
          const shown = this.localizeRole(role);
          const rule = RULES[role.id] || {};
          const required =
            rule.requires &&
            !this.chosenRoles.some((r) => r.id === rule.requires)
              ? this.roles.get(rule.requires)
              : null;
          const ability = setupText(shown.ability);
          return {
            id: role.id,
            name: shown.name,
            // Fabled and Loric are setup rules in themselves
            setup: ability,
            text: this.$te(`modals.roles.notes.${role.id}`)
              ? this.$t(`modals.roles.notes.${role.id}`)
              : ability
                ? ""
                : shown.ability,
            illegal: isBagDisabled(role),
            missing: !!(
              rule.requires &&
              !this.chosenRoles.some((r) => r.id === rule.requires)
            ),
            add: required ? required.id : null,
            addName: required ? this.localizeRole(required).name : "",
          };
        });
    },
    isGardenerOrTorActive: function () {
      return this.npcs.some((npc) => npc.id === "gardener" || npc.id === "tor");
    },
    isIllegalTokenSelected: function () {
      return Object.values(this.roleSelection).some((roles) =>
        roles.some((role) => role.selected && this.isDisabled(role)),
      );
    },
    ...mapState(["grimoire", "roles", "npcs", "modals"]),
    ...mapState("players", ["players"]),
    ...mapGetters({ nonTravellers: "players/nonTravellers" }),
    ...mapGetters(["localizeRole"]),
  },
  methods: {
    formatCounts,
    canRepeat(role) {
      return canRepeat(role, this.repeatOptions);
    },
    maxCopies(role) {
      return maxCopies(role, this.repeatOptions);
    },
    addCopy(role) {
      if (role.selected < this.maxCopies(role)) role.selected++;
    },
    isCountRight(team) {
      const counts = this.expected[team];
      if (!counts) return true;
      const chosen = (this.roleSelection[team] || []).reduce(
        (a, { selected }) => a + selected,
        0,
      );
      return counts.includes(chosen);
    },
    countTitle(team) {
      if (!this.isCountRight(team)) {
        return this.$t("modals.roles.countOff", {
          count: formatCounts(this.expected[team]),
        });
      }
      // why one Outsider fewer and one Townsfolk more is also fine
      const outsiders = this.expected.outsider;
      return this.roles.has("drunk") &&
        ["townsfolk", "outsider"].includes(team) &&
        outsiders &&
        outsiders.length > 1
        ? this.$t("modals.roles.countDrunk")
        : "";
    },
    // a character another one needs (the Huntsman's Damsel)
    addRequired(id) {
      const role = (
        this.roleSelection[(this.roles.get(id) || {}).team] || []
      ).find((r) => r.id === id);
      if (role && !role.selected) role.selected = 1;
    },
    selectRandomRoles() {
      this.roleSelection = {};
      this.roles.forEach((role) => {
        if (!this.roleSelection[role.team]) {
          this.$set(this.roleSelection, role.team, []);
        }
        this.roleSelection[role.team].push(role);
        this.$set(role, "selected", 0);
      });
      delete this.roleSelection["traveller"];
      const playerCount = Math.max(5, this.nonTravellers);
      const composition = this.game[playerCount - 5];
      Object.keys(composition).forEach((team) => {
        for (let x = 0; x < composition[team]; x++) {
          if (this.roleSelection[team]) {
            const available = this.roleSelection[team].filter(
              (role) => !role.selected,
            );
            if (available.length) {
              randomElement(available).selected = 1;
            }
          }
        }
      });
    },
    clearSelection() {
      Object.values(this.roleSelection).forEach((roles) =>
        roles.forEach((role) => {
          role.selected = 0;
        }),
      );
    },
    assignRoles() {
      if (
        this.selectedRoles !== this.nonTravellers ||
        !this.selectedRoles ||
        this.isIllegalTokenSelected
      ) {
        return;
      }
      // generate list of selected roles and randomize it
      const roles = Object.values(this.roleSelection)
        .map((roles) =>
          roles
            // duplicate roles selected more than once and filter unselected
            .reduce((a, r) => [...a, ...Array(r.selected).fill(r)], []),
        )
        // flatten into a single array
        .reduce((a, b) => [...a, ...b], [])
        .map((a) => [Math.random(), a])
        .sort((a, b) => a[0] - b[0])
        .map((a) => a[1]);
      this.players.forEach((player) => {
        if (player.role.team !== "traveller" && roles.length) {
          const value = roles.pop();
          this.$store.commit("players/update", {
            player,
            property: "role",
            value,
          });
        }
      });
      this.$store.commit("toggleModal", "roles");
    },
    assignAndSendRoles() {
      if (
        this.selectedRoles !== this.nonTravellers ||
        !this.selectedRoles ||
        this.isIllegalTokenSelected
      ) {
        return;
      }
      const popup = this.players.some((player) => !player.connected)
        ? this.$t("dialogs.assignAndSendWarning")
        : this.$t("dialogs.assignAndSendConfirm");
      if (!confirm(popup)) return;
      this.assignRoles();
      this.$store.commit("session/distributeRoles", true);
      setTimeout(
        (() => {
          this.$store.commit("session/distributeRoles", false);
        }).bind(this),
        2000,
      );
    },
    isDisabled(role) {
      return (
        role.special &&
        role.special.some(
          (special) =>
            special.type === "selection" && special.name === "bag-disabled",
        )
      );
    },
    ...mapMutations(["toggleModal"]),
  },
  mounted: function () {
    if (!Object.keys(this.roleSelection).length) {
      this.selectRandomRoles();
    }
  },
  watch: {
    roles() {
      this.selectRandomRoles();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../../vars.scss";

ul.tokens {
  padding-left: 5%;
  li {
    border-radius: 50%;
    width: 5vw;
    margin: 5px;
    filter: brightness(0.5);
    transition: all 250ms;

    @media (orientation: portrait) {
      width: 7vh;
    }

    &.disabled {
      box-shadow:
        0 0 10px gray,
        0 0 10px gray;
      .token {
        filter: grayscale(1);
      }
      .fa-exclamation-triangle {
        color: gold;
      }
    }
    &.selected {
      filter: none;
      .buttons {
        display: flex;
      }
      .fa-exclamation-triangle {
        display: block;
      }
    }
    &.townsfolk:not(.disabled) {
      box-shadow:
        0 0 10px $townsfolk,
        0 0 10px #004cff;
    }
    &.outsider:not(.disabled) {
      box-shadow:
        0 0 10px $outsider,
        0 0 10px $outsider;
    }
    &.minion:not(.disabled) {
      box-shadow:
        0 0 10px $minion,
        0 0 10px $minion;
    }
    &.demon:not(.disabled) {
      box-shadow:
        0 0 10px $demon,
        0 0 10px $demon;
    }
    &.traveller:not(.disabled) {
      box-shadow:
        0 0 10px $traveller,
        0 0 10px $traveller;
    }
    &:hover {
      transform: scale(1.2);
      z-index: 10;
    }
    .fa-exclamation-triangle {
      position: absolute;
      color: red;
      filter: drop-shadow(0 0 3px black) drop-shadow(0 0 3px black);
      top: 5px;
      right: -5px;
      font-size: 150%;
      display: none;
    }
    .buttons {
      display: none;
      position: absolute;
      top: 95%;
      text-align: center;
      width: 100%;
      z-index: 30;
      font-weight: bold;
      filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
      span {
        flex-grow: 1;
      }
      svg {
        opacity: 0.25;
        cursor: pointer;
        &:hover {
          opacity: 1;
          color: red;
        }
      }
    }
  }
  .count {
    opacity: 1;
    position: absolute;
    left: 0;
    font-weight: bold;
    font-size: 75%;
    width: 5%;
    display: flex;
    align-items: center;
    justify-content: center;

    @media (orientation: portrait) {
      width: 8%;
    }

    &:after {
      content: " ";
      display: block;
      padding-top: 100%;
    }
    &.townsfolk {
      color: $townsfolk;
    }
    &.outsider {
      color: $outsider;
    }
    &.minion {
      color: $minion;
    }
    &.demon {
      color: $demon;
    }
    span + span {
      margin-left: 0.25em;
    }
    // a range ("5–6") doesn't fit in one line: the count above it
    &.range {
      flex-direction: column;
      font-size: 60%;
      line-height: 1.1;
      white-space: nowrap;
      aspect-ratio: 1;
      &:after {
        display: none;
      }
      span + span {
        margin-left: 0;
      }
    }
    // not what the chosen characters call for (only a warning)
    &.off {
      text-decoration: underline wavy red;
      text-underline-offset: 3px;
    }
  }
  .buttons .spent {
    opacity: 0.1;
    pointer-events: none;
  }
}

ul.notes {
  // the modal lays lists out in a row: one note per line here
  display: block;
  list-style: none;
  margin: 10px auto 0;
  padding: 0;
  max-width: 720px;
  font-size: 90%;
  text-align: left;
  li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 3px 0;
    > svg {
      color: $outsider;
      flex-shrink: 0;
    }
    &.illegal > svg,
    &.missing > svg {
      color: gold;
    }
    strong {
      margin-right: 4px;
    }
    .add {
      flex-shrink: 0;
      margin-left: auto;
      cursor: pointer;
      text-decoration: underline;
      &:hover {
        color: red;
      }
    }
  }
}

.roles .modal {
  .multiple {
    display: block;
    text-align: center;
    cursor: pointer;
    &.checked,
    &:hover {
      color: red;
    }
    &.checked {
      margin-top: 10px;
    }
    svg {
      margin-right: 5px;
    }
    input {
      display: none;
    }
  }

  .bottom {
    display: flex;
    justify-content: center;
    align-items: center;
    // phones: the buttons don't fit in one row
    @media screen and (max-width: 767.98px) {
      .button-group {
        flex-wrap: wrap;
        gap: 6px;
        .button {
          margin: 0;
          padding: 6px 10px;
          border-radius: 15px;
        }
      }
    }
  }
}
</style>
