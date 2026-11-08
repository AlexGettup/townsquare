<template>
  <div class="bottom-sheet"><slot /></div>
</template>

<script>
/**
 * Panel at the bottom of the screen for touch screens (the player menu).
 * Its element moves to <body>: the seats are rotated around the circle, and a
 * fixed element inside a transformed one would not stick to the screen.
 */
export default {
  mounted() {
    document.body.appendChild(this.$el);
  },
  beforeDestroy() {
    if (this.$el.parentNode) this.$el.parentNode.removeChild(this.$el);
  },
};
</script>

<style lang="scss">
@import "../vars.scss";

.bottom-sheet > .menu {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  max-width: 480px;
  max-height: 70vh;
  margin: 0 auto;
  padding: 4px 12px calc(8px + env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 0 20px black;
  font-size: 18px;
  line-height: 1.2;
  text-align: left;
  white-space: normal;
  animation: bottom-sheet-in 150ms ease-out;

  // right after the first tap, a second one may still come (double tap on the
  // token): don't let it press a button that just appeared under the finger
  &.arming {
    pointer-events: none;
  }

  li {
    display: flex;
    align-items: center;
    min-height: 48px;
    padding: 0 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;

    &:last-child {
      border-bottom: 0;
    }

    > svg:first-child {
      width: 1.4em;
      margin-right: 12px;
      flex-shrink: 0;
    }

    &.disabled {
      opacity: 0.5;
    }

    &.danger {
      color: $demon;
    }

    &.back {
      color: gray;
    }

    .submenu {
      margin-left: auto;
    }

    &.sheet-header {
      cursor: default;
      color: gray;
      font-size: 90%;
      min-height: 40px;

      strong {
        color: white;
        margin-right: 6px;
      }

      .close {
        margin-left: auto;
        padding: 8px;
        cursor: pointer;
        color: white;
      }
    }
  }
}

@keyframes bottom-sheet-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>
