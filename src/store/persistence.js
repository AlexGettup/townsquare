const { default: i18n, detectBrowserLocale } = require("../i18n");

// a saved game older than this isn't a reload anymore, but a new game
const HOSTED_GAME_MAX_AGE = 12 * 60 * 60 * 1000;

/**
 * What survives a page reload of the game the storyteller is hosting, or null
 * when not hosting. It carries its session ID: a new game never inherits it.
 */
const hostedGameOf = ({ session, grimoire, voice, chat }) =>
  session.isSpectator || !session.sessionId
    ? null
    : {
        sessionId: session.sessionId,
        isNight: grimoire.isNight,
        nomination: session.nomination,
        votes: session.votes,
        lockedVote: session.lockedVote,
        votingSpeed: session.votingSpeed,
        isVoteInProgress: session.isVoteInProgress,
        markedPlayer: session.markedPlayer,
        allowSelfNaming: session.allowSelfNaming,
        isVoteHistoryAllowed: session.isVoteHistoryAllowed,
        isVoteWatchingAllowed: session.isVoteWatchingAllowed,
        voteHistory: session.voteHistory,
        dealtRoles: session.dealtRoles,
        awake: voice.awake,
        broadcast: voice.broadcast,
        cardsSince: chat.cardsSince,
      };

/** The saved game, if it's the session we are coming back to as storyteller. */
const loadHostedGame = ([isSpectator, sessionId]) => {
  if (!localStorage.hostedGame) return null;
  const game = JSON.parse(localStorage.hostedGame);
  const isValid =
    !isSpectator &&
    game.sessionId === sessionId &&
    Date.now() - game.savedAt < HOSTED_GAME_MAX_AGE;
  if (!isValid) localStorage.removeItem("hostedGame");
  return isValid ? game : null;
};

const restoreHostedGame = (store, game) => {
  store.commit("toggleNight", game.isNight);
  store.commit("session/nomination", {
    nomination: game.nomination,
    votes: game.votes,
    votingSpeed: game.votingSpeed,
    lockedVote: game.lockedVote,
    // the vote's clock doesn't survive: a vote under way comes back paused
    // (the storyteller resumes it), and one still counting down hasn't started
    isVoteInProgress: game.isVoteInProgress && game.lockedVote > 0,
  });
  store.commit("session/setMarkedPlayer", game.markedPlayer);
  store.commit("session/setAllowSelfNaming", game.allowSelfNaming);
  store.commit("session/setVoteHistoryAllowed", game.isVoteHistoryAllowed);
  store.commit("session/setVoteWatchingAllowed", game.isVoteWatchingAllowed);
  store.commit(
    "session/setVoteHistory",
    game.voteHistory.map((vote) => ({
      ...vote,
      timestamp: new Date(vote.timestamp),
    })),
  );
  store.commit("session/setDealtRoles", game.dealtRoles);
  store.commit("voice/setNight", {
    awake: game.awake,
    broadcast: game.broadcast,
  });
  store.commit("chat/setCardsSince", game.cardsSince);
  store.commit("session/setGameResumed", true);
};

