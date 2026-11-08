<template>
  <div
    class="conversations"
    v-if="isConnected && !grimoire.isNight"
    :class="{ closed: !isOpen }"
  >
    <h3>
      <span>{{ $t("voice.conversations") }}</span>
      <font-awesome-icon icon="times-circle" @click.stop="isOpen = false" />
      <font-awesome-icon icon="plus-circle" @click.stop="isOpen = true" />
    </h3>
    <ul>
      <!-- private conversations: everyone sees who talks with whom -->
      <li
        v-for="conversation in conversations"
        :key="conversation.location"
        class="place"
        :class="{ mine: conversation.location === voice.location }"
        :style="{ borderColor: placeColor(conversation.location) }"
      >
        <font-awesome-icon
          icon="comments"
          class="place-icon"
          :style="{ color: placeColor(conversation.location) }"
        />
        <span class="members">{{ placeName(conversation.location) }}</span>
        <span class="actions">
          <template v-if="conversation.location === voice.location">
            <a @click="moveTo('plaza')">{{ $t("voice.leaveConversation") }}</a>
          </template>
          <template v-else-if="isStoryteller">
            <a @click="moveTo(conversation.location)">{{
              $t("voice.enter")
            }}</a>
          </template>
          <template v-else-if="voice.requesting === conversation.location">
            <small>{{ $t("voice.requested") }}</small>
            <a @click="cancelRequest">{{ $t("voice.cancel") }}</a>
          </template>
          <template v-else>
            <a @click="requestToJoin(conversation.location)">{{
              $t("voice.askToJoin")
            }}</a>
          </template>
        </span>
      </li>
      <li v-if="!conversations.length" class="empty">
        <small>{{ $t("voice.noConversations") }}</small>
      </li>

      <!-- open rooms, anyone can walk in -->
      <li
        v-for="room in rooms"
        :key="room.location"
        class="place room"
        :class="{ mine: room.location === voice.location }"
      >
        <font-awesome-icon
          :icon="room.icon"
          class="place-icon"
          :style="{ color: placeColor(room.location) }"
        />
        <span class="members">
          <b>{{ $t(`voice.places.${room.location}`) }}</b>
          <template v-if="room.members.length">
            · {{ room.members.map(peerName).join(", ") }}
          </template>
        </span>
        <span class="actions">
          <a v-if="room.location === voice.location" @click="moveTo('plaza')">
            {{ $t("voice.leaveConversation") }}
          </a>
          <a v-else @click="moveTo(room.location)">{{ $t("voice.enter") }}</a>
        </span>
      </li>

      <li class="hint">
        <small>{{ $t("voice.inviteHint") }}</small>
      </li>
    </ul>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import peerNames from "../voice/peerNames";
import { FIXED_ROOMS } from "../store/modules/voice";

const ROOM_ICONS = {
  tavern: "beer",
  church: "church",
  graveyard: "cross",
};

/**
 * Left panel during the day: private conversations (who talks with whom)
 * and the open rooms, with the actions to join or leave them.
 */
export default {
  mixins: [peerNames],
  data() {
    return {
      isOpen: true,
    };
  },
  computed: {
    rooms: function () {
      return FIXED_ROOMS.map((location) => ({
        location,
        icon: ROOM_ICONS[location],
        members: [...(this.places[location] || [])].sort(this.bySeat),
      }));
    },
    ...mapState(["voice", "grimoire"]),
    ...mapGetters("voice", ["isConnected", "isStoryteller", "places"]),
  },
  methods: {
    moveTo(location) {
      this.$store.dispatch("voice/moveTo", location);
    },
    requestToJoin(location) {
      this.$store.dispatch("voice/requestToJoin", location);
    },
    cancelRequest() {
      this.$store.dispatch("voice/cancelRequest");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

// same look as the demon bluffs / NPC panels; placed below the voice
// button by VoiceCorner
.conversations {
  z-index: 1;
  width: 260px;
  max-width: 40vw;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  border: 3px solid black;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
  transition: all 200ms ease-in-out;

  h3 {
    margin: 5px 1vh 0;
    display: flex;
    align-items: center;
    font-size: 110%;
    span {
      flex-grow: 1;
    }
    svg {
      cursor: pointer;
      margin-left: 6px;
      &:hover {
        color: red;
      }
    }
    .fa-plus-circle {
      display: none;
    }
  }

  &.closed {
    width: auto;
    ul {
      display: none;
    }
    .fa-times-circle {
      display: none;
    }
    .fa-plus-circle {
      display: inline-block;
    }
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 5px;
  }

  li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    margin-bottom: 4px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);

    &.place {
      border-left: 4px solid transparent;
    }
    &.room {
      border-left-color: rgba(255, 255, 255, 0.2);
    }
    &.mine {
      background: rgba(255, 255, 255, 0.15);
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
    }
    &.empty,
    &.hint {
      color: gray;
      background: none;
    }
  }

  .place-icon {
    flex-shrink: 0;
  }

  .members {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions {
    flex-shrink: 0;
    font-size: 85%;
    display: flex;
    gap: 6px;
    align-items: center;
    a {
      cursor: pointer;
      color: $outsider;
      &:hover {
        color: red;
      }
    }
    small {
      color: gray;
    }
  }
}
</style>
