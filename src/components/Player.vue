<template>
  <li :style="zoom">
    <div
      ref="player"
      class="player"
      :class="[
        {
          dead: player.isDead,
          marked:
            (!session.isSpectator || session.isVoteWatchingAllowed) &&
            session.markedPlayer === index,
          'hand-raised': player.handRaised,
          'no-vote': player.isVoteless,
          'two-votes': player.hasTwoVotes,
          you:
            player.connected &&
            session.sessionId &&
            player.id &&
            player.id === session.playerId,
          'vote-yes':
            (!session.isSpectator ||
              session.isVoteWatchingAllowed ||
              (!session.isVoteInProgress && session.lockedVote < 1) ||
              player.id === session.playerId) &&
            session.votes[index],
          'vote-twice':
            (!session.isSpectator ||
              session.isVoteWatchingAllowed ||
              (!session.isVoteInProgress && session.lockedVote < 1) ||
              player.id === session.playerId) &&
            session.votes[index] === 2,
          'vote-hidden':
            session.isSpectator &&
            !session.isVoteWatchingAllowed &&
            (session.isVoteInProgress || session.lockedVote >= 1) &&
            player.id !== session.playerId,
          'vote-lock': voteLocked,
        },
        player.role.team,
        'alignment-' + player.alignmentIndex,
      ]"
    >
      <div class="shroud" @click="onStatusClick"></div>
      <div class="life" @click="onStatusClick"></div>

      <div
        class="night-order first"
        v-if="
          nightOrder.get(player).first &&
          grimoire.isNightOrder &&
          !session.isSpectator
        "
      >
        <em>{{ nightOrder.get(player).first }}</em>
        <span class="description" v-if="displayRole.firstNightReminder">
          <span v-html="formatNightReminder(displayRole.firstNightReminder)" />
        </span>
      </div>
      <div
        class="night-order other"
        v-if="
          nightOrder.get(player).other &&
          grimoire.isNightOrder &&
          !session.isSpectator
        "
      >
        <em>{{ nightOrder.get(player).other }}</em>
        <span class="description" v-if="displayRole.otherNightReminder">
          <span v-html="formatNightReminder(displayRole.otherNightReminder)" />
        </span>
      </div>

      <Token
        :role="player.role"
        :alignmentIndex="
          player.role.team === 'traveller' && grimoire.isPublic
            ? 0
            : player.alignmentIndex
        "
        @set-role="onTokenClick"
      />

      <!-- Storyteller: last info card sent to this player, and if they saw it -->
      <font-awesome-icon
        :icon="cardStatus === 'seen' ? 'thumbs-up' : 'envelope'"
        class="card-status"
        :class="cardStatus"
        v-if="cardStatus"
        :title="$t(`cards.${cardStatus}`)"
      />

      <!-- Today: nominated someone (bottom left) / was nominated (bottom right) -->
      <font-awesome-icon
        icon="hand-point-right"
        class="nomination-mark nominator"
        v-if="player.hasNominated"
        :title="$t('player.hasNominated')"
      />
      <font-awesome-icon
        icon="gavel"
        class="nomination-mark nominee"
        v-if="player.wasNominated"
        :title="$t('player.wasNominated')"
      />

      <!-- Voice chat: ring while talking, icon while the microphone is off -->
      <div class="voice-ring" v-if="voiceSpeaking"></div>
      <font-awesome-icon
        icon="microphone-slash"
        class="voice-muted"
        v-if="voiceMuted"
        :title="$t('voice.playerMuted')"
      />
      <!-- Storyteller at night: this player is awake on voice chat -->
      <font-awesome-icon
        icon="eye"
        class="voice-awake"
        v-if="canWakeVoice && isAwake(player.id)"
        :title="$t('voice.awake')"
      />
      <!-- Day: talking in a private conversation or a room -->
      <font-awesome-icon
        icon="comments"
        class="voice-place"
        v-if="voicePlace"
        :style="{ color: placeColor(voicePlace) }"
        :title="placeName(voicePlace)"
      />

      <!-- Claimed seat icon -->
      <font-awesome-icon
        icon="chair"
        v-if="player.id && session.sessionId"
        class="seat"
        :class="{
          highlight: session.isRolesDistributed,
          disconnected: !player.connected,
        }"
        :title="setSeatTitle()"
      />

      <!-- Ghost vote icon -->
      <font-awesome-icon
        icon="vote-yea"
        class="has-vote"
        v-if="player.isDead && !player.isVoteless"
        @click="updatePlayer('isVoteless', true)"
        :title="$t('player.ghostVote')"
      />

      <!-- Two votes icon -->
      <font-awesome-icon
        icon="sign-language"
        class="two-votes"
        v-if="player.hasTwoVotes"
        @click="updatePlayer('hasTwoVotes', false)"
        :title="$t('player.hasTwoVotes')"
      />

      <!-- Overlay icons -->
      <div class="overlay">
        <font-awesome-icon icon="hand-paper" class="hand" />
        <font-awesome-icon
          icon="hand-paper"
          class="vote first-vote"
          @click="vote(player)"
        />
        <font-awesome-icon
          icon="hand-paper"
          class="vote second-vote"
          @click="vote(player)"
        />
        <font-awesome-icon icon="times" class="vote" @click="vote(player)" />
        <font-awesome-icon icon="question" class="vote" @click="vote(player)" />
        <font-awesome-icon
          icon="times-circle"
          class="cancel"
          :title="$t('player.cancel')"
          @click="cancel()"
        />
        <font-awesome-icon
          icon="exchange-alt"
          class="swap"
          @click="swapPlayer(player)"
          :title="$t('player.swapWithPlayer')"
        />
        <font-awesome-icon
          icon="redo-alt"
          class="move"
          @click="movePlayer(player)"
          :title="$t('player.moveToSeat')"
        />
        <font-awesome-icon
          icon="hand-point-right"
          class="nominate"
          @click="nominatePlayer(player)"
          :title="$t('player.nominatePlayer')"
        />
      </div>

      <!-- On block icon -->
      <div class="marked">
        <font-awesome-icon icon="skull" />
      </div>
      <div
        class="name"
        @click="isMenuOpen = !isMenuOpen"
        :class="{ active: isMenuOpen }"
      >
        <span>{{ player.name }}</span>
        <span class="pronouns" v-if="player.pronouns">{{
          player.pronouns
        }}</span>
      </div>

      <transition name="fold">
        <ul class="menu" v-if="isMenuOpen">
          <li @click="changeRole" v-if="canChangeRole">
            <font-awesome-icon icon="theater-masks" />
            {{ $t("player.changeRole") }}
          </li>
          <li
            @click="raiseHand"
            v-if="
              session.isSpectator &&
              player.connected &&
              player.id === session.playerId &&
              !session.nomination
            "
          >
            <font-awesome-icon icon="hand-paper" />
            {{ $t("player.raiseHand") }}
          </li>
          <li @click="sendInfoCard" v-if="canSendInfoCard">
            <font-awesome-icon icon="address-card" />
            {{ $t("cards.send") }}
          </li>
          <li @click="inviteToTalk" v-if="canInvite">
            <font-awesome-icon icon="user-plus" />
            {{ $t("voice.invite") }}
          </li>
          <li @click="changeAlignment" v-if="player.role.id">
            <font-awesome-icon icon="yin-yang" />
            {{ $t("player.changeAlignment") }}
          </li>
          <li
            @click="changePronouns"
            v-if="
              !session.isSpectator ||
              (session.isSpectator &&
                player.connected &&
                player.id === session.playerId)
            "
          >
            <font-awesome-icon icon="venus-mars" />
            {{ $t("player.changePronouns") }}
          </li>
          <li
            @click="changeName"
            v-if="
              !session.isSpectator ||
              (session.allowSelfNaming &&
                session.isSpectator &&
                player.connected &&
                player.id === session.playerId)
            "
          >
            <font-awesome-icon icon="user-edit" />
            {{ $t("player.rename") }}
          </li>
          <template v-if="!session.isSpectator">
            <li
              @click="updatePlayer('hasTwoVotes', !player.hasTwoVotes, true)"
              v-if="session.isTwoVotesEnabled"
            >
              <font-awesome-icon icon="sign-language" class="two-votes-icon" />
              {{ $t("player.hasTwoVotesMenu") }}
            </li>
            <li @click="movePlayer()" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="redo-alt" />
              {{ $t("player.movePlayer") }}
            </li>
            <li @click="swapPlayer()" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="exchange-alt" />
              {{ $t("player.swapSeats") }}
            </li>
            <li @click="removePlayer" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="times-circle" />
              {{ $t("player.remove") }}
            </li>
            <li @click="toggleAwakeVoice" v-if="canWakeVoice">
              <font-awesome-icon :icon="isAwake(player.id) ? 'bed' : 'eye'" />
              {{
                isAwake(player.id) ? $t("voice.putToSleep") : $t("voice.wakeUp")
              }}
            </li>
            <li
              @click="updatePlayer('id', '', true)"
              v-if="player.id && session.sessionId"
            >
              <font-awesome-icon icon="chair" />
              {{ $t("player.emptySeat") }}
            </li>
            <template v-if="!session.nomination">
              <li @click="nominatePlayer()">
                <font-awesome-icon icon="hand-point-right" />
                {{
                  isNominating
                    ? $t("player.cancelNomination")
                    : $t("player.nomination")
                }}
              </li>
            </template>
          </template>
          <li
            @click="claimSeat"
            v-if="session.isSpectator"
            :class="{ disabled: player.id && player.id !== session.playerId }"
          >
            <font-awesome-icon icon="chair" />
            <template
              v-if="
                !player.id ||
                (player.id === session.playerId && !player.connected)
              "
            >
              {{ $t("player.claimSeat") }}</template
            >
            <template v-else-if="player.id === session.playerId">
              {{ $t("player.vacateSeat") }}
            </template>
            <template v-else> {{ $t("player.seatOccupied") }}</template>
          </li>
        </ul>
      </transition>
    </div>

    <template v-if="player.reminders">
      <div
        class="reminder"
        :key="reminder.role + ' ' + reminder.name"
        v-for="reminder in player.reminders"
        :class="[{ custom: reminder.imageAlt === 'custom' }, reminder.role]"
        @click="removeReminder(reminder)"
      >
        <span
          class="icon"
          :style="{
            backgroundImage: `url(${getImage(
              {
                id: reminder.role,
                team: reminder.team,
                edition: reminder.edition,
                image: reminder.image,
                imageAlt: reminder.imageAlt,
              },
              0,
            )})`,
          }"
        ></span>
        <span class="text">{{ localizeReminder(reminder) }}</span>
      </div>
    </template>
    <div class="reminder add" @click="$emit('trigger', ['openReminderModal'])">
      <span class="icon"></span>
    </div>
    <div class="reminderHoverTarget"></div>
  </li>
