<template>
  <div class="voice-prompts" v-if="isConnected">
    <transition-group name="prompt" tag="div">
      <!-- someone invites us to talk in private -->
      <div
        class="prompt"
        v-for="invitation in pendingInvitations"
        :key="'invite-' + invitation.from"
      >
        <font-awesome-icon icon="user-plus" />
        <span>{{
          $t("voice.invitedBy", { name: peerName(invitation.from) })
        }}</span>
        <div class="button-group">
          <div
            class="button townsfolk"
            @click="acceptInvitation(invitation.from)"
          >
            {{ $t("voice.accept") }}
          </div>
          <div class="button demon" @click="declineInvitation(invitation.from)">
            {{ $t("voice.decline") }}
          </div>
        </div>
      </div>

      <!-- someone asks to join our conversation -->
      <div
        class="prompt"
        v-for="peerId in joinRequests"
        :key="'request-' + peerId"
      >
        <font-awesome-icon icon="comments" />
        <span>{{ $t("voice.wantsToJoin", { name: peerName(peerId) }) }}</span>
        <div class="button-group">
          <div class="button townsfolk" @click="acceptRequest(peerId)">
            {{ $t("voice.accept") }}
          </div>
          <div class="button demon" @click="declineRequest(peerId)">
            {{ $t("voice.decline") }}
          </div>
        </div>
      </div>

      <!-- short notices -->
      <div
        class="prompt notice"
        v-for="notice in voice.notices"
        :key="notice.id"
      >
        <font-awesome-icon icon="times-circle" />
        <span>{{ $t(notice.key, { name: peerName(notice.peerId) }) }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import peerNames from "../voice/peerNames";

/**
 * Invitations, join requests and notices for private voice conversations.
 */
export default {
  mixins: [peerNames],
  computed: {
    ...mapState(["voice"]),
    ...mapGetters("voice", [
      "isConnected",
      "pendingInvitations",
      "joinRequests",
    ]),
  },
  methods: {
    acceptInvitation(from) {
      this.$store.dispatch("voice/acceptInvitation", from);
    },
    declineInvitation(from) {
      this.$store.dispatch("voice/declineInvitation", from);
    },
    acceptRequest(peerId) {
      this.$store.dispatch("voice/acceptRequest", peerId);
    },
    declineRequest(peerId) {
      this.$store.dispatch("voice/declineRequest", peerId);
    },
  },
};
</script>

<style scoped lang="scss">
.voice-prompts {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  z-index: 80;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  max-width: 95vw;
}

.prompt {
  pointer-events: auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.8);
  border: 3px solid black;
  border-radius: 10px;
  box-shadow: 0 0 10px black;

  .button-group {
    font-size: 90%;
  }

  &.notice {
    color: lightgray;
    padding: 8px 12px;
  }
}

.prompt-enter-active,
.prompt-leave-active {
  transition: all 250ms;
}
.prompt-enter,
.prompt-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
