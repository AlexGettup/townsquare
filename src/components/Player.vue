<template>
  <li
    :style="zoom"
    :class="{ 'picking-seat': isPicking }"
    @click.capture="onSeatPick"
  >
    <div
      ref="player"
      class="player"
      :class="[
        {
          picking: isPicking,
          picked: isPicking && chat.picked.includes(player.name),
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
      <div class="shroud" @click="onTokenTap"></div>
      <div class="life" @click="onTokenTap"></div>

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
        @set-role="onTokenTap"
      />

      <!-- Storyteller: last info card sent to this player, and if they saw it -->
      <font-awesome-icon
        :icon="cardStatusIcon"
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

      <!-- Vote weight (storyteller only): Bureaucrat x3, Thief -1 -->
      <span
        class="vote-weight"
        v-if="
          !session.isSpectator && player.voteWeight && player.voteWeight !== 1
        "
        @click="setVoteValue(1)"
        :title="$t('player.voteValue', { value: voteValueName })"
        >{{ player.voteWeight > 0 ? "×3" : "−1" }}</span
      >

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

      <!-- the player menu: next to the token, or at the bottom of the screen
           on touch screens (bigger, easier to tap) -->
      <component :is="isTouch ? 'BottomSheet' : 'transition'" name="fold">
        <ul
          class="menu"
          v-if="isMenuOpen"
          ref="menu"
          :class="{ arming: isArming }"
        >
          <li class="sheet-header" v-if="isTouch">
            <strong>{{ player.name }}</strong>
            <span v-if="player.role.id">{{ displayRole.name }}</span>
            <font-awesome-icon
              icon="times"
              class="close"
              @click="isMenuOpen = false"
            />
          </li>
          <!-- Storyteller: setting up the seat, behind "Seat ▸" -->
          <template v-if="isSeatMenu">
            <li class="back" @click="isSeatMenu = false">
              <font-awesome-icon icon="chevron-left" />
              {{ $t("player.seat") }}
            </li>
            <li @click="changeName">
              <font-awesome-icon icon="user-edit" />
              {{ $t("player.rename") }}
            </li>
            <li @click="changePronouns">
              <font-awesome-icon icon="venus-mars" />
              {{ $t("player.changePronouns") }}
            </li>
            <li @click="cycleVoteValue">
              <font-awesome-icon icon="sign-language" class="two-votes-icon" />
              {{ $t("player.voteValue", { value: voteValueName }) }}
            </li>
            <li @click="movePlayer()" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="redo-alt" />
              {{ $t("player.movePlayer") }}
            </li>
            <li @click="swapPlayer()" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="exchange-alt" />
              {{ $t("player.swapSeats") }}
            </li>
            <li
              @click="updatePlayer('id', '', true)"
              v-if="player.id && session.sessionId"
            >
              <font-awesome-icon icon="chair" />
              {{ $t("player.emptySeat") }}
            </li>
            <li
              @click="removePlayer"
              class="danger"
              :class="{ disabled: session.lockedVote }"
            >
              <font-awesome-icon icon="times-circle" />
              {{ $t("player.remove") }}
            </li>
          </template>
          <template v-else>
            <!-- Players: an empty seat (or their own, reserved) to claim -->
            <li @click="claimSeat" v-if="canClaimSeat">
              <font-awesome-icon icon="chair" />
              {{ $t("player.claimSeat") }}
            </li>
            <li
              @click="raiseHand"
              v-if="isOwnSeat && player.connected && !session.nomination"
            >
              <font-awesome-icon icon="hand-paper" />
              {{ $t("player.raiseHand") }}
            </li>
            <!-- Storyteller: what each phase uses most goes first -->
            <template v-if="!session.isSpectator">
              <template v-if="grimoire.isNight">
                <li @click="toggleAwakeVoice" v-if="canWakeVoice">
                  <font-awesome-icon
                    :icon="isAwake(player.id) ? 'bed' : 'eye'"
                  />
                  {{
                    isAwake(player.id)
                      ? $t("voice.putToSleep")
                      : $t("voice.wakeUp")
                  }}
                </li>
                <li @click="sendInfoCard" v-if="canSendInfoCard">
                  <font-awesome-icon icon="address-card" />
                  {{ $t("cards.send") }}
                </li>
              </template>
              <template v-else>
                <li @click="nominatePlayer()" v-if="!session.nomination">
                  <font-awesome-icon icon="hand-point-right" />
                  {{
                    isNominating
                      ? $t("player.cancelNomination")
                      : $t("player.nomination")
                  }}
                </li>
                <li @click="inviteToTalk" v-if="canInvite">
                  <font-awesome-icon icon="user-plus" />
                  {{ $t("voice.invite") }}
                </li>
                <li @click="sendInfoCard" v-if="canSendInfoCard">
                  <font-awesome-icon icon="address-card" />
                  {{ $t("cards.send") }}
                </li>
              </template>
              <li @click="toggleDeath">
                <font-awesome-icon
                  :icon="player.isDead ? 'heartbeat' : 'skull'"
                />
                {{
                  player.isDead ? $t("player.revive") : $t("player.markDead")
                }}
              </li>
            </template>
            <li @click="changeRole" v-if="canChangeRole">
              <font-awesome-icon icon="theater-masks" />
              {{ $t("player.changeRole") }}
            </li>
            <li @click="inviteToTalk" v-if="session.isSpectator && canInvite">
              <font-awesome-icon icon="user-plus" />
              {{ $t("voice.invite") }}
            </li>
            <li @click="changeAlignment" v-if="alignmentName">
              <font-awesome-icon icon="yin-yang" />
              {{ $t("player.alignment", { alignment: alignmentName }) }}
            </li>
            <li @click="addReminder">
              <font-awesome-icon icon="plus-circle" />
              {{ $t("player.addReminder") }}
            </li>
            <!-- Players: their own seat -->
            <template v-if="isOwnSeat && player.connected">
              <li @click="changePronouns">
                <font-awesome-icon icon="venus-mars" />
                {{ $t("player.changePronouns") }}
              </li>
              <li @click="changeName" v-if="session.allowSelfNaming">
                <font-awesome-icon icon="user-edit" />
                {{ $t("player.rename") }}
              </li>
              <li @click="claimSeat">
                <font-awesome-icon icon="chair" />
                {{ $t("player.vacateSeat") }}
              </li>
            </template>
            <li @click="isSeatMenu = true" v-if="!session.isSpectator">
              <font-awesome-icon icon="cog" />
              {{ $t("player.seat") }}
              <font-awesome-icon icon="chevron-right" class="submenu" />
            </li>
          </template>
        </ul>
      </component>
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
    <div
      class="reminder add"
      v-if="!isPicking"
      @click="$emit('trigger', ['openReminderModal'])"
    >
      <span class="icon"></span>
    </div>
    <div class="reminderHoverTarget"></div>
  </li>
</template>

<script>
import { isTouchScreen } from "../touch";
import BottomSheet from "./BottomSheet";
import Token from "./Token";
import { mapGetters, mapState } from "vuex";
import peerNames from "../voice/peerNames";
import closeOnOutsideClick from "../closeOnOutsideClick";
import { PLAZA, isConversation } from "../store/modules/voice";

// Token sizes as a share of the circle's diameter, measured on 11 screen sizes
// so that with up to 13 players neither tokens nor names touch each other.
// few players: the middle of the circle and the reminders need room too
const MAX_TOKEN_SIZE = 0.19;
// many players: below this characters can't be read or tapped, so names may
// touch their neighbours instead
const MIN_TOKEN_SIZE = 0.11;
// room between neighbours, as a share of the token's width
const TOKEN_SPACING = 1.28;

/**
 * CSS width of a token: as big as fits between its neighbours, with room for
 * its name (see --name-room in TownSquare.vue), which doesn't shrink with it.
 * @param playerCount
 * @param zoom the player's own setting, in steps of 1% of the short side
 */
const tokenWidth = (playerCount, zoom) => {
  const side = Math.sin(Math.PI / Math.max(playerCount, 3));
  const fit = side / (TOKEN_SPACING + side);
  const circle = "var(--circle-size)";
  const size =
    `clamp(${circle} * ${MIN_TOKEN_SIZE}, ` +
    `${circle} * ${fit} - var(--name-room), ` +
    `${circle} * ${MAX_TOKEN_SIZE})`;
  return `calc(${size} + ${zoom}vmin)`;
};

export default {
  mixins: [
    peerNames,
    // only one player menu at a time: clicking another player closes this one
    closeOnOutsideClick({
      isOpen: "isMenuOpen",
      inside() {
        return [this.$refs.player, this.$refs.menu];
      },
      close() {
        this.isMenuOpen = false;
      },
    }),
  ],
  components: {
    BottomSheet,
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
    ...mapState(["grimoire", "session", "voice", "chat"]),
    ...mapGetters("chat", ["isPicking"]),
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
    cardStatusIcon: function () {
      return { sent: "envelope", seen: "thumbs-up", answered: "check-square" }[
        this.cardStatus
      ];
    },
    // storyteller: how this player's vote counts (1, 2 Banshee, 3, -1)
    voteValue: function () {
      if (this.player.hasTwoVotes) return 2;
      return this.player.voteWeight || 1;
    },
    voteValueName: function () {
      const role = { 2: "banshee", 3: "bureaucrat", "-1": "thief" }[
        this.voteValue
      ];
      const value = this.voteValue < 0 ? "−1" : "×" + this.voteValue;
      if (!role) return value;
      const json = this.$store.getters.rolesJSONbyId.get(role);
      const name = json ? this.$store.getters.localizeRole(json).name : role;
      return value + " · " + name;
    },
    // players: this seat is theirs
    isOwnSeat: function () {
      return (
        this.session.isSpectator &&
        !!this.player.id &&
        this.player.id === this.session.playerId
      );
    },
    // players: an empty seat, or their own one after reconnecting
    canClaimSeat: function () {
      return (
        this.session.isSpectator &&
        (!this.player.id || (this.isOwnSeat && !this.player.connected))
      );
    },
    // current alignment of the character token, for the menu
    alignmentName: function () {
      const { team } = this.player.role;
      const index = this.player.alignmentIndex;
      let key;
      if (team === "traveller") key = ["regular", "good", "evil"][index];
      else if (team === "townsfolk" || team === "outsider")
        key = index ? "evil" : "good";
      else if (team === "minion" || team === "demon")
        key = index ? "good" : "evil";
      return key ? this.$t("modals.role.alignment." + key) : "";
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
      return { width: tokenWidth(this.players.length, this.grimoire.zoom) };
    },
  },
  data() {
    return {
      isMenuOpen: false,
      // touch screens: the menu is a panel at the bottom of the screen
      isTouch: isTouchScreen(),
      // a double tap or click may still come, the touch panel ignores taps
      isArming: false,
      // storyteller: the "Seat" submenu of the player menu is showing
      isSeatMenu: false,
      isSwap: false,
    };
  },
  watch: {
    isMenuOpen(isOpen) {
      if (!isOpen) this.isSeatMenu = false;
    },
    isPicking(isPicking) {
      if (isPicking) this.isMenuOpen = false;
    },
  },
  beforeDestroy() {
    clearTimeout(this.tapTimer);
  },
  methods: {
    // Answering a "choose a player" card: a tap on the seat picks it and does
    // nothing else (no menu, and reminders can't be removed by mistake).
    // Names, not seat numbers: seats can move while the player is choosing
    onSeatPick(event) {
      if (!this.isPicking) return;
      event.stopPropagation();
      event.preventDefault();
      if (event.target.closest(".player")) {
        this.$store.dispatch("chat/pickSeat", this.player.name);
      }
    },
    // The shroud is easy to hit by mistake, so one tap or click anywhere on the
    // token opens the player menu and a double one toggles death.
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
        this.isArming = false;
        this.isMenuOpen = this.menuBeforeTap;
        this.toggleStatus();
        return;
      }
      // first tap: the menu reacts at once, a second tap may still follow
      this.menuBeforeTap = this.isMenuOpen;
      this.isMenuOpen = !this.isMenuOpen;
      this.isArming = true;
      this.tapTimer = setTimeout(() => {
        this.tapTimer = null;
        this.isArming = false;
      }, 300);
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
    // vote value from the "Seat" submenu: x1 → x2 → x3 → -1 → x1
    cycleVoteValue() {
      const values = [1, 2, 3, -1];
      const next = values[(values.indexOf(this.voteValue) + 1) % values.length];
      this.setVoteValue(next);
    },
    setVoteValue(value) {
      // x2 (Banshee) is public: players see it and choose 1 or 2 votes
      const hasTwoVotes = value === 2;
      if (!!this.player.hasTwoVotes !== hasTwoVotes) {
        this.updatePlayer("hasTwoVotes", hasTwoVotes);
      }
      // x3 and -1 stay with the storyteller (they count it, players don't know)
      const weight = value === 3 || value === -1 ? value : 1;
      if ((this.player.voteWeight || 1) !== weight) {
        this.updatePlayer("voteWeight", weight);
      }
    },
    // explicit death toggle in the menu (a double tap or click also does it)
    toggleDeath() {
      if (this.player.isDead) {
        this.updatePlayer("isDead", false);
        if (this.player.isVoteless) this.updatePlayer("isVoteless", false);
      } else {
        this.updatePlayer("isDead", true);
        if (this.player.isMarked) this.updatePlayer("isMarked", false);
      }
      this.isMenuOpen = false;
    },
    addReminder() {
      this.isMenuOpen = false;
      this.$emit("trigger", ["openReminderModal"]);
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
    // no double-tap zoom: a double tap toggles death
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
  }

  &.dead .shroud:before {
    opacity: 1;
    top: 0;
    transform: perspective(400px) scale(1);
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

/****** Vote weight (Bureaucrat, Thief) ********/
.player .vote-weight {
  position: absolute;
  margin-top: -100%;
  right: -5px;
  z-index: 2;
  font-weight: bold;
  font-size: 110%;
  color: #fff;
  text-shadow:
    0 0 3px black,
    0 0 3px black;
  cursor: pointer;
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
  &.seen,
  &.answered {
    color: $fabled;
  }
}

/****** Choosing a player for a card ********/
// reminders reach into the neighbouring seats: only the seats take taps
li.picking-seat .reminder,
li.picking-seat .reminderHoverTarget {
  pointer-events: none;
}
.player.picking {
  cursor: pointer;
  .token {
    animation: none;
    box-shadow: 0 0 8px 2px rgba(255, 255, 255, 0.6);
  }
  &.picked .token {
    box-shadow:
      0 0 0 4px white,
      0 0 18px 6px white;
  }
  &.picked > .name {
    color: black;
    background: white;
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
  // wider than the token, and with room for most names when the token is small
  --name-width: max(120%, min(4.4em, 150%));
  right: calc((var(--name-width) - 100%) / 2);
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: 120%;
  line-height: 120%;
  cursor: pointer;
  white-space: nowrap;
  width: var(--name-width);
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

  // "Seat" submenu: an arrow on the right, the way back on top
  .submenu {
    margin: 0 0 0 6px;
    font-size: 80%;
  }
  li.back {
    color: gray;
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
    margin-bottom: 2px;
    &:hover {
      color: red;
    }
  }
  li.danger {
    color: $demon;
    border-top: 1px solid rgba(255, 255, 255, 0.3);
    margin-top: 2px;
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