</template>

<script>
import Token from "./Token";
import { mapGetters, mapState } from "vuex";
import peerNames from "../voice/peerNames";
import { PLAZA, isConversation } from "../store/modules/voice";

export default {
  mixins: [peerNames],
  components: {
    Token,
  },
  props: {
    player: {
      type: Object,
      required: true,
    },
    isNominating: {
      type: Boolean,
    },
  },
  computed: {
    ...mapState("players", ["players"]),
    ...mapState(["grimoire", "session", "voice"]),
    ...mapGetters({ nightOrder: "players/nightOrder" }),
    ...mapGetters(["getImage", "localizeRole", "localizeReminder"]),
    // storyteller: info cards go to seated players through the chat
    canSendInfoCard: function () {
      return (
        !this.session.isSpectator &&
        !!this.session.sessionId &&
        !!this.player.id &&
        this.voice.isAvailable
      );
    },
    cardStatus: function () {
      if (this.session.isSpectator || !this.player.id) return null;
      return this.$store.getters["chat/cardStatusOf"](this.player.id);
    },
    // players can guess anyone's character, except travellers (public)
    canChangeRole: function () {
      return !(
        this.session.isSpectator && this.player.role.team === "traveller"
      );
    },
    ...mapGetters("voice", [
      "isConnected",
      "selfPeerId",
      "isStoryteller",
      "isAwake",
      "showSpeaking",
      "locationOf",
    ]),
    // role with night order texts in the chosen language
    displayRole: function () {
      return this.localizeRole(this.player.role);
    },
    // voice chat state of whoever claimed this seat
    isVoiceSelf: function () {
      return !!this.player.id && this.player.id === this.selfPeerId;
    },
    voicePeer: function () {
      if (!this.isConnected || !this.player.id) return null;
      return this.voice.peers[this.player.id] || null;
    },
    voiceSpeaking: function () {
      return (
        this.isConnected &&
        !!this.player.id &&
        !!this.voice.speaking[this.player.id] &&
        // at night players don't see who talks unless they can hear them
        this.showSpeaking(this.player.id)
      );
    },
    // storyteller at night can wake up players who are in voice chat
    canWakeVoice: function () {
      return this.isStoryteller && this.grimoire.isNight && !!this.voicePeer;
    },
    // day: private conversation or room this player is in (not the plaza)
    voicePlace: function () {
      if (!this.isConnected || this.grimoire.isNight || !this.player.id) {
        return null;
      }
      const location = this.locationOf(this.player.id);
      return location && location !== PLAZA ? location : null;
    },
    // day: invite this player to talk in private (or into our conversation)
    canInvite: function () {
      if (
        !this.isConnected ||
        this.grimoire.isNight ||
        !this.voicePeer ||
        this.isVoiceSelf
      ) {
        return false;
      }
      return !(
        isConversation(this.voice.location) &&
        this.locationOf(this.player.id) === this.voice.location
      );
    },
    voiceMuted: function () {
      if (!this.isConnected) return false;
      if (this.isVoiceSelf) return this.voice.muted;
      return !!this.voicePeer && this.voicePeer.muted;
    },
    index: function () {
      return this.players.indexOf(this.player);
    },
    voteLocked: function () {
      const session = this.session;
      const players = this.players.length;
      if (!session.nomination) return false;
      const indexAdjusted =
        (this.index - 1 + players - session.nomination[1]) % players;
      return indexAdjusted < session.lockedVote - 1;
    },
    zoom: function () {
      const unit = window.innerWidth > window.innerHeight ? "vh" : "vw";
      if (this.players.length < 7) {
        return { width: 18 + this.grimoire.zoom + unit };
      } else if (this.players.length <= 10) {
        return { width: 16 + this.grimoire.zoom + unit };
      } else if (this.players.length <= 15) {
        return { width: 14 + this.grimoire.zoom + unit };
      } else {
        return { width: 12 + this.grimoire.zoom + unit };
      }
    },
  },
  data() {
    return {
      isMenuOpen: false,
      isSwap: false,
    };
  },
  watch: {
    // only one player menu at a time: a click anywhere else closes it
    // (the empty square, or another player to open their menu)
    isMenuOpen(isOpen) {
      if (isOpen) {
        document.addEventListener("click", this.closeMenuOnOutsideClick, true);
      } else {
        document.removeEventListener(
          "click",
          this.closeMenuOnOutsideClick,
          true,
        );
      }
    },
  },
  beforeDestroy() {
    document.removeEventListener("click", this.closeMenuOnOutsideClick, true);
    clearTimeout(this.tapTimer);
  },
  methods: {
    // Touch screens: the shroud is easy to hit by mistake, so one tap
    // anywhere on the token opens the player menu and a double tap toggles
    // death. With a mouse, the shroud toggles death and the token opens the menu.
    isTouchScreen() {
      return !!window.matchMedia && window.matchMedia("(hover: none)").matches;
    },
    onStatusClick() {
      if (this.isTouchScreen()) {
        this.onTokenTap();
      } else {
        this.toggleStatus();
      }
    },
    onTokenClick() {
      if (this.isTouchScreen()) {
        this.onTokenTap();
      } else {
        this.isMenuOpen = !this.isMenuOpen;
      }
    },
    onTokenTap() {
      // players can't change deaths: open the menu right away
      if (this.session.isSpectator) {
        this.isMenuOpen = !this.isMenuOpen;
        return;
      }
      if (this.tapTimer) {
        // second tap: a double tap, undo the menu of the first tap
        clearTimeout(this.tapTimer);
        this.tapTimer = null;
        this.isMenuOpen = this.menuBeforeTap;
        this.toggleStatus();
        return;
      }
      // first tap: the menu reacts at once, a second tap may still follow
      this.menuBeforeTap = this.isMenuOpen;
      this.isMenuOpen = !this.isMenuOpen;
      this.tapTimer = setTimeout(() => {
        this.tapTimer = null;
      }, 300);
    },
    closeMenuOnOutsideClick(event) {
      const player = this.$refs.player;
      if (player && !player.contains(event.target)) {
        this.isMenuOpen = false;
      }
    },
    formatNightReminder(text) {
      return text
        .replace(/\*(.*?)\*/g, "<b>$1</b>")
        .replace(/:reminder:/g, '<i class="reminder-token"></i>');
    },
    raiseHand() {
      if (this.session.isSpectator && this.player.id !== this.session.playerId)
        return;
      this.updatePlayer("handRaised", !this.player.handRaised, false);
    },
    changeAlignment() {
      let newAlignment = this.player.alignmentIndex + 1;
      if (
        (this.player.role.team !== "traveller" && newAlignment > 1) ||
        newAlignment > 2
      )
        newAlignment = 0;
      this.updatePlayer("alignmentIndex", newAlignment);
    },
    changePronouns() {
      if (this.session.isSpectator && this.player.id !== this.session.playerId)
        return;
      const pronouns = prompt(
        this.$t("dialogs.playerPronouns"),
        this.player.pronouns,
      );
      //Only update pronouns if not null (prompt was not cancelled)
      if (pronouns !== null) {
        this.updatePlayer("pronouns", pronouns, true);
      }
    },
    toggleStatus() {
      if (this.grimoire.isPublic) {
        if (!this.player.isDead) {
          this.updatePlayer("isDead", true);
          if (this.player.isMarked) {
            this.updatePlayer("isMarked", false);
          }
        } else if (this.player.isVoteless) {
          this.updatePlayer("isVoteless", false);
          this.updatePlayer("isDead", false);
        } else {
          this.updatePlayer("isVoteless", true);
        }
      } else {
        this.updatePlayer("isDead", !this.player.isDead);
        if (this.player.isMarked) {
          this.updatePlayer("isMarked", false);
        }
        if (this.player.isVoteless) {
          this.updatePlayer("isVoteless", false);
        }
      }
    },
    changeName() {
      const name =
        prompt(this.$t("dialogs.playerName"), this.player.name) ||
        this.player.name;
      if (name !== null && name !== "") {
        this.updatePlayer("name", name, true);
      }
    },
    removeReminder(reminder) {
      const reminders = [...this.player.reminders];
      reminders.splice(this.player.reminders.indexOf(reminder), 1);
      this.updatePlayer("reminders", reminders, true);
    },
    updatePlayer(property, value, closeMenu = false) {
      if (
        this.session.isSpectator &&
        property !== "reminders" &&
        property !== "handRaised" &&
        property !== "pronouns" &&
        property !== "name" &&
        property !== "alignmentIndex"
      )
        return;
      this.$store.commit("players/update", {
        player: this.player,
        property,
        value,
      });
      if (closeMenu) {
        this.isMenuOpen = false;
      }
    },
    changeRole() {
      this.isMenuOpen = false;
      this.$emit("trigger", ["openRoleModal"]);
    },
    removePlayer() {
      this.isMenuOpen = false;
      this.$emit("trigger", ["removePlayer"]);
    },
    toggleAwakeVoice() {
      this.isMenuOpen = false;
      this.$store.dispatch("voice/toggleAwake", this.player.id);
    },
    sendInfoCard() {
      this.isMenuOpen = false;
      this.$store.commit("chat/composeCard", this.player.id);
    },
    inviteToTalk() {
      this.isMenuOpen = false;
      this.$store.dispatch("voice/invite", this.player.id);
    },
    swapPlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["swapPlayer", player]);
    },
    movePlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["movePlayer", player]);
    },
    nominatePlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["nominatePlayer", player]);
    },
    cancel() {
      this.$emit("trigger", ["cancel"]);
    },
    claimSeat() {
      this.isMenuOpen = false;
      this.$emit("trigger", ["claimSeat"]);
    },
    setSeatTitle() {
      if (this.player.connected) {
        if (this.player.id === this.session.playerId) {
          return this.$t("player.seatYours");
        }
        return this.$t("player.seatClaimedBy", { name: this.player.name });
      } else {
        if (this.player.id === this.session.playerId) {
          return this.$t("player.seatYoursReserved");
        }
        return this.$t("player.seatReservedFor", { name: this.player.name });
      }
    },
    /**
     * Allow the ST to override a locked vote.
     */
    vote(player) {
      if (this.session.isSpectator) return;
      if (!this.voteLocked) return;

      var count = this.session.votes[this.index];
      if (player.hasTwoVotes && count === 1) {
        count = 2;
      } else if (count === 0) {
        count = 1;
      } else {
        count = 0;
      }

      this.$store.commit("session/voteSync", [
        this.index,
        (this.session.votes[this.index] = count),
      ]);
    },
  },
};
</script>

