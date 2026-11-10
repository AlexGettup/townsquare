<template>
  <div class="info-card">
    <!-- the info token, in its colour -->
    <div
      class="token"
      v-if="card.phrase"
      :style="{ '--card-color': look.color }"
    >
      <font-awesome-icon :icon="look.icon" />
      <h2>{{ $t(`cards.phrases.${token}`) }}</h2>
    </div>
    <!-- "Make a choice": what to choose -->
    <p class="choice" v-if="token !== card.phrase">
      {{ $t(`cards.phrases.${card.phrase}`) }}
    </p>
    <p class="text" v-if="card.text">{{ card.text }}</p>
    <ul class="roles" v-if="roles.length">
      <li v-for="(role, index) in roles" :key="index" :class="role.team">
        <Token :role="role" />
      </li>
    </ul>
    <ul class="players" v-if="card.players && card.players.length">
      <li v-for="(name, index) in card.players" :key="index">{{ name }}</li>
    </ul>
    <div
      class="number"
      v-if="card.number !== null && card.number !== undefined"
    >
      {{ card.number }}
    </div>
    <div class="answer" v-if="card.answer" :class="card.answer">
      {{ $t(`cards.${card.answer}`) }}
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import Token from "./Token";
import { lookOf, tokenOf } from "../cards";

/**
 * An info card from the storyteller: what a player learns at night.
 * card: { phrase, text, roles: [roleId], players: [name], number, answer }
 */
export default {
  components: { Token },
  props: {
    card: {
      type: Object,
      required: true,
    },
  },
  computed: {
    token: function () {
      return tokenOf(this.card.phrase);
    },
    look: function () {
      return lookOf(this.card.phrase);
    },
    roles: function () {
      return (this.card.roles || []).map(
        (id) =>
          this.scriptRoles.get(id) ||
          this.rolesJSONbyId.get(id) ||
          this.otherTravellers.get(id) || { id, name: id },
      );
    },
    ...mapState({ scriptRoles: "roles", otherTravellers: "otherTravellers" }),
    ...mapGetters(["rolesJSONbyId"]),
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.info-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  // never wider than the window it is shown in (phones)
  min-width: min(320px, 100%);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.token {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 14px 24px 12px;
  border: 3px solid black;
  border-radius: 10px;
  background: linear-gradient(
    to bottom,
    var(--card-color) 0%,
    rgba(0, 0, 0, 0.55) 100%
  );
  box-shadow: 0 0 14px var(--card-color);

  svg {
    font-size: 40px;
  }
}

h2 {
  margin: 0;
  font-size: 160%;
  line-height: 1.2;
}

.choice {
  margin: 0;
  font-size: 120%;
  font-weight: bold;
}

.text {
  margin: 0;
  font-size: 110%;
  white-space: pre-wrap;
  user-select: text;
}

.roles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  li {
    width: 110px;
    max-width: 26vw;
    border-radius: 50%;
    &.townsfolk {
      box-shadow: 0 0 10px $townsfolk;
    }
    &.outsider {
      box-shadow: 0 0 10px $outsider;
    }
    &.minion {
      box-shadow: 0 0 10px $minion;
    }
    &.demon {
      box-shadow: 0 0 10px $demon;
    }
    &.traveller {
      box-shadow: 0 0 10px $traveller;
    }
  }
}

.players {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  li {
    padding: 4px 14px;
    border: 3px solid black;
    border-radius: 15px;
    background: rgba(255, 255, 255, 0.15);
    font-size: 120%;
  }
}

.number {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 3px solid black;
  background: radial-gradient(rgba(255, 255, 255, 0.2), rgba(0, 0, 0, 0.6));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 300%;
  font-weight: bold;
}

.answer {
  font-family: PiratesBay, sans-serif;
  font-size: 300%;
  letter-spacing: 2px;
  &.yes {
    color: $townsfolk;
  }
  &.no {
    color: $demon;
  }
}
</style>
