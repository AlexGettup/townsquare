/**
 * Component mixin for menus: a click or tap outside closes them.
 * - isOpen: path of the property saying whether the menu is open
 * - inside(): the elements that count as part of the menu (the bottom panel on
 *   touch screens lives outside the component's own element)
 * - close(): closes the menu
 *
 * It listens before anything else reacts to the click, which also goes on to do
 * its job: a click on a player closes this menu and opens that player's.
 */
export default ({ isOpen, inside, close }) => ({
  watch: {
    [isOpen]: {
      immediate: true,
      handler(open) {
        if (open) {
          document.addEventListener("click", this.onOutsideClick, true);
        } else {
          document.removeEventListener("click", this.onOutsideClick, true);
        }
      },
    },
  },
  beforeDestroy() {
    document.removeEventListener("click", this.onOutsideClick, true);
  },
  methods: {
    onOutsideClick({ target }) {
      const elements = inside.call(this);
      if (!elements.some((element) => element && element.contains(target))) {
        close.call(this);
      }
    },
  },
});