module.exports = (store) => {
  // uses the store's locale explicitly, as vue-i18n may not be synced yet
  const updatePagetitle = (isPublic) =>
    (document.title = i18n.t(
      isPublic ? "pageTitle.townSquare" : "pageTitle.grimoire",
      store.state.grimoire.locale,
    ));

  // initialize data
  // language: last choice on this device, otherwise the browser's language
  store.commit(
    "setLocale",
    localStorage.getItem("locale") || detectBrowserLocale(),
  );
  if (localStorage.getItem("background")) {
    store.commit("setBackground", localStorage.background);
  }
  if (localStorage.getItem("muted")) {
    store.commit("toggleMuted", true);
  }
  if (localStorage.getItem("static")) {
    store.commit("toggleStatic", true);
  }
  // mock assignments no longer need a setting (always available)
  localStorage.removeItem("mockAssignments");
  if (localStorage.getItem("unofficial")) {
    store.commit("toggleUnofficial", true);
  }
  if (localStorage.getItem("imageOptIn")) {
    store.commit("toggleImageOptIn", true);
  }
  if (localStorage.getItem("zoom")) {
    store.commit("setZoom", parseFloat(localStorage.getItem("zoom")));
  }
  if (localStorage.getItem("isGrimoire")) {
    store.commit("toggleGrimoire", false);
  }
  if (localStorage.voiceVolumes !== undefined) {
    store.commit("voice/setVolumes", JSON.parse(localStorage.voiceVolumes));
  }
  updatePagetitle(store.state.grimoire.isPublic);
  if (localStorage.roles !== undefined) {
    store.commit("setCustomRoles", JSON.parse(localStorage.roles));
    store.commit("setEdition", { id: "custom" });
  }
  if (localStorage.edition !== undefined) {
    // this will initialize state.roles for official editions
    store.commit("setEdition", JSON.parse(localStorage.edition));
  }
  if (localStorage.bluffs !== undefined) {
    JSON.parse(localStorage.bluffs).forEach((role, index) => {
      store.commit("setBluff", {
        index,
        role: store.state.roles.get(role) || {},
      });
    });
  }
  if (localStorage.npcs !== undefined) {
    store.commit("setNpcs", {
      npcs: JSON.parse(localStorage.npcs).map(
        (npc) => store.state.otherNpcs.get(npc.id) || npc,
      ),
    });
  }
  // a link to a game takes over from the saved session
  const savedSession =
    localStorage.getItem("session") && !window.location.hash.substr(1)
      ? JSON.parse(localStorage.getItem("session"))
      : null;
  // before the players: nightfall resets marks that were saved with them
  const hostedGame = savedSession && loadHostedGame(savedSession);
  if (hostedGame) restoreHostedGame(store, hostedGame);
  if (localStorage.players) {
    store.commit(
      "players/set",
      JSON.parse(localStorage.players).map((player) => ({
        ...player,
        role:
          store.state.roles.get(player.role) ||
          store.getters.rolesJSONbyId.get(player.role) ||
          {},
      })),
    );
  }
  /**** Session related data *****/
  if (localStorage.getItem("playerId")) {
    store.commit("session/setPlayerId", localStorage.getItem("playerId"));
  }
  if (localStorage.getItem("playerSecret")) {
    store.commit(
      "session/setPlayerSecret",
      localStorage.getItem("playerSecret"),
    );
  }
  if (savedSession) {
    const [spectator, sessionId] = savedSession;
    store.commit("session/setSpectator", spectator);
    store.commit("session/setSessionId", sessionId);
  }

  store.watch(hostedGameOf, (game) => {
    if (game) {
      localStorage.setItem(
        "hostedGame",
        JSON.stringify({ ...game, savedAt: Date.now() }),
      );
    }
  });

  // listen to mutations
  store.subscribe(({ type, payload }, state) => {
    switch (type) {
      case "toggleGrimoire":
        if (!state.grimoire.isPublic) {
          localStorage.setItem("isGrimoire", 1);
        } else {
          localStorage.removeItem("isGrimoire");
        }
        updatePagetitle(state.grimoire.isPublic);
        break;
      case "setLocale":
        localStorage.setItem("locale", state.grimoire.locale);
        updatePagetitle(state.grimoire.isPublic);
        break;
      case "setBackground":
        if (payload) {
          localStorage.setItem("background", payload);
        } else {
          localStorage.removeItem("background");
        }
        break;
      case "toggleMuted":
        if (state.grimoire.isMuted) {
          localStorage.setItem("muted", 1);
        } else {
          localStorage.removeItem("muted");
        }
        break;
      case "voice/setVolume":
        localStorage.setItem(
          "voiceVolumes",
          JSON.stringify(state.voice.volumes),
        );
        break;
      case "toggleStatic":
        if (state.grimoire.isStatic) {
          localStorage.setItem("static", 1);
        } else {
          localStorage.removeItem("static");
        }
        break;
      case "toggleUnofficial":
        if (state.grimoire.isArtUnofficial) {
          localStorage.setItem("unofficial", 1);
        } else {
          localStorage.removeItem("unofficial");
        }
        break;
      case "toggleImageOptIn":
        if (state.grimoire.isImageOptIn) {
          localStorage.setItem("imageOptIn", 1);
        } else {
          localStorage.removeItem("imageOptIn");
        }
        break;
      case "setZoom":
        if (payload !== 0) {
          localStorage.setItem("zoom", payload);
        } else {
          localStorage.removeItem("zoom");
        }
        break;
      case "setEdition":
        localStorage.setItem("edition", JSON.stringify(payload));
        if (state.edition.isOfficial) {
          localStorage.removeItem("roles");
        }
        localStorage.setItem(
          "npcs",
          JSON.stringify(
            state.npcs.map((npc) => (npc.isCustom ? npc : { id: npc.id })),
          ),
        );
        break;
      case "setCustomRoles":
        if (!payload.length) {
          localStorage.removeItem("roles");
        } else {
          localStorage.setItem("roles", JSON.stringify(payload));
          localStorage.setItem(
            "npcs",
            JSON.stringify(
              state.npcs.map((npc) => (npc.isCustom ? npc : { id: npc.id })),
            ),
          );
        }
        break;
      case "setBluff":
        localStorage.setItem(
          "bluffs",
          JSON.stringify(state.bluffs.map(({ id }) => id)),
        );
        break;
      case "setNpcs":
        localStorage.setItem(
          "npcs",
          JSON.stringify(
            state.npcs.map((npc) => (npc.isCustom ? npc : { id: npc.id })),
          ),
        );
        break;
      case "toggleNight": // resets marks on the players
      case "players/add":
      case "players/update":
      case "players/remove":
      case "players/clear":
      case "players/set":
      case "players/swap":
      case "players/move":
        if (state.players.players.length) {
          localStorage.setItem(
            "players",
            JSON.stringify(
              state.players.players.map((player) => ({
                ...player,
                // simplify the stored data
                role: player.role.id || {},
              })),
            ),
          );
        } else {
          localStorage.removeItem("players");
        }
        break;
      case "session/setSessionId":
        if (payload) {
          localStorage.setItem(
            "session",
            JSON.stringify([
              state.session.isSpectator,
              state.session.sessionId,
            ]),
          );
        } else {
          localStorage.removeItem("session");
        }
        if (!payload || state.session.isSpectator) {
          localStorage.removeItem("hostedGame");
        }
        break;
      case "session/setPlayerId":
        if (payload) {
          localStorage.setItem("playerId", payload);
        } else {
          localStorage.removeItem("playerId");
        }
        break;
      case "session/setPlayerSecret":
        if (payload) {
          localStorage.setItem("playerSecret", payload);
        } else {
          localStorage.removeItem("playerSecret");
        }
        break;
    }
  });
};
