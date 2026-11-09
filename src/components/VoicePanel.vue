<template>
  <div class="voice-panel">
    <span
      class="toggle"
      :class="[
        'status-' + voice.status,
        { muted: voice.muted, speaking: !!voice.speaking[selfPeerId] },
      ]"
      @click="toggle"
      :title="$t('voice.title')"
    >
      <font-awesome-icon :icon="icon" />
    </span>

    <!-- touch screens: who talks in private, with the panel closed -->
    <ul class="private-now" v-if="showPrivateNow" @click="isOpen = true">
      <li
        v-for="{ location } in conversations"
        :key="location"
        :class="{ mine: location === voice.location }"
        :style="{ borderLeftColor: placeColor(location) }"
      >
        <font-awesome-icon
          icon="comments"
          :style="{ color: placeColor(location) }"
        />
        <span>{{ placeName(location) }}</span>
      </li>
    </ul>

    <component :is="isTouch ? 'BottomSheet' : 'div'" v-if="isOpen">
      <ul class="menu" ref="menu" :class="{ floating: !isTouch }">
        <li class="sheet-header" v-if="isTouch">
          <strong>{{ $t("voice.title") }}</strong>
          <span class="close" @click="isOpen = false">
            <font-awesome-icon icon="times-circle" />
          </span>
        </li>
        <li class="headline" v-else>{{ $t("voice.title") }}</li>

        <template v-if="!isConnected">
          <li class="error" v-if="voice.status === 'error'">
            <small>{{ errorMessage }}</small>
          </li>
          <li v-if="voice.status === 'connecting'" class="disabled">
            {{ $t("voice.connecting") }}
          </li>
          <li v-else class="action" @click="join">
            {{ $t("voice.join") }}
            <em><font-awesome-icon icon="headset" /></em>
          </li>
        </template>

        <template v-else>
          <!-- our own controls -->
          <li class="action" @click="toggleMute">
            {{ $t("voice.muteMicrophone") }}
            <em>
              <template v-if="!isTouch">[M]</template>
              <font-awesome-icon
                :icon="['fas', voice.muted ? 'check-square' : 'square']"
              />
            </em>
          </li>
          <li class="action" @click="leave">
            {{ $t("voice.leave") }}
            <em><font-awesome-icon icon="sign-out-alt" /></em>
          </li>

          <!-- Night: one list, where the storyteller wakes people up -->
          <template v-if="grimoire.isNight">
            <li class="headline">{{ $t("voice.night") }}</li>
            <template v-if="isStoryteller">
              <li class="action" @click="toggleBroadcast">
                {{ $t("voice.broadcast") }}
                <em>
                  <font-awesome-icon
                    :icon="['fas', voice.broadcast ? 'check-square' : 'square']"
                  />
                </em>
              </li>
              <li class="hint">
                <small>{{ $t("voice.wakeHint") }}</small>
              </li>
            </template>
            <li v-else class="night-status" :class="{ awake: canHearHost }">
              <font-awesome-icon :icon="nightStatus.icon" />
              <small>{{ $t(nightStatus.key) }}</small>
            </li>
            <template v-for="person in everyone">
              <li
                :key="person.peerId"
                class="person"
                :class="[
                  personClass(person),
                  { hasOptions: hasOptions(person) },
                ]"
                :title="wakeTitle(person)"
                @click="onNightTap(person)"
              >
                <span class="name">
                  <font-awesome-icon
                    v-if="canWake(person)"
                    :icon="person.awake ? 'eye' : 'bed'"
                    class="night-state"
                  />
                  {{ person.name }}
                </span>
                <em
                  :class="{ mutable: canMute(person) }"
                  :title="canMute(person) ? $t('voice.mutePlayer') : ''"
                  @click.stop="mute(person)"
                >
                  <font-awesome-icon
                    :icon="person.muted ? 'microphone-slash' : 'microphone'"
                  />
                </em>
              </li>
              <VoiceVolume
                v-if="optionsFor === person.peerId && hasOptions(person)"
                :key="person.peerId + '-volume'"
                :peer-id="person.peerId"
              />
            </template>
          </template>

          <!-- Day: the places, each with the people in it -->
          <template v-else>
            <li class="action" v-if="isStoryteller" @click="gather">
              {{ $t("voice.gather") }}
              <em><font-awesome-icon icon="bell" /></em>
            </li>
            <template v-for="place in dayPlaces">
              <li
                :key="place.location"
                class="place"
                :class="{ mine: place.location === voice.location }"
                :style="{ borderLeftColor: place.color }"
              >
                <span class="place-name">
                  <font-awesome-icon
                    :icon="place.icon"
                    :style="{ color: place.color }"
                  />
                  {{ place.name }}
                </span>
                <span class="actions">
                  <template v-if="place.location === voice.location">
                    <a
                      v-if="place.location !== 'plaza'"
                      @click="moveTo('plaza')"
                    >
                      {{ $t("voice.leaveConversation") }}
                    </a>
                  </template>
                  <a
                    v-else-if="!place.isPrivate || isStoryteller"
                    @click="moveTo(place.location)"
                  >
                    {{ $t("voice.enter") }}
                  </a>
                  <template v-else-if="voice.requesting === place.location">
                    <small>{{ $t("voice.requested") }}</small>
                    <a @click="cancelRequest">{{ $t("voice.cancel") }}</a>
                  </template>
                  <a v-else @click="requestToJoin(place.location)">
                    {{ $t("voice.askToJoin") }}
                  </a>
                </span>
              </li>
              <template v-for="person in place.people">
                <li
                  :key="place.location + person.peerId"
                  class="person in-place"
                  :class="[
                    personClass(person),
                    { hasOptions: hasOptions(person) },
                  ]"
                  @click="toggleOptions(person)"
                >
                  <span class="name">{{ person.name }}</span>
                  <em
                    :class="{ mutable: canMute(person) }"
                    :title="canMute(person) ? $t('voice.mutePlayer') : ''"
                    @click.stop="mute(person)"
                  >
                    <font-awesome-icon
                      :icon="person.muted ? 'microphone-slash' : 'microphone'"
                    />
                  </em>
                </li>
                <!-- the options of the person tapped -->
                <VoiceVolume
                  v-if="optionsFor === person.peerId && hasOptions(person)"
                  :key="place.location + person.peerId + '-volume'"
                  :peer-id="person.peerId"
                />
                <li
                  v-if="optionsFor === person.peerId && canInvite(person)"
                  :key="place.location + person.peerId + '-invite'"
                  class="action option"
                  @click="invite(person)"
                >
                  <span>
                    <font-awesome-icon icon="user-plus" />
                    {{ $t("voice.invite") }}
                  </span>
                </li>
              </template>
            </template>
            <li class="hint">
              <small>{{ $t("voice.inviteHint") }}</small>
            </li>
          </template>
        </template>
      </ul>
    </component>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import BottomSheet from "./BottomSheet";