<style lang="scss">
@import "../vars.scss";

.fold-enter-active,
.fold-leave-active {
  transition: transform 250ms ease-in-out;
  transform-origin: left center;
  transform: perspective(200px);
}

.fold-enter,
.fold-leave-to {
  transform: perspective(200px) rotateY(90deg);
}

/***** Player token *****/
.circle .player {
  margin-bottom: 10px;

  &:before {
    content: " ";
    display: block;
    padding-top: 100%;
  }

  .shroud {
    top: 0;
    left: 0;
    position: absolute;
    // no double-tap zoom: a double tap toggles death on touch screens
    touch-action: manipulation;
    width: 100%;
    height: 45%;
    cursor: pointer;
    transform: rotateX(0deg);
    transform-origin: top center;
    transition: transform 200ms ease-in-out;
    z-index: 2;
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.8));

    &:before {
      content: " ";
      background: url("../assets/shroud.webp") center -10px no-repeat;
      background-size: auto 110%;
      position: absolute;
      margin-left: -50%;
      width: 100%;
      height: 100%;
      left: 50%;
      top: -30%;
      opacity: 0;
      transform: perspective(400px) scale(1.5);
      transform-origin: top center;
      transition: all 200ms;
      pointer-events: none;
    }

    #townsquare.spectator &,
    #app.night & {
      pointer-events: none;
    }

    #townsquare:not(.spectator) &:hover:before {
      opacity: 0.5;
      top: -10px;
      transform: scale(1);
    }
  }

  &.dead .shroud:before {
    opacity: 1;
    top: 0;
    transform: perspective(400px) scale(1);
  }

  #townsquare:not(.spectator) &.dead .shroud:hover:before {
    opacity: 1;
  }
}

