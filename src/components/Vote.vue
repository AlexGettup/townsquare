<template>
  <div id="vote">
    <div class="arrows">
      <span class="nominee" :style="nomineeStyle"></span>
      <span class="nominator" :style="nominatorStyle"></span>
    </div>
    <div class="overlay">
      <audio src="../assets/sounds/countdown.mp3" preload="auto"></audio>
      <i18n path="vote.nominated" tag="span">
        <template #nominator>
          <em class="blue">{{ nominator.name }}</em>
        </template>
        <template #nominee>
          <em>{{ nominee.name }}</em>
        </template>
      </i18n>
      <br />
      <template
        v-if="
          !session.isSpectator ||
          (!session.isVoteHidden &&
            (session.isVoteWatchingAllowed ||
              (!session.isVoteInProgress && session.lockedVote < 1)))
        "
      >
        <em class="blue">
          {{ $tc("vote.votes", voteCount, { count: voteCount }) }}
        </em>
        {{ $t("vote.inFavor") }}
      </template>
      <template v-else-if="!session.isVoteHidden">
        {{ $t("vote.secret") }}
      </template>
      <div class="secret" v-if="session.isVoteHidden">
        <font-awesome-icon icon="eye-slash" />
        {{
          session.isSpectator ? $t("vote.hiddenPlayer") : $t("vote.hiddenST")
        }}
      </div>
      <!-- executions count the living, exiles everyone -->
      <em v-if="nominee.role.team !== 'traveller'">
        {{ $t("vote.majority", { count: Math.ceil(alive / 2) }) }}
      </em>
      <em v-else>{{
        $t("vote.majority", { count: Math.ceil(players.length / 2) })
      }}</em>
      <!-- someone is already about to die today: what this vote needs -->
      <em class="to-tie" v-if="toBeat">
        {{
          $t("vote.toTie", {
            count: toBeat.count,
            names: toBeat.nominees.join(", "),
            more: toBeat.count + 1,
          })
        }}
      </em>

      <template v-if="!session.isSpectator">
        <div
          v-if="!session.isVoteInProgress && session.lockedVote < 1"
          class="buttons"
        >
          {{ $t("vote.timePerPlayer") }}
          <font-awesome-icon
            @mousedown.prevent="setVotingSpeed(-100)"
            icon="minus-circle"
          />
          {{ session.votingSpeed / 1000 }}s
          <font-awesome-icon
            @mousedown.prevent="setVotingSpeed(100)"
            icon="plus-circle"
          />
        </div>
        <!-- before it starts: a secret vote (Organ Grinder) -->
        <div
          v-if="!session.isVoteInProgress && session.lockedVote < 1"
          class="buttons hidden-toggle"
          @click="toggleHidden"
        >
          <font-awesome-icon
            :icon="session.isVoteHidden ? 'check-square' : 'square'"
          />
          {{ $t("vote.hidden") }}
        </div>
        <div
          v-if="
            isAnySeatEmpty &&
            !session.isVoteInProgress &&
            session.lockedVote < 1
          "
        >
          <em>
            <font-awesome-icon icon="exclamation-triangle" />
            {{ $t("vote.seatsUnoccupied") }}
            <font-awesome-icon icon="exclamation-triangle" />
          </em>
        </div>
        <div class="button-group">
          <div
            class="button townsfolk"
            v-if="!session.isVoteInProgress"
            @click="countdown"
          >
            {{ $t("vote.countdown") }}
          </div>
          <div class="button" v-if="!session.isVoteInProgress" @click="start">
            {{ session.lockedVote ? $t("vote.restart") : $t("vote.start") }}
          </div>
          <template v-else>
            <div
              class="button townsfolk"
              :class="{ disabled: !session.lockedVote }"
              @click="pause"
            >
              {{ voteTimer ? $t("vote.pause") : $t("vote.resume") }}
            </div>
            <div class="button" @click="stop">{{ $t("vote.reset") }}</div>
          </template>
          <div class="button demon" @click="finish">
            {{ $t("vote.close") }}
          </div>
        </div>
        <div class="button-group mark" v-if="nominee.role.team !== 'traveller'">
          <div
            class="button"
            :class="{
              disabled: session.nomination[1] === session.markedPlayer,
            }"
            @click="setMarked"
          >
            {{ $t("vote.markForExecution") }}
          </div>
          <div class="button" @click="removeMarked">
            {{ $t("vote.clearMark") }}
          </div>
        </div>
      </template>
    </div>
    <transition name="blur">
      <div
        class="countdown"
        v-if="session.isVoteInProgress && !session.lockedVote"
      >
        <span>3</span>
        <span>2</span>
        <span>1</span>
        <span>{{ $t("vote.go") }}</span>
        <audio
          :autoplay="!grimoire.isMuted"
          src="../assets/sounds/countdown.mp3"
          :muted="grimoire.isMuted"
        ></audio>
      </div>
    </transition>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { valueFromReminders } from "../store/voteValue";

