<template>
  <div class="token" @click="setRole" :class="[role.id]">
    <span
      class="icon"
      v-if="role.id"
      :style="{
        backgroundImage: `url(${getImage(role, alignmentIndex)})`,
      }"
    ></span>
    <span
      class="leaf-left"
      v-if="role.firstNight || role.firstNightReminder"
    ></span>
    <span
      class="leaf-right"
      v-if="role.otherNight || role.otherNightReminder"
    ></span>
    <span v-if="reminderLeaves" :class="['leaf-top' + reminderLeaves]"></span>
    <span class="leaf-orange" v-if="role.setup"></span>
    <svg viewBox="0 0 150 150" class="name">
      <path
        d="M 13 75 C 13 160, 138 160, 138 75"
        :id="curveId"
        fill="transparent"
      />
      <text
        width="150"
        x="66.6%"
        text-anchor="middle"
        class="label mozilla"
        :font-size="displayRole.name | nameToFontSize"
      >
        <textPath :xlink:href="'#' + curveId">
          {{ displayRole.name }}
        </textPath>
      </text>
    </svg>
    <div class="edition" :class="[`edition-${role.edition}`, role.team]"></div>
    <div class="ability" v-if="displayRole.ability">
      {{ displayRole.ability }}
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";

export default {
  name: "Token",
  props: {
    role: {
      type: Object,
      default: () => ({}),
    },
    alignmentIndex: {
      type: Number,
      default: 0,
    },
  },
  computed: {
    // each token curves its name along its own path: pointing every token
    // at the first one makes Firefox redraw the names while a seat glows
    curveId: function () {
      return "curve-" + this._uid;
    },
    // role with name and ability in the chosen language
    displayRole: function () {
      return this.localizeRole(this.role);
    },
    reminderLeaves: function () {
      return (
        (this.role.reminders || []).length +
        (this.role.remindersGlobal || []).length
      );
    },
    ...mapGetters(["getImage", "localizeRole"]),
    ...mapState(["grimoire"]),
  },
  data() {
    return {};
  },
  filters: {
    // names longer than 16 characters (common in translations) shrink
    // proportionally so they still fit on the token's arc
    nameToFontSize: (name) => {
      const length = (name && name.length) || 0;
      if (length <= 10) return "110%";
      if (length <= 16) return "90%";
      return Math.floor((90 * 16) / length) + "%";
    },
  },
  methods: {
    setRole() {
      this.$emit("set-role");
    },
  },
};
</script>

<style scoped lang="scss">
.token {
  border-radius: 50%;
  width: 100%;
  background: url("../assets/token.webp") center center;
  background-size: 100%;
  text-align: center;
  border: 3px solid black;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 250ms;

  &:hover .name .label {
    stroke: black;
    fill: white;
    @-moz-document url-prefix() {
      &.mozilla {
        stroke: none;
        filter: drop-shadow(0 1.5px 0 black) drop-shadow(0 -1.5px 0 black)
          drop-shadow(1.5px 0 0 black) drop-shadow(-1.5px 0 0 black)
          drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
      }
    }
  }

  .icon,
  &:before {
    background-size: 100%;
    background-repeat: no-repeat;
    background-position: center 30%;
    position: absolute;
    width: 100%;
    height: 100%;
    margin-bottom: 9%;
  }

  span {
    position: absolute;
    width: 100%;
    height: 100%;
    background-size: 100%;
    pointer-events: none;

    &.leaf-left {
      background-image: url("../assets/leaf-left.webp");
    }

    &.leaf-orange {
      background-image: url("../assets/leaf-orange.webp");
    }

    &.leaf-right {
      background-image: url("../assets/leaf-right.webp");
    }

    &.leaf-top1 {
      background-image: url("../assets/leaf-top1.webp");
    }

    &.leaf-top2 {
      background-image: url("../assets/leaf-top2.webp");
    }

    &.leaf-top3 {
      background-image: url("../assets/leaf-top3.webp");
    }

    &.leaf-top4 {
      background-image: url("../assets/leaf-top4.webp");
    }

    &.leaf-top5 {
      background-image: url("../assets/leaf-top5.webp");
    }

    &.leaf-top6 {
      background-image: url("../assets/leaf-top6.webp");
    }

    &.leaf-top7 {
      background-image: url("../assets/leaf-top7.webp");
    }
  }

  .name {
    width: 100%;
    height: 100%;
    font-size: 24px; // svg fonts are relative to document font size
    .label {
      fill: black;
      stroke: white;
      stroke-width: 2px;
      paint-order: stroke;
      font-family: "Papyrus", serif;
      font-weight: bold;
      text-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
      letter-spacing: 1px;

      @-moz-document url-prefix() {
        &.mozilla {
          // Vue doesn't support scoped media queries, so we have to use a second css class
          stroke: none;
          text-shadow: none;
          filter: drop-shadow(0 1.5px 0 white) drop-shadow(0 -1.5px 0 white)
            drop-shadow(1.5px 0 0 white) drop-shadow(-1.5px 0 0 white)
            drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
        }
      }
    }
  }

  .edition {
    position: absolute;
    right: 0;
    bottom: 5px;
    width: 30px;
    height: 30px;
    background-size: 100%;
    display: none;
  }

  .ability {
    display: flex;
    position: absolute;
    padding: 5px 10px;
    left: 120%;
    width: 250px;
    z-index: 25;
    font-size: 80%;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    border: 3px solid black;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
    text-align: left;
    justify-items: center;
    align-content: center;
    align-items: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease-in-out;

    &:before {
      content: " ";
      border: 10px solid transparent;
      width: 0;
      height: 0;
      border-right-color: black;
      position: absolute;
      margin-right: 2px;
      right: 100%;
    }
  }

  &:hover .ability {
    opacity: 1;
  }
}
</style>
