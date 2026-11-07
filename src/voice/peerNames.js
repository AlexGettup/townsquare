import { mapGetters, mapState } from "vuex";
import { STORYTELLER, isConversation } from "../store/modules/voice";

// colors telling private conversations apart (in the panel and on seats)
const CONVERSATION_COLORS = [
  "#ffb84d",
  "#ff6fb5",
  "#9b7bff",
  "#4dd2ff",
  "#b5e655",
  "#ff7a5c",
];
const ROOM_COLORS = {
  tavern: "#d9954a",
  church: "#efe6c2",
  graveyard: "#9fb3b8",
};

/**
 * Component mixin: display names and colors for voice chat participants and
 * places.
 */
export default {
  computed: {
    ...mapState("players", ["players"]),
    ...mapGetters("voice", ["selfPeerId", "conversations"]),
  },
  methods: {
    /** Color of a private conversation or fixed room (null for the plaza). */
    placeColor(location) {
      if (ROOM_COLORS[location]) return ROOM_COLORS[location];
      if (!isConversation(location)) return null;
      const index = this.conversations.findIndex(
        (conversation) => conversation.location === location,
      );
      return CONVERSATION_COLORS[
        Math.max(index, 0) % CONVERSATION_COLORS.length
      ];
    },
    /** Name of a place: "Plaza", "Taberna"… or the people talking. */
    placeName(location) {
      if (isConversation(location)) {
        const conversation = this.conversations.find(
          (conversation) => conversation.location === location,
        );
        return conversation
          ? [...conversation.members]
              .sort(this.bySeat)
              .map(this.peerName)
              .join(", ")
          : "";
      }
      return this.$t(`voice.places.${location}`);
    },
    /** "Narrador", the name of the claimed seat, or "Espectador". */
    peerName(peerId) {
      if (peerId === STORYTELLER) return this.$t("voice.storyteller");
      const player = this.players.find((player) => player.id === peerId);
      return player ? player.name : this.$t("voice.spectator");
    },
    /** Same as peerName, adding "(tú)" for ourselves. */
    peerLabel(peerId) {
      const name = this.peerName(peerId);
      return peerId === this.selfPeerId
        ? `${name} (${this.$t("voice.you")})`
        : name;
    },
    /** Sort peers: storyteller first, then players in seat order. */
    bySeat(a, b) {
      const order = (peerId) => {
        if (peerId === STORYTELLER) return -1;
        const seat = this.players.findIndex((player) => player.id === peerId);
        return seat === -1 ? this.players.length : seat;
      };
      return order(a) - order(b);
    },
  },
};