/****** Life token *******/
.player {
  z-index: 2;

  .life {
    touch-action: manipulation;
    border-radius: 50%;
    width: 100%;
    background: url("../assets/life.webp") center center;
    background-size: 100%;
    border: 3px solid black;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    cursor: pointer;
    transition: transform 200ms ease-in-out;
    transform: perspective(400px) rotateY(180deg);
    backface-visibility: hidden;
    position: absolute;
    left: 0;
    top: 0;

    &:before {
      content: " ";
      display: block;
      padding-top: 100%;
    }
  }

  &.dead {
    &.no-vote .life:after {
      display: none;
    }

    .life {
      background-image: url("../assets/death.webp");

      &:after {
        content: " ";
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        background: url("../assets/vote.webp") center center no-repeat;
        background-size: 50%;
        height: 100%;
        pointer-events: none;
      }
    }
  }

  &.traveller .life {
    filter: grayscale(100%);
  }
}

#townsquare.public .player {
  .shroud {
    transform: perspective(400px) rotateX(90deg);
    pointer-events: none;
  }

  .life {
    transform: perspective(400px) rotateY(0deg);
  }

  &.traveller:not(.dead) .token {
    transform: perspective(400px) scale(0.8);
    pointer-events: none;
    transition-delay: 0s;
  }

  &.traveller.dead .token {
    transition-delay: 0s;
  }
}