import VoiceVolume from "./VoiceVolume";
import peerNames from "../voice/peerNames";
import { isTouchScreen } from "../touch";
import closeOnOutsideClick from "../closeOnOutsideClick";
import {
  FIXED_ROOMS,
  PLAZA,
  STORYTELLER,
  isConversation,
} from "../store/modules/voice";

const ROOM_ICONS = {
  tavern: "beer",
  church: "church",
  graveyard: "cross",
};

/**
 * Everything about voice chat, in one panel below the voice button: your own
 * controls and, below, the places with the people in each one. At night, one
 * list where the storyteller wakes people up and puts them back to sleep.
 * Below the button on computers, the bottom panel on touch screens.
 */
export default {
  components: { BottomSheet, VoiceVolume },
  mixins: [
    peerNames,
    closeOnOutsideClick({
      isOpen: "isOpen",
      inside() {
        return [this.$el, this.$refs.menu];
      },
      // on a computer it stays open beside the game; on a touch screen it
      // would cover the game
      close() {
        if (this.isTouch) this.isOpen = false;
      },
    }),
  ],
  data() {
    return {
      isOpen: false,
      isTouch: isTouchScreen(),
      // the person whose options are showing
      optionsFor: null,
    };
  },
  computed: {
    icon: function () {
      if (!this.isConnected) return "headset";
      return this.voice.muted ? "microphone-slash" : "microphone";
    },
    errorMessage: function () {
      const key = `voice.errors.${this.voice.error}`;
      return this.$te(key) ? this.$t(key) : this.$t("voice.errors.generic");
    },
    showPrivateNow: function () {
      return (
        this.isTouch &&
        this.isConnected &&
        !this.grimoire.isNight &&
        this.conversations.length > 0
      );
    },
    canHearHost: function () {
      return this.canHear(STORYTELLER);
    },
    nightStatus: function () {
      if (this.night.broadcast) {
        return { icon: "bullhorn", key: "voice.storytellerBroadcasting" };
      }
      return this.canHearHost
        ? { icon: "eye", key: "voice.youAreAwake" }
        : { icon: "bed", key: "voice.youAreAsleep" };
    },
    everyone: function () {
      return this.peopleIn(Object.values(this.places).flat());
    },
    dayPlaces: function () {
      const place = (location, icon, extra = {}) => ({
        location,
        icon,
        color: this.placeColor(location),
        name: this.$t(`voice.places.${location}`),
        people: this.peopleIn(this.places[location] || []),
        ...extra,
      });
      return [
        place(PLAZA, "users"),
        ...this.conversations.map(({ location, members }) => ({
          location,
          icon: "comments",
          color: this.placeColor(location),
          name: this.$t("chat.privateConversation"),
          people: this.peopleIn(members),
          isPrivate: true,
        })),
        ...FIXED_ROOMS.map((location) => place(location, ROOM_ICONS[location])),
      ];
    },
    ...mapState(["voice", "grimoire"]),
    ...mapGetters("voice", [
      "isConnected",
      "isStoryteller",
      "isAwake",
      "night",
      "canHear",
      "showSpeaking",
      "places",
    ]),
  },
  methods: {
    /** The people given, in seat order, with what the list shows of each. */
    peopleIn(peerIds) {
      return [...peerIds].sort(this.bySeat).map((peerId) => {
        const isSelf = peerId === this.selfPeerId;
        return {
          peerId,
          isSelf,
          name: this.peerLabel(peerId),
          muted: isSelf ? this.voice.muted : this.voice.peers[peerId].muted,
          awake: !isSelf && this.isAwake(peerId),
          // at night players don't see who is talking unless they hear them
          speaking: !!this.voice.speaking[peerId] && this.showSpeaking(peerId),
        };
      });
    },
    personClass({ speaking, muted, awake, ...person }) {
      return { speaking, muted, awake, wakeable: this.canWake(person) };
    },
    toggle() {
      this.isOpen = !this.isOpen;
    },
    join() {
      this.$store.dispatch("voice/join");
    },
    leave() {
      this.$store.dispatch("voice/leave");
    },
    toggleMute() {
      this.$store.dispatch("voice/toggleMute");
    },
    canMute({ isSelf, muted }) {
      return this.isStoryteller && !isSelf && !muted;
    },
    mute(person) {
      if (this.canMute(person)) {
        this.$store.dispatch("voice/mutePeer", person.peerId);
      }
    },
    // storyteller at night: wake players up / put them back to sleep
    canWake({ isSelf, peerId }) {
      return (
        this.isStoryteller &&
        this.grimoire.isNight &&
        !isSelf &&
        peerId !== STORYTELLER
      );
    },
    wake(person) {
      if (this.canWake(person)) {
        this.$store.dispatch("voice/toggleAwake", person.peerId);
      }
    },
    wakeTitle(person) {
      if (!this.canWake(person)) return "";
      return person.awake
        ? this.$t("voice.putToSleep")
        : this.$t("voice.wakeUp");
    },
    toggleBroadcast() {
      this.$store.dispatch("voice/toggleBroadcast");
    },
    gather() {
      this.$store.dispatch("voice/gather", { sound: true });
    },
    // day: anyone but ourselves and whoever already is in our conversation
    canInvite({ isSelf, peerId }) {
      if (isSelf) return false;
      return !(
        isConversation(this.voice.location) &&
        this.locationOf(peerId) === this.voice.location
      );
    },
    locationOf(peerId) {
      return this.$store.getters["voice/locationOf"](peerId);
    },
    // tapping a name opens its options: the volume of anyone but ourselves. At
    // night, the storyteller's tap wakes people up instead
    hasOptions(person) {
      return !person.isSelf && !this.canWake(person);
    },
    toggleOptions(person) {
      if (!this.hasOptions(person)) return;
      this.optionsFor =
        this.optionsFor === person.peerId ? null : person.peerId;
    },
    onNightTap(person) {
      if (this.canWake(person)) this.wake(person);
      else this.toggleOptions(person);
    },
    invite({ peerId }) {
      this.optionsFor = null;
      this.$store.dispatch("voice/invite", peerId);
    },
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
  watch: {
    // on a computer it opens beside the game; on a touch screen only when asked
    isConnected(isConnected) {
      if (isConnected && !this.isTouch) this.isOpen = true;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.voice-panel {
  position: relative;
  text-align: left;
}

// boxed like the options cog
.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 40px;
  height: 40px;
  font-size: 20px;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.5);
  border: 3px solid black;
  border-radius: 10px;
  transition:
    color 250ms,
    box-shadow 250ms;

  svg {
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
  }

  &:hover {
    color: red;
  }
  &.status-connecting {
    animation: blink 1s infinite;
  }
  &.status-connected {
    color: $voice-speaking;
    &.muted {
      color: $demon;
    }
    &.speaking {
      box-shadow: 0 0 10px 3px $voice-speaking;
    }
  }
  &.status-error {
    color: $demon;
  }
}

@keyframes blink {
  50% {
    opacity: 0.5;
    color: gray;
  }
}

// small, in the corner: it must leave the seats alone
.private-now {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: max-content;
  max-width: 42vw;
  margin: 3px 0 0;
  padding: 0;
  list-style-type: none;
  font-size: 12px;
  line-height: 1.3;

  li {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    box-sizing: border-box;
    padding: 2px 5px;
    background: rgba(0, 0, 0, 0.7);
    border-left: 3px solid transparent;
    border-radius: 4px;

    &.mine {
      background: rgba(255, 255, 255, 0.2);
      font-weight: bold;
    }
    svg {
      flex-shrink: 0;
    }
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

// on computers: a side panel below the button, scrolling if it doesn't fit
.menu.floating {
  width: 280px;
  max-width: calc(100vw - 20px);
  max-height: calc(100vh - 60px);
  margin: 3px 0 0;
  padding: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  list-style-type: none;
  box-shadow: 0 0 10px black;
  border: 3px solid black;
  border-radius: 0 10px 10px 10px;

  li {
    min-height: 30px;
    padding: 2px 6px;
    // other panels can sit below it: they must not show through
    background: rgba(0, 0, 0, 0.92);
    // the mute button's larger tap area must not make the panel scroll
    overflow: hidden;
    box-sizing: border-box;
  }
}

.menu li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: white;

  &.action:hover,
  &.wakeable:hover,
  &.hasOptions:hover {
    cursor: pointer;
    color: red;
  }

  &.disabled,
  &.hint {
    color: gray;
    cursor: default;
  }

  &.error {
    color: $demon;
  }

  &.night-status {
    justify-content: flex-start;
    gap: 8px;
    color: gray;
    cursor: default;
    &.awake {
      color: white;
    }
  }

  em {
    flex-shrink: 0;
    font-style: normal;
    font-size: 80%;
  }

  &.place {
    margin-top: 2px;
    border-left: 4px solid rgba(255, 255, 255, 0.2);
    font-weight: bold;
    cursor: default;

    &.mine {
      background: rgba(255, 255, 255, 0.15);
    }
  }

  .place-name {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    font-size: 85%;
    font-weight: normal;

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

  &.person {
    cursor: default;

    &.in-place {
      padding-left: 20px;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    &.speaking {
      .name {
        color: $voice-speaking;
      }
      em {
        color: $voice-speaking;
        filter: drop-shadow(0 0 4px $voice-speaking);
      }
    }
    &.muted em {
      color: $demon;
    }
    em.mutable {
      // easy to hit with a finger
      padding: 6px;
      margin: -6px;
      &:hover {
        cursor: pointer;
        color: red;
      }
    }
    .night-state {
      margin-right: 4px;
      opacity: 0.5;
    }
    &.awake .night-state {
      opacity: 1;
      color: $fabled;
    }
  }

  &.option {
    padding-left: 32px;
    font-size: 90%;
    color: $outsider;
  }

  &.headline {
    justify-content: center;
    font-family: PiratesBay, sans-serif;
    letter-spacing: 1px;
    text-align: center;
    background: linear-gradient(
      to right,
      $townsfolk 0%,
      rgba(0, 0, 0, 0.5) 20%,
      rgba(0, 0, 0, 0.5) 80%,
      $demon 100%
    );
    cursor: default;
  }
}
</style>
