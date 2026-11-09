import VoiceClient from "../voice/VoiceClient";
import { playChime, playGatherBell } from "../voice/sounds";

const INVITATION_TIMEOUT = 60 * 1000;
const NOTICE_TIMEOUT = 5 * 1000;

/**
 * Store plugin connecting the voice chat client to Vuex.
 * The client is exposed to the voice module's actions as store.$voice.
 */
export default (store) => {
  const isMuted = () => store.state.grimoire.isMuted;

  const notify = (key, peerId) => {
    store.commit("voice/addNotice", { key, peerId });
    const { id } =
      store.state.voice.notices[store.state.voice.notices.length - 1];
    setTimeout(() => store.commit("voice/removeNotice", id), NOTICE_TIMEOUT);
  };

  const onEvent = (message) => {
    switch (message.type) {
      case "invite": {
        store.commit("voice/addInvitation", message.from);
        const { at } = store.state.voice.invitations.find(
          ({ from }) => from === message.from,
        );
        if (!isMuted()) playChime();
        // unanswered invitations expire (and the inviter is told)
        setTimeout(() => {
          const stillPending = store.state.voice.invitations.some(
            (invitation) =>
              invitation.from === message.from && invitation.at === at,
          );
          if (stillPending) {
            store.dispatch("voice/declineInvitation", message.from);
          }
        }, INVITATION_TIMEOUT);
        break;
      }
      case "request":
        if (!isMuted()) playChime();
        break;
      case "declined":
        notify(
          message.kind === "invite"
            ? "voice.invitationDeclined"
            : "voice.requestDeclined",
          message.by,
        );
        break;
      case "gather":
        store.commit("voice/clearInvitations");
        if (message.sound && !isMuted()) playGatherBell();
        break;
    }
  };

  const client = new VoiceClient({
    serverUrl: process.env.VUE_APP_VOICE_URL || "",
    onStatus: (status, error) =>
      store.commit("voice/setStatus", { status, error }),
    onPeers: (peers, self) => store.commit("voice/setPeers", { peers, self }),
    onSpeaking: (peerId, speaking) =>
      store.commit("voice/setSpeaking", { peerId, speaking }),
    onForceMute: () => {
      if (!store.state.voice.muted) store.dispatch("voice/toggleMute");
    },
    onEvent,
  });
  store.$voice = client;

  // silence locally whoever we must not hear (night rules, other rooms), and
  // play everyone else as loud as we chose
  const applyAudibility = () => {
    const canHear = store.getters["voice/canHear"];
    const volumeOf = store.getters["voice/volumeOf"];
    Object.keys(store.state.voice.peers).forEach((peerId) => {
      client.setVolume(peerId, volumeOf(peerId));
      client.setAudible(peerId, canHear(peerId));
    });
  };

  store.subscribe(({ type }) => {
    switch (type) {
      // leaving (or switching) the live session also leaves its voice room
      case "session/setSessionId":
      case "session/setSpectator":
        if (client.isActive) {
          store.dispatch("voice/leave");
        }
        break;
      case "voice/setStatus":
        if (store.state.voice.status !== "connected") {
          store.commit("voice/clearSpeaking");
          store.commit("voice/clearInvitations");
        } else if (store.getters["voice/isStoryteller"]) {
          // share the current night state with whoever is in the room
          const { awake, broadcast } = store.state.voice;
          client.setNight({
            awake,
            broadcast,
            isNight: store.state.grimoire.isNight,
          });
        }
        applyAudibility();
        break;
      case "toggleNight":
        if (store.getters["voice/isStoryteller"]) {
          // the voice server decides who hears whom: tell it day or night
          if (client.isActive) {
            const { awake, broadcast } = store.state.voice;
            client.setNight({
              awake,
              broadcast,
              isNight: store.state.grimoire.isNight,
            });
          }
          if (store.state.grimoire.isNight) {
            // nightfall: private conversations close, silently
            store.dispatch("voice/gather", { sound: false });
          } else if (
            store.state.voice.awake.length ||
            store.state.voice.broadcast
          ) {
            // dawn: everyone goes back to sleep for the next night
            store.dispatch("voice/setNight", { awake: [], broadcast: false });
          }
        }
        applyAudibility();
        break;
      case "voice/setPeers":
      case "voice/setNight":
      case "voice/setVolume":
        applyAudibility();
        break;
    }
  });
};
