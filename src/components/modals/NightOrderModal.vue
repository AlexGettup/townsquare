<template>
  <Modal
    class="night-reference"
    :class="{
      storyteller: !session.isSpectator,
    }"
    @close="toggleModal('nightOrder')"
    v-if="modals.nightOrder && roles.size"
  >
    <font-awesome-icon
      @click="toggleModal('reference')"
      icon="address-card"
      class="toggle"
      :title="$t('modals.nightOrder.showReference')"
    />
    <h3>
      {{ $t("modals.nightOrder.title") }}
      <br />
      <font-awesome-icon icon="cloud-moon" />
      {{ edition.name || $t("modals.reference.customScript") }}
    </h3>
    <div class="night">
      <ul class="first">
        <li class="headline">{{ $t("modals.nightOrder.firstNight") }}</li>
        <li
          v-for="role in rolesFirstNight"
          :key="role.name"
          :class="[role.team]"
        >
          <span class="name">
            {{ role.name }}
            <span class="player" v-if="role.players.length">
              <br />
              <small
                v-for="(player, index) in role.players"
                :class="{ dead: player.isDead }"
                :key="index"
              >
                <template v-if="!session.isSpectator">
                  <div class="option" @click="setResponded(player, role.id)">
                    {{ player.name }}
                    <font-awesome-icon
                      :icon="[
                        'fas',
                        !!player.hasResponded[role.id]
                          ? 'check-square'
                          : 'square',
                      ]"
                    />
                  </div>
                </template>
                <template v-if="session.isSpectator">{{
                  player.name + (role.players.length > index + 1 ? "," : "")
                }}</template>
              </small>
            </span>
          </span>
          <span
            class="icon"
            v-if="role.id"
            :style="{
              backgroundImage: `url(${getNightOrderImage(role)})`,
            }"
          ></span>
          <span
            class="reminder"
            v-if="role.firstNightReminder"
            v-html="formatNightReminder(role.firstNightReminder)"
          />
        </li>
      </ul>
      <ul class="other">
        <li class="headline">{{ $t("modals.nightOrder.otherNights") }}</li>
        <li
          v-for="role in rolesOtherNight"
          :key="role.name"
          :class="[role.team]"
        >
          <span
            class="icon"
            v-if="role.id"
            :style="{
              backgroundImage: `url(${getNightOrderImage(role)})`,
            }"
          ></span>
          <span class="name">
            {{ role.name }}
            <span class="player" v-if="role.players.length">
              <br />
              <small
                v-for="(player, index) in role.players"
                :class="{ dead: player.isDead }"
                :key="index"
              >
                <template v-if="!session.isSpectator">
                  <div class="option" @click="setResponded(player, role.id)">
                    <font-awesome-icon
                      :icon="[
                        'fas',
                        !!player.hasResponded[role.id]
                          ? 'check-square'
                          : 'square',
                      ]"
                    />
                    {{ player.name }}
                  </div>
                </template>
                <template v-if="session.isSpectator">{{
                  player.name + (role.players.length > index + 1 ? "," : "")
                }}</template>
              </small>
            </span>
          </span>
          <span
            class="reminder"
            v-if="role.otherNightReminder"
            v-html="formatNightReminder(role.otherNightReminder)"
          />
        </li>
      </ul>
    </div>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { nightOrder } from "../../nightOrder";
import { mapGetters, mapMutations, mapState } from "vuex";