export default {
  computed: {
    ...mapState("players", ["players"]),
    ...mapState(["session", "grimoire"]),
    ...mapGetters({ alive: "players/alive" }),
    // today's top vote, if a new execution vote has to tie or beat it
    toBeat: function () {
      if (this.nominee.role.team === "traveller") return null;
      const top = this.$store.getters["session/votesToBeat"];
      return top && top.count >= Math.ceil(this.alive / 2) ? top : null;
    },
    nominator: function () {
      return this.players[this.session.nomination[0]];
    },
    nominatorStyle: function () {
      const players = this.players.length;
      const nomination = this.session.nomination[0];
      return {
        transform: `rotate(${Math.round((nomination / players) * 360)}deg)`,
        transitionDuration: this.session.votingSpeed - 100 + "ms",
      };
    },
    nominee: function () {
      return this.players[this.session.nomination[1]];
    },
    nomineeStyle: function () {
      const players = this.players.length;
      const nomination = this.session.nomination[1];
      const lock = this.session.lockedVote;
      const rotation = (360 * (nomination + Math.min(lock, players))) / players;
      return {
        transform: `rotate(${Math.round(rotation)}deg)`,
        transitionDuration: this.session.votingSpeed - 100 + "ms",
      };
    },
    player: function () {
      return this.players.find((p) => p.id === this.session.playerId);
    },
    currentVote: function () {
      const index = this.players.findIndex(
        (p) => p.id === this.session.playerId,
      );
      return index >= 0 ? this.session.votes[index] : 0;
    },
    canVote: function () {
      if (!this.player) return false;
      if (!this.player.connected) return false;
      if (this.player.isVoteless && this.nominee.role.team !== "traveller")
        return false;
      const session = this.session;
      const players = this.players.length;
      const index = this.players.indexOf(this.player);
      const indexAdjusted =
        (index - 1 + players - session.nomination[1]) % players;
      return indexAdjusted >= session.lockedVote - 1;
    },
    voteCount: function () {
      const nomination = this.session.nomination[1];
      const votes = Array(this.players.length)
        .fill(0)
        .map((x, index) =>
          this.session.votes[index] === undefined
            ? 0
            : this.session.votes[index],
        )
        // keyboard votes are true / false; Bureaucrat x3, Thief -1
        .map(
          (vote, index) =>
            (vote === true ? 1 : vote || 0) *
            ((this.players[index] && this.players[index].voteWeight) || 1),
        );
      const reorder = [
        ...votes.slice(nomination + 1),
        ...votes.slice(0, nomination + 1),
      ];
      return (
        this.session.lockedVote
          ? reorder.slice(0, this.session.lockedVote - 1)
          : reorder
      ).reduce((a, b) => a + b, 0);
    },
    isAnySeatEmpty: function () {
      return this.players.some((player) => !player.connected);
    },
  },
  data() {
    return {
      voteTimer: null,
    };
  },
  methods: {
    countdown() {
      this.$store.commit("session/lockVote", 0);
      this.$store.commit("session/setVoteInProgress", true);
      this.voteTimer = setInterval(() => {
        this.start();
      }, 4000);
    },
    start() {
      this.$store.commit("session/lockVote", 1);
      this.$store.commit("session/setVoteInProgress", true);
      clearInterval(this.voteTimer);
      this.voteTimer = setInterval(() => {
        this.$store.commit("session/lockVote");
        if (this.session.lockedVote > this.players.length) {
          clearInterval(this.voteTimer);
          this.$store.commit("session/setVoteInProgress", false);
        }
      }, this.session.votingSpeed);
    },
    pause() {
      if (this.voteTimer) {
        clearInterval(this.voteTimer);
        this.voteTimer = null;
      } else {
        this.voteTimer = setInterval(() => {
          this.$store.commit("session/lockVote");
          if (this.session.lockedVote > this.players.length) {
            clearInterval(this.voteTimer);
            this.$store.commit("session/setVoteInProgress", false);
          }
        }, this.session.votingSpeed);
      }
    },
    stop() {
      clearInterval(this.voteTimer);
      this.voteTimer = null;
      this.$store.commit("session/setVoteInProgress", false);
      this.$store.commit("session/lockVote", 0);
    },
    finish() {
      clearInterval(this.voteTimer);
      this.spendGhostVotes();
      this.$store.commit("session/addHistory", {
        players: this.players,
        day: this.$store.state.grimoire.nightCount,
      });
      this.$store.commit("session/nomination");
    },
    /**
     * The vote went all the way round: dead players who raised their hand
     * used their ghost vote. Not in an exile (everyone votes there), nor for
     * a Banshee with her ability (she votes while dead as often as she likes).
     */
    spendGhostVotes() {
      if (this.session.lockedVote <= this.players.length) return;
      if (this.nominee.role.team === "traveller") return;
      this.players.forEach((player, index) => {
        if (!player.isDead || player.isVoteless) return;
        if (!this.session.votes[index]) return;
        if (valueFromReminders(player.reminders) === 2) return;
        this.$store.commit("players/update", {
          player,
          property: "isVoteless",
          value: true,
        });
      });
    },
    vote(vote) {
      if (!this.canVote) return false;
      const index = this.players.findIndex(
        (p) => p.id === this.session.playerId,
      );
      if (index >= 0 && !!this.session.votes[index] !== vote) {
        this.$store.commit("session/voteSync", [index, vote]);
      }
    },
    setVotingSpeed(diff) {
      const speed = Math.round(this.session.votingSpeed + diff);
      if (speed >= 500 && speed <= 4000) {
        this.$store.commit("session/setVotingSpeed", speed);
      }
    },
    toggleHidden() {
      this.$store.commit("session/setVoteHidden", !this.session.isVoteHidden);
    },
    setMarked() {
      this.$store.commit("session/setMarkedPlayer", this.session.nomination[1]);
    },
    removeMarked() {
      this.$store.commit("session/setMarkedPlayer", -1);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../vars.scss";

#vote {
  position: absolute;
  width: 20%;
  z-index: 20;
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;
  background: url("../assets/demon-head.webp") center center no-repeat;
  background-size: auto 75%;
  text-align: center;
  text-shadow:
    0 1px 2px #000000,
    0 -1px 2px #000000,
    1px 0 2px #000000,
    -1px 0 2px #000000;

  .secret {
    font-size: 85%;
    color: lightgray;
    svg {
      margin-right: 4px;
    }
  }

  .hidden-toggle {
    cursor: pointer;
    font-size: 85%;
    svg {
      margin-right: 4px;
    }
  }

  .mark .button {
    font-size: 75%;
    margin: 0;
  }

  &:after {
    content: " ";
    padding-bottom: 100%;
    display: block;
  }

  em {
    color: $demon;
    font-style: normal;
    font-weight: bold;
    &.blue {
      color: $townsfolk;
    }
    &.to-tie {
      display: block;
    }
  }

  svg {
    filter: drop-shadow(0 0 1px #000000) drop-shadow(0 0 1px #000000);
  }

  .buttons svg {
    cursor: pointer;
    &:hover path {
      fill: url(#demon);
      stroke-width: 30px;
      stroke: white;
    }
  }
}

@keyframes arrow-cw {
  0% {
    opacity: 0;
    transform: rotate(-180deg);
  }
  100% {
    opacity: 1;
    transform: rotate(0deg);
  }
}

@keyframes arrow-ccw {
  0% {
    opacity: 0;
    transform: rotate(180deg);
  }
  100% {
    opacity: 1;
    transform: rotate(0deg);
  }
}

.arrows {
  position: absolute;
  display: flex;
  height: 150%;
  width: 25%;
  pointer-events: none;
  span {
    position: absolute;
    width: 100%;
    height: 100%;
    transition: transform 2.9s ease-in-out;
  }
  span:before {
    content: " ";
    width: 100%;
    height: 100%;
    display: block;
    background-size: auto 100%;
    background-repeat: no-repeat;
    background-position: center center;
    position: absolute;
    filter: drop-shadow(0px 0px 3px #000);
  }
  .nominator:before {
    background-image: url("../assets/clock-small.webp");
    animation: arrow-ccw 1s ease-out;
  }
  .nominee:before {
    background-image: url("../assets/clock-big.webp");
    animation: arrow-cw 1s ease-out;
  }
}

@keyframes countdown {
  0% {
    transform: scale(1.5);
    opacity: 0;
    filter: blur(20px);
  }
  10% {
    opacity: 1;
  }
  50% {
    transform: scale(1);
    filter: blur(0);
  }
  90% {
    color: $townsfolk;
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes countdown-go {
  0% {
    transform: scale(1.5);
    opacity: 0;
    filter: blur(20px);
  }
  10% {
    opacity: 1;
  }
  50% {
    transform: scale(1);
    filter: blur(0);
  }
  90% {
    color: $demon;
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.countdown {
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  audio {
    height: 0;
    width: 0;
    visibility: hidden;
  }
  span {
    position: absolute;
    font-size: 8em;
    font-weight: bold;
    opacity: 0;
  }
  span:nth-child(1) {
    animation: countdown 1100ms normal forwards;
  }
  span:nth-child(2) {
    animation: countdown 1100ms normal forwards 1000ms;
  }
  span:nth-child(3) {
    animation: countdown 1100ms normal forwards 2000ms;
  }
  span:nth-child(4) {
    animation: countdown-go 1100ms normal forwards 3000ms;
  }
}
</style>
