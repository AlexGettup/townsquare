<template>
  <div class="info-card">
    <!-- one block per line: the token, then what goes with it -->
    <div class="part" v-for="(part, index) in parts" :key="index">
      <!-- the info token, in its colour -->
      <div
        class="info-token"
        v-if="part.phrase"
        :style="{ '--card-color': lookOf(part.phrase).color }"
      >
        <font-awesome-icon :icon="lookOf(part.phrase).icon" />
        <h2>{{ $t(`cards.phrases.${tokenOf(part.phrase)}`) }}</h2>
      </div>
      <!-- "Make a choice": what to choose -->
      <p
        class="choice"
        v-if="part.phrase && tokenOf(part.phrase) !== part.phrase"
      >
        {{ $t(`cards.phrases.${part.phrase}`) }}
      </p>
      <ul class="roles" v-if="part.roles.length">
        <li v-for="(role, i) in rolesOf(part)" :key="i" :class="role.team">
          <Token :role="role" />
        </li>
      </ul>
      <ul class="players" v-if="part.players.length">
        <li v-for="(name, i) in part.players" :key="i">{{ name }}</li>
      </ul>
      <div class="number" v-if="part.number !== null">
        {{ part.number }}
      </div>
      <div class="answer" v-if="part.answer" :class="part.answer">
        {{ $t(`cards.${part.answer}`) }}
      </div>
    </div>
    <p class="text" v-if="card.text">{{ card.text }}</p>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import Token from "./Token";
import { lookOf, partsOf, tokenOf } from "../cards";

/**
 * An info card from the storyteller: what a player learns at night. One or
 * more lines (see cards.js), each a token with characters, players, a number
 * or yes/no, and free text at the end.
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
    parts: function () {
      return partsOf(this.card);
    },
    ...mapState({ scriptRoles: "roles", otherTravellers: "otherTravellers" }),
    ...mapGetters(["rolesJSONbyId"]),
  },
  methods: {
    lookOf,
    tokenOf,
    rolesOf: function (part) {
      return part.roles.map(
        (id) =>
          this.scriptRoles.get(id) ||
          this.rolesJSONbyId.get(id) ||
          this.otherTravellers.get(id) || { id, name: id },
      );
    },
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

.part {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  // a gap between lines, so each token reads with its own content
  & + .part {
    margin-top: 10px;
  }
}

.info-token {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  // the same width for every line's token, as far as the window allows
  width: 300px;
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

// the browser's list indent pushed tokens and names off centre
.roles,
.players {
  margin: 0;
  padding: 0;
  list-style: none;
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