export default {
  components: {
    Modal,
  },
  computed: {
    rolesFirstNight: function () {
      return nightOrder(true, this).map((role) => this.localizeRole(role));
    },
    rolesOtherNight: function () {
      return nightOrder(false, this).map((role) => this.localizeRole(role));
    },
    ...mapGetters([
      "getImage",
      "getFirstNightOrder",
      "getOtherNightOrder",
      "localizeRole",
    ]),
    ...mapState([
      "roles",
      "otherTravellers",
      "modals",
      "edition",
      "grimoire",
      "session",
      "npcs",
    ]),
    ...mapState("players", ["players"]),
  },
  methods: {
    getNightOrderImage(role) {
      if (
        role.id === "dusk" ||
        role.id === "dawn" ||
        role.id === "minioninfo" ||
        role.id === "demoninfo"
      ) {
        return require(`../../assets/${role.id}.webp`);
      }
      return this.getImage(role, 0);
    },
    formatNightReminder(text) {
      return text
        .replace(/\*(.*?)\*/g, "<b>$1</b>")
        .replace(/:reminder:/g, '<i class="reminder-token"></i>');
    },
    setResponded(player, roleId) {
      const hasResponded = { ...player.hasResponded };
      hasResponded[roleId] = !hasResponded[roleId];
      this.$store.commit("players/update", {
        player: player,
        property: "hasResponded",
        value: hasResponded,
      });
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style lang="scss" scoped>
@import "../../vars.scss";

.toggle {
  position: absolute;
  left: 20px;
  top: 15px;
  cursor: pointer;
  &:hover {
    color: red;
  }
}

@media (orientation: portrait) {
  .toggle {
    width: 20px;
    height: 15px;
  }
}

h3 {
  margin: 0 40px;
  svg {
    vertical-align: middle;
  }
  line-height: 90%;
}

h4 {
  text-transform: capitalize;
  display: flex;
  align-items: center;
  height: 20px;
  &:before,
  &:after {
    content: " ";
    width: 100%;
    height: 1px;
    border-radius: 2px;
  }
  &:before {
    margin-right: 15px;
  }
  &:after {
    margin-left: 15px;
  }
}

.storyteller small {
  display: block;
}

.fabled {
  .name {
    background: linear-gradient(90deg, $fabled, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $fabled, transparent 35%);
    }
  }
}
.loric {
  .name {
    background: linear-gradient(90deg, $loric, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $loric, transparent 35%);
    }
  }
}
.townsfolk {
  .name {
    background: linear-gradient(90deg, $townsfolk, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $townsfolk, transparent 35%);
    }
  }
}
.outsider {
  .name {
    background: linear-gradient(90deg, $outsider, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $outsider, transparent 35%);
    }
  }
}
.minion {
  .name {
    background: linear-gradient(90deg, $minion, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $minion, transparent 35%);
    }
  }
}
.demon {
  .name {
    background: linear-gradient(90deg, $demon, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $demon, transparent 35%);
    }
  }
}
ul {
  li {
    display: flex;
    width: 100%;
    margin-bottom: 3px;
    .icon {
      width: 5vh;
      background-size: 100%;
      background-position: 50%;
      background-repeat: no-repeat;
      flex-grow: 0;
      flex-shrink: 0;
      text-align: center;
      margin: -7px 2px -10px;
      &:after {
        content: " ";
        display: block;
        padding-top: 66%;
      }
    }
    .name {
      flex-grow: 0;
      flex-shrink: 0;
      width: 15%;
      text-align: right;
      font-size: 110%;
      padding: 5px;
      border-left: 1px solid rgba(255, 255, 255, 0.4);
      border-right: 1px solid rgba(255, 255, 255, 0.4);
      small {
        color: #888;
        margin-right: 5px;
        &.dead {
          text-decoration: line-through;
        }
      }
      @media (orientation: portrait) {
        font-size: 16px;
        line-height: 16px;
      }
    }
    .reminder {
      position: fixed;
      padding: 5px 10px;
      left: 50%;
      bottom: 0;
      width: 500px;
      z-index: 25;
      background: rgba(0, 0, 0, 0.75);
      border-radius: 10px;
      border: 3px solid black;
      filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
      text-align: left;
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms ease-in-out;
      margin-left: -250px;
      :deep(.reminder-token) {
        display: inline-block;
        vertical-align: middle;
        height: 20px;
        width: 20px;
        border: 1px solid black;
        border-radius: 50%;
        top: -2px;
        background: url("../../assets/reminder.webp") no-repeat 50%;
        background-size: 100%;
      }
    }
    &:hover .reminder {
      opacity: 1;
    }
  }
  &.legend {
    font-weight: bold;
    height: 20px;
    margin-top: 10px;
    li span {
      background: none;
      height: auto;
      font-family: inherit;
      font-size: inherit;
    }
    .icon:after {
      padding-top: 0;
    }
  }
}

.night {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  > *:first-child {
    margin-right: 2vh;
  }
  > * {
    flex-grow: 0;
    flex-wrap: nowrap;
    flex-direction: column;
  }
  .headline {
    display: block;
    font-weight: bold;
    border-bottom: 1px solid rgba(255, 255, 255, 0.4);
    padding: 5px 10px;
    border-radius: 0;
    text-align: center;

    @media (orientation: portrait) {
      font-size: 16px;
      line-height: 16px;
    }
  }
  .name {
    flex-grow: 1;
  }
  .first {
    .name {
      border-left: 0;
    }
  }
  .other {
    li .name {
      text-align: left;
      border-right: 0;
    }
  }
}

/** hide players when town square is set to "public" **/
#townsquare.public ~ .night-reference .modal .player {
  display: none;
}
</style>