/***** Role token ******/
.player .token {
  touch-action: manipulation;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  transition: transform 200ms ease-in-out;
  transform: perspective(400px) rotateY(0deg);
  backface-visibility: hidden;
}

#townsquare.public .circle .token {
  transform: perspective(400px) rotateY(-180deg);
}

/****** Player choice icons *******/
.player .overlay {
  width: 100%;
  position: absolute;
  pointer-events: none;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &:after {
    content: " ";
    display: block;
    padding-top: 100%;
  }
}

.player .overlay svg {
  position: absolute;
  filter: drop-shadow(0 0 3px black);
  z-index: 2;
  cursor: pointer;

  &.hand,
  &.swap,
  &.move,
  &.nominate,
  &.vote,
  &.cancel {
    width: 50%;
    height: 60%;
    opacity: 0;
    pointer-events: none;
    transition: all 250ms;
    transform: scale(0.2);

    * {
      stroke-width: 10px;
      stroke: white;
      fill: url(#default);
    }

    &:hover *,
    &.fa-hand-paper * {
      fill: url(#demon);
    }

    &.hand.fa-hand-paper {
      height: 55%;
      transform: none;
      transform-origin: center 175%;
      transition: all 500ms;
      & * {
        fill: url(#default);
      }
    }

    &.fa-times *,
    &.fa-question * {
      fill: url(#townsfolk);
    }
  }
}

.player.hand-raised .overlay svg.hand.fa-hand-paper {
  opacity: 1;
  transform: rotateZ(45deg) translateY(-35%);
}

#townsquare.vote .player .overlay svg.hand.fa-hand-paper {
  opacity: 0;
}

// other player voted yes, but is not locked yet
#townsquare.vote .player.vote-yes .overlay svg.vote.fa-hand-paper {
  opacity: 0.5;
  transform: scale(1);
}

#townsquare.vote
  .player:not(.vote-twice)
  .overlay
  svg.second-vote.fa-hand-paper {
  opacity: 0 !important;
}

#townsquare.vote .player.two-votes .overlay svg.first-vote.fa-hand-paper {
  right: 50%;
}

#townsquare.vote .player.two-votes .overlay svg.second-vote.fa-hand-paper {
  left: 50%;
}

