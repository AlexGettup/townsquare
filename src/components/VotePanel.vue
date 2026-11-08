<template>
  <div class="vote-panel" v-if="session.isSpectator && nominee">
    <h3>
      {{
        $t(isExile ? "vote.questionExile" : "vote.question", {
          name: nominee.name,
        })
      }}
    </h3>

    <!-- can't vote: say why -->
    <p class="reason" v-if="!me">{{ $t("vote.claimSeatToVote") }}</p>
    <p class="reason" v-else-if="!me.player.connected">
      {{ $t("vote.reclaimSeatToVote") }}
    </p>
    <p class="reason" v-else-if="noGhostVote">{{ $t("vote.noGhostVote") }}</p>

    <template v-else>
      <div class="choices" :class="{ locked: isLocked }">
        <button
          class="choice yes"
          :class="{ selected: myVote === 1 }"
          :disabled="isLocked"
          @click="vote(1)"
        >
          <font-awesome-icon icon="hand-paper" />
          {{ $t("vote.yes") }}
        </button>
        <button
          class="choice yes"
          v-if="me.player.hasTwoVotes"
          :class="{ selected: myVote === 2 }"
          :disabled="isLocked"
          @click="vote(2)"
        >
          ×2
        </button>
        <button
          class="choice no"
          :class="{ selected: !myVote }"
          :disabled="isLocked"
          @click="vote(0)"
        >
          {{ $t("vote.no") }}
        </button>
      </div>
      <p class="mine">
        <font-awesome-icon icon="lock" v-if="isLocked" />
        {{ $t(isLocked ? "vote.lockedVote" : "vote.yourVote") }}
        <strong :class="myVote ? 'yes' : 'no'">{{ myVoteName }}</strong>
      </p>
      <p class="status" v-if="status">{{ status }}</p>
      <p class="hint" v-if="me.player.isDead && !isLocked">
        {{ $t("vote.ghostVoteHint") }}
      </p>
    </template>
  </div>
</template>

<script>
import { mapState } from "vuex";

/**
 * Players: their own vote during a nomination, at the bottom of the screen.
 * Asks the question plainly, shows the vote they have now, how far the clock
 * hand is from their seat (their vote locks when it passes) and, when they
 * can't vote, why.
 */
export default {
  computed: {
    ...mapState(["session"]),
    ...mapState("players", ["players"]),
    nominee: function () {
      const { nomination } = this.session;
      return nomination ? this.players[nomination[1]] : null;
    },
    // travellers are exiled, not executed (and everyone may vote)
    isExile: function () {
      return this.nominee.role.team === "traveller";
    },
    me: function () {
      const index = this.players.findIndex(
        (player) => player.id === this.session.playerId,
      );
      return index < 0 ? null : { player: this.players[index], index };
    },
    noGhostVote: function () {
      return this.me.player.isVoteless && !this.isExile;
    },
    myVote: function () {
      // the keyboard shortcuts store true / false instead of 1 / 0
      const vote = this.session.votes[this.me.index];
      return vote === true ? 1 : vote || 0;
    },
    myVoteName: function () {
      if (!this.myVote) return this.$t("vote.noShort");
      return this.myVote === 2
        ? this.$t("vote.yesShort") + " ×2"
        : this.$t("vote.yesShort");
    },
    // order of this seat in the vote (0 = first, right after the nominee)
    position: function () {
      const count = this.players.length;
      return (this.me.index - 1 + count - this.session.nomination[1]) % count;
    },
    // seats between the clock hand and us (negative: it has passed)
    seatsAway: function () {
      return this.position - (this.session.lockedVote - 1);
    },
    isLocked: function () {
      return this.session.lockedVote >= 1 && this.seatsAway < 0;
    },
    status: function () {
      const { isVoteInProgress, lockedVote } = this.session;
      if (this.isLocked) return "";
      if (!isVoteInProgress && lockedVote < 1) return this.$t("vote.waiting");
      if (lockedVote < 1) return this.$t("vote.starting");
      if (this.seatsAway === 0) return this.$t("vote.yourTurnNow");
      return this.$tc("vote.seatsAway", this.seatsAway, {
        count: this.seatsAway,
      });
    },
  },
  methods: {
    vote(vote) {
      if (!this.me || this.noGhostVote || this.isLocked) return;
      if (this.myVote === vote) return;
      this.$store.commit("session/voteSync", [this.me.index, vote]);
    },
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.vote-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 85;
  max-width: 480px;
  margin: 0 auto;
  padding: 10px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 0 20px black;
  text-align: center;
  font-size: 16px;
  animation: vote-panel-in 200ms ease-out;

  h3 {
    margin: 0 0 10px;
    font-size: 120%;
  }

  p {
    margin: 8px 0 0;
  }

  .reason {
    color: lightgray;
  }

  .hint {
    color: gray;
    font-size: 90%;
  }

  .mine strong {
    &.yes {
      color: $demon;
    }
    &.no {
      color: $townsfolk;
    }
  }
}

.choices {
  display: flex;
  gap: 10px;

  &.locked {
    opacity: 0.6;
  }
}

.choice {
  flex: 1;
  min-height: 52px;
  padding: 0 10px;
  font: inherit;
  font-size: 110%;
  font-weight: bold;
  color: white;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  cursor: pointer;
  touch-action: manipulation;

  svg {
    margin-right: 6px;
  }

  &:disabled {
    cursor: default;
  }

  // the chosen vote: filled with its colour
  &.yes.selected {
    background: $demon;
    border-color: white;
    box-shadow: 0 0 12px $demon;
  }
  &.no.selected {
    background: $townsfolk;
    border-color: white;
    box-shadow: 0 0 12px $townsfolk;
  }
}

@keyframes vote-panel-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>