// you voted yes | a locked vote yes | a locked vote no
#townsquare.vote .player.you.vote-yes .overlay svg.vote.fa-hand-paper,
#townsquare.vote .player.vote-lock.vote-yes .overlay svg.vote.fa-hand-paper,
#townsquare.vote .player.vote-lock.vote-hidden .overlay svg.vote.fa-question,
#townsquare.vote
  .player.vote-lock:not(.vote-yes):not(.vote-hidden)
  .overlay
  svg.vote.fa-times {
  opacity: 1;
  transform: scale(1);
}

// a locked vote can be clicked on by the ST
#townsquare.vote:not(.spectator) .player.vote-lock .overlay svg.vote {
  pointer-events: all;
}

li.from:not(.nominate) .player .overlay svg.cancel {
  opacity: 1;
  transform: scale(1);
  pointer-events: all;
}

li.swap:not(.from) .player .overlay svg.swap,
li.nominate .player .overlay svg.nominate,
li.move:not(.from) .player .overlay svg.move {
  opacity: 1;
  transform: scale(1);
  pointer-events: all;
}

/****** Vote icon ********/
.player .has-vote {
  color: #fff;
  filter: drop-shadow(0 0 3px black);
  transition: opacity 250ms;
  z-index: 2;

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }
}

.has-vote {
  position: absolute;
  margin-top: -15%;
  right: 2px;
}

/****** Two votes icon ********/
.player .two-votes {
  color: #fff;
  filter: drop-shadow(0 0 3px black);
  transition: opacity 250ms;
  z-index: 2;
  position: absolute;
  margin-top: -100%;
  right: -5px;
  transform: rotate(60deg);

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }
}

/****** Session seat glow *****/
@mixin glowAnimation($name, $color) {
  @keyframes #{$name}-glow {
    0% {
      box-shadow: 0 0 rgba($color, 1);
      border-color: $color;
    }

    50% {
      border-color: black;
    }

    100% {
      box-shadow: 0 0 20px 16px transparent;
      border-color: $color;
    }
  }
}

@include glowAnimation("good", $townsfolk);
@include glowAnimation("evil", $demon);
@include glowAnimation("traveller", $traveller);

@mixin glow($team, $alignment, $name) {
  .player.you.#{$team}.alignment-#{$alignment} .token {
    animation: #{$name}-glow 5s ease-in-out infinite;
  }
}

@include glow("townsfolk", "0", "good");
@include glow("townsfolk", "1", "evil");
@include glow("outsider", "0", "good");
@include glow("outsider", "1", "evil");
@include glow("minion", "0", "evil");
@include glow("minion", "1", "good");
@include glow("demon", "0", "evil");
@include glow("demon", "1", "good");
@include glow("traveller", "0", "traveller");
@include glow("traveller", "1", "traveller");
@include glow("traveller", "2", "traveller");

.player.you .token {
  animation: townsfolk-glow 5s ease-in-out infinite;
}

/****** Marked icon ******/
.player .marked {
  position: absolute;
  width: 100%;
  top: 0;
  filter: drop-shadow(0px 0px 6px black);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 250ms;
  opacity: 0;

  &:before {
    content: " ";
    padding-top: 100%;
    display: block;
  }

  svg {
    height: 60%;
    width: 60%;
    position: absolute;
    stroke: white;
    stroke-width: 15px;

    path {
      fill: white;
    }
  }
}

.player.marked .marked {
  opacity: 0.5;
}

/****** Voice chat ********/
// green ring around the token while the player talks
.player .voice-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  border-radius: 50%;
  pointer-events: none;
  z-index: 1;
  box-shadow:
    0 0 0 4px $voice-speaking,
    0 0 18px 6px $voice-speaking;
  animation: voice-pulse 1s ease-in-out infinite alternate;

  &:before {
    content: " ";
    display: block;
    padding-top: 100%;
  }
}

@keyframes voice-pulse {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}

// storyteller view at night: player woken up on voice chat
.player .voice-awake {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin-top: -108%;
  color: $fabled;
  filter: drop-shadow(0 0 4px black);
  z-index: 2;
  pointer-events: none;
}

// day: in a private conversation or room (color tells them apart)
.player .voice-place {
  position: absolute;
  right: -8px;
  // between the two-votes icon (top) and the ghost vote icon (bottom)
  margin-top: -58%;
  filter: drop-shadow(0 0 3px black);
  z-index: 2;
  pointer-events: auto;
}

// microphone turned off
.player .voice-muted {
  position: absolute;
  left: -5px;
  margin-top: -100%;
  color: $demon;
  filter: drop-shadow(0 0 3px black);
  z-index: 2;
  pointer-events: none;
}

/****** Nominated today: bottom corners, above the seat and ghost vote icons ******/
.player .nomination-mark {
  position: absolute;
  margin-top: -38%;
  font-size: 130%;
  filter: drop-shadow(0 0 3px black);
  z-index: 2;
  pointer-events: none;
  &.nominator {
    left: -5px;
    color: $townsfolk;
  }
  &.nominee {
    right: -5px;
    color: $demon;
  }
}

/****** Info card status (storyteller) ********/
.player .card-status {
  position: absolute;
  right: -5px;
  margin-top: -100%;
  font-size: 130%;
  filter: drop-shadow(0 0 3px black);
  z-index: 2;
  pointer-events: none;
  &.sent {
    color: lightgray;
  }
  &.seen {
    color: $fabled;
  }
}

/****** Seat icon ********/
.player .seat {
  position: absolute;
  left: 2px;
  margin-top: -15%;
  color: #fff;
  filter: drop-shadow(0 0 3px black);
  cursor: default;
  z-index: 2;

  &.highlight {
    animation-iteration-count: 1;
    animation: redToWhite 1s normal forwards;
  }

  &.disconnected {
    color: red;
  }
}

// highlight animation
@keyframes redToWhite {
  from {
    color: $demon;
  }
  to {
    color: white;
  }
}

.player.you .seat {
  color: $townsfolk;
}

/***** Player name *****/
.player > .name {
  right: 10%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: 120%;
  line-height: 120%;
  cursor: pointer;
  white-space: nowrap;
  width: 120%;
  background: rgba(0, 0, 0, 0.5);
  border: 3px solid black;
  border-radius: 10px;
  top: 5px;
  box-shadow: 0 0 5px black;
  padding: 0 4px;

  svg {
    top: 3px;
    margin-right: 2px;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    flex-grow: 1;
  }

  &:hover,
  &.active {
    color: red;
  }

  .pronouns {
    font-size: 60%;
    line-height: 1;
    padding-bottom: 5px;
  }
}

.player.dead > .name {
  opacity: 0.5;
}

/***** Player menu *****/
.player > .menu {
  position: absolute;
  left: 110%;
  bottom: -5px;
  text-align: left;
  font-size: 90%;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 5px;
  border-radius: 10px;
  border: 3px solid #000;
  margin-left: 15px;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);

  &:before {
    content: " ";
    width: 0;
    height: 0;
    position: absolute;
    border: 10px solid transparent;
    border-right-color: black;
    right: 100%;
    bottom: 5px;
    margin-right: 2px;
  }

  li:hover {
    color: red;
  }

  li.disabled {
    cursor: not-allowed;
    opacity: 0.5;

    &:hover {
      color: white;
    }
  }

  svg {
    margin-right: 2px;
  }

  .two-votes-icon {
    transform: rotate(60deg);
  }
}

/***** Ability text *****/
#townsquare.public .circle .ability {
  display: none;
}

.circle .player .shroud:hover ~ .token .ability,
.circle .player .token:hover .ability {
  opacity: 1;
}

/**** Night reminders ****/
.player .night-order {
  z-index: 3;
}

.player.dead .night-order em {
  color: #ddd;
  background: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, gray 100%);
}

/***** Reminder token *****/
.circle .reminder {
  background: url("../assets/reminder.webp") center center;
  background-size: 100%;
  width: 50%;
  height: 0;
  padding-bottom: 50%;
  box-sizing: content-box;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 5px 0 0 -25%;
  border-radius: 50%;
  border: 3px solid black;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  transition: all 200ms;
  cursor: pointer;

  .text {
    line-height: 90%;
    color: black;
    font-size: 50%;
    font-weight: bold;
    text-align: center;
    margin-top: 50%;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 15%;
    text-shadow:
      0 1px 1px #f6dfbd,
      0 -1px 1px #f6dfbd,
      1px 0 1px #f6dfbd,
      -1px 0 1px #f6dfbd;
  }

  .icon,
  &:after {
    content: " ";
    position: absolute;
    top: 0;
    width: 90%;
    height: 80%;
    background-size: 100%;
    background-position: center center;
    background-repeat: no-repeat;
    background-image: url("../assets/plus.webp");
    transition: opacity 200ms;
  }

  &:after {
    background-image: url("../assets/x.webp");
    opacity: 0;
    top: 5%;
    height: 90%;
  }

  &.add {
    opacity: 0;
    top: 30px;

    &:after {
      display: none;
    }

    .icon {
      top: 5%;
      height: 90%;
    }
  }

  &.custom {
    .icon {
      display: none;
    }

    .text {
      font-size: 70%;
      word-break: break-word;
      margin-top: 0;
      display: flex;
      align-items: center;
      align-content: center;
      justify-content: center;
      border-radius: 50%;
      top: 0;
    }
  }

  &:hover:before {
    opacity: 0;
  }

  &:hover:after {
    opacity: 1;
  }
}

.circle .reminderHoverTarget {
  opacity: 0;
  width: calc(50% + 8px);
  padding-top: calc(50% + 38px);
  margin-top: calc(-25% - 33px);
  margin-left: calc(-25% - 3.5px);
  border-radius: 0 0 999px 999px;
  pointer-events: auto;
  transform: none !important;
  z-index: -1;
}

.circle li:hover .reminder.add {
  opacity: 1;
  top: 0;
}

.circle li:hover .reminder.add:before {
  opacity: 1;
}

#townsquare.public .reminder {
  opacity: 0;
  pointer-events: none;
}
</style>
