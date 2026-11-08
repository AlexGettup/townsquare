/**
 * Townsquare voice server (Cloudflare Worker).
 *
 * - /rooms/<channel>/ws?peer=<peerId>  WebSocket into the VoiceRoom of a game
 *   session: tells every client who is connected to voice and which audio
 *   track to pull from Cloudflare Realtime for each of them.
 * - /rooms/<channel>/chat?peer=<peerId>  WebSocket for the text chat of the
 *   same game session (works without joining voice).
 * - /rooms/<channel>/sfu/...  proxy to the Cloudflare Realtime SFU API, so
 *   the app secret never reaches the browser. It goes through the room, which
 *   only lets each client receive the microphones it is allowed to hear.
 *
 * Secrets (set with `wrangler secret put`): CF_APP_ID, CF_APP_TOKEN.
 */

// SFU_API_URL (optional var) points to a fake SFU in tests
const SFU_API = "https://rtc.live.cloudflare.com/v1/apps";

// SFU endpoints the app is allowed to call through the proxy
const SFU_ROUTES = [
  ["POST", /^sessions\/new$/],
  ["POST", /^sessions\/[\w-]+\/tracks\/new$/],
  ["PUT", /^sessions\/[\w-]+\/tracks\/update$/],
  ["PUT", /^sessions\/[\w-]+\/tracks\/close$/],
  ["PUT", /^sessions\/[\w-]+\/renegotiate$/],
];

// pages allowed to use this server: the published site, plus local development
const isAllowedOrigin = (origin, env) => {
  if (!origin) return false;
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(
    origin,
  );
};

const withCors = (response, origin) => {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
};

const isAllowedSfuRoute = (method, path) =>
  SFU_ROUTES.some(
    ([allowedMethod, pattern]) =>
      method === allowedMethod && pattern.test(path),
  );

// call the Cloudflare Realtime SFU API with the app secret
const callSfu = (env, method, path, body) =>
  fetch(`${env.SFU_API_URL || SFU_API}/${env.CF_APP_ID}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.CF_APP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (!isAllowedOrigin(origin, env)) {
      return new Response("Forbidden", { status: 403 });
    }
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), origin);
    }

    const room = url.pathname.match(/^\/rooms\/([^/]+)\/(ws|chat|sfu\/.+)$/);
    if (room) {
      const channel = decodeURIComponent(room[1]).toLowerCase();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(channel));
      if (room[2].startsWith("sfu/")) {
        return withCors(await stub.fetch(request), origin);
      }
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected a WebSocket", { status: 426 });
      }
      return stub.fetch(request);
    }

    return withCors(new Response("Not found", { status: 404 }), origin);
  },
};

const STORYTELLER = "host";
// open rooms anyone can walk into
const FIXED_ROOMS = ["tavern", "church", "graveyard"];
const PLAZA = "plaza";
const isConversation = (location) =>
  typeof location === "string" && location.startsWith("conv-");
// text chat: longest message, and how many messages the room remembers
const MAX_MESSAGE_LENGTH = 500;
const CHAT_HISTORY = 500;
const isChat = (ws) => (ws.deserializeAttachment() || {}).kind === "chat";

const shortString = (value, max) => String(value || "").slice(0, max);
const listOf = (value, max, length) =>
  (Array.isArray(value) ? value : [])
    .slice(0, max)
    .map((item) => shortString(item, length))
    .filter(Boolean);

/**
 * Info card from the storyteller: a preset phrase and/or text, characters
 * (role IDs), players (names) and a number or yes/no. Returns null if empty.
 */
const cleanCard = (card) => {
  if (!card || typeof card !== "object") return null;
  const clean = {
    phrase: shortString(card.phrase, 40) || null,
    text: shortString(card.text, 300).trim() || null,
    roles: listOf(card.roles, 12, 60),
    players: listOf(card.players, 20, 60),
    number: Number.isInteger(card.number)
      ? Math.max(0, Math.min(99, card.number))
      : null,
    answer: card.answer === "yes" || card.answer === "no" ? card.answer : null,
  };
  const empty =
    !clean.phrase &&
    !clean.text &&
    !clean.roles.length &&
    !clean.players.length &&
    clean.number === null &&
    !clean.answer;
  return empty ? null : clean;
};
// clients connected before conversations existed lack these fields
const withDefaults = (state) => ({
  location: PLAZA,
  requesting: null,
  invitedBy: [],
  ...state,
});

const chatMessage = (row) => ({
  id: row.id,
  at: row.at,
  from: row.sender,
  channel: row.channel,
  text: row.text,
  card: row.card ? JSON.parse(row.card) : null,
  seen: row.seen || null,
});

/**
 * One VoiceRoom per game session. Every connected client has a WebSocket
 * whose attachment holds its voice state:
 * { peerId, sessionId, trackName, muted, location, requesting, invitedBy }
 * plus, for the storyteller ("host"), the night state: { awake, broadcast }
 *
 * location: "plaza", a fixed room, or a private conversation ("conv-…").
 * The server decides every move, so nobody can join a private conversation
 * without an invitation or being accepted by someone inside (except the
 * storyteller, who can go anywhere).
 *
 * Uses the hibernation API, so an idle room costs nothing.
 */
export class VoiceRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // answer keepalive pings without waking the object up
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'),
    );
    // chat history of this game session
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS chat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at INTEGER NOT NULL,
        sender TEXT NOT NULL,
        channel TEXT NOT NULL,
        text TEXT NOT NULL,
        recipients TEXT NOT NULL
      )`,
    );
    // info cards are chat messages with a card (added after the first version)
    try {
      this.sql.exec(`ALTER TABLE chat ADD COLUMN card TEXT`);
    } catch (e) {
      // the column exists already
    }
    // when the player said they saw an info card
    try {
      this.sql.exec(`ALTER TABLE chat ADD COLUMN seen INTEGER`);
    } catch (e) {
      // the column exists already
    }
    // microphones each client receives: one row per pulled track
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS pulls (
        session TEXT NOT NULL,
        mid TEXT NOT NULL,
        speaker TEXT NOT NULL,
        open INTEGER NOT NULL,
        PRIMARY KEY (session, mid)
      )`,
    );
    // day or night, set by the storyteller
    this.night = false;
    ctx.blockConcurrencyWhile(async () => {
      this.night = !!(await ctx.storage.get("night"));
    });
  }

  async setIsNight(night) {
    if (this.night === !!night) return false;
    this.night = !!night;
    await this.ctx.storage.put("night", this.night);
    return true;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const sfu = url.pathname.match(/\/sfu\/(.+)$/);
    if (sfu) return this.proxySfu(request, sfu[1]);
    const peerId = url.searchParams.get("peer");
    if (!peerId || peerId.length > 200) {
      return new Response("Missing peer", { status: 400 });
    }
    if (url.pathname.endsWith("/chat")) return this.acceptChat(peerId);
    // a peer reconnecting (new tab, network change) replaces its old socket
    this.ctx.getWebSockets(peerId).forEach((old) => {
      try {
        old.close(4000, "Replaced by a new connection");
      } catch (e) {
        // already closed
      }
    });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [peerId]);
    server.serializeAttachment({
      peerId,
      sessionId: null,
      trackName: null,
      muted: false,
      location: PLAZA,
      requesting: null,
      invitedBy: [],
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  // everyone currently sending audio, except an optional closing socket.
  // Pending invitations stay private to the invited peer.
  peers(except) {
    return this.sockets(except)
      .map((ws) => ws.deserializeAttachment())
      .filter((peer) => peer && peer.sessionId)
      .map((peer) => {
        const visible = withDefaults(peer);
        delete visible.invitedBy;
        // the SFU session stays secret: tracks are pulled by peerId
        delete visible.sessionId;
        delete visible.trackName;
        return visible;
      });
  }

  // the voice state of everyone sending audio (SFU session included)
  voicePeers(except) {
    return this.sockets(except)
      .map((ws) => withDefaults(ws.deserializeAttachment() || {}))
      .filter((peer) => peer.sessionId);
  }

  /**
   * May the listener receive the speaker's microphone right now? Same rules
   * as the app: during the day, people in the same place; at night players
   * only hear the storyteller once woken up (or while they talk to
   * everyone). The storyteller receives everyone (the app silences locally
   * whoever they shouldn't hear, so they still see who is talking).
   */
  canPull(listener, speaker, host) {
    if (listener.peerId === speaker.peerId) return false;
    if (listener.peerId === STORYTELLER) return true;
    if (!this.night) return listener.location === speaker.location;
    if (speaker.peerId !== STORYTELLER || !host) return false;
    return !!host.broadcast || (host.awake || []).includes(listener.peerId);
  }

  // peerIds the listener may receive
  hearList(listener, everyone) {
    const host = everyone.find((peer) => peer.peerId === STORYTELLER);
    return everyone
      .filter((speaker) => this.canPull(listener, speaker, host))
      .map((speaker) => speaker.peerId);
  }

  // voice sockets only (text chat sockets are handled apart)
  sockets(except) {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== except && !isChat(ws));
  }

  socketOf(peerId, except) {
    return this.sockets(except).find(
      (ws) => (ws.deserializeAttachment() || {}).peerId === peerId,
    );
  }

  update(ws, changes) {
    const state = { ...ws.deserializeAttachment(), ...changes };
    ws.serializeAttachment(state);
    return state;
  }

  send(ws, message) {
    try {
      ws.send(JSON.stringify(message));
    } catch (e) {
      // socket is closing
    }
  }

  // everyone in a location (e.g. the members of a private conversation)
  membersOf(location, except) {
    return this.sockets(except).filter(
      (ws) => (ws.deserializeAttachment() || {}).location === location,
    );
  }

  moveTo(ws, location) {
    this.update(ws, { location, requesting: null });
  }

  /**
   * Close private conversations with a single person left (they go back to
   * the plaza) and forget requests to join conversations that are gone.
   */
  cleanUp(except) {
    const counts = {};
    this.sockets(except).forEach((ws) => {
      const { location } = ws.deserializeAttachment() || {};
      if (isConversation(location))
        counts[location] = (counts[location] || 0) + 1;
    });
    this.sockets(except).forEach((ws) => {
      const {
        location,
        requesting,
        invitedBy = [],
      } = ws.deserializeAttachment() || {};
      if (isConversation(location) && counts[location] < 2) {
        this.moveTo(ws, PLAZA);
      }
      if (requesting && !(counts[requesting] >= 2)) {
        this.update(ws, { requesting: null });
      }
      const stillHere = invitedBy.filter((id) => this.socketOf(id, except));
      if (stillHere.length !== invitedBy.length) {
        this.update(ws, { invitedBy: stillHere });
      }
    });
  }

  broadcastPeers(except) {
    const peers = this.peers(except);
    const everyone = this.voicePeers(except);
    this.sockets(except).forEach((ws) => {
      const listener = withDefaults(ws.deserializeAttachment() || {});
      this.send(ws, {
        type: "peers",
        peers,
        hear: this.hearList(listener, everyone),
      });
    });
  }

  /**
   * Stop the audio nobody may hear any more (someone left a conversation,
   * night fell…): the SFU stops forwarding it, whatever the client does.
   */
  async enforce(except) {
    const everyone = this.voicePeers(except);
    const host = everyone.find((peer) => peer.peerId === STORYTELLER);
    const bySession = new Map(everyone.map((peer) => [peer.sessionId, peer]));
    const byPeer = new Map(everyone.map((peer) => [peer.peerId, peer]));
    const toClose = new Map();
    this.sql
      .exec(`SELECT session, mid, speaker FROM pulls WHERE open = 1`)
      .toArray()
      .forEach(({ session, mid, speaker }) => {
        const listener = bySession.get(session);
        if (!listener) {
          // that client is gone: forget its tracks
          this.sql.exec(`DELETE FROM pulls WHERE session = ?`, session);
          return;
        }
        const target = byPeer.get(speaker);
        if (target && this.canPull(listener, target, host)) return;
        if (!target) return; // left: the client closes it itself
        toClose.set(session, [...(toClose.get(session) || []), mid]);
      });
    await Promise.all(
      [...toClose].map(async ([session, mids]) => {
        mids.forEach((mid) =>
          this.sql.exec(
            `UPDATE pulls SET open = 0 WHERE session = ? AND mid = ?`,
            session,
            mid,
          ),
        );
        try {
          await callSfu(this.env, "PUT", `sessions/${session}/tracks/close`, {
            tracks: mids.map((mid) => ({ mid })),
            force: true,
          });
        } catch (e) {
          // the SFU session may be gone already
        }
      }),
    );
  }

  /**
   * SFU API proxy. Pulling a remote microphone names the speaker by peerId;
   * the room checks the caller may hear them and fills in the SFU session.
   */
  async proxySfu(request, path) {
    if (!isAllowedSfuRoute(request.method, path)) {
      return json({ errorCode: "not_found" }, 404);
    }
    // some calls (sessions/new) have no body
    const raw = request.method === "GET" ? "" : await request.text();
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch (e) {
      return json({ errorCode: "bad_request" }, 400);
    }
    const session = (path.match(/^sessions\/([\w-]+)\//) || [])[1];
    const isPull = /\/tracks\/(new|update)$/.test(path);
    const remote = isPull
      ? ((body && body.tracks) || []).filter(
          (track) => track.location === "remote",
        )
      : [];

    let pulled = [];
    if (remote.length) {
      const everyone = this.voicePeers();
      const host = everyone.find((peer) => peer.peerId === STORYTELLER);
      const listener = everyone.find((peer) => peer.sessionId === session);
      if (!listener) return json({ errorCode: "not_in_room" }, 403);
      for (const track of remote) {
        const speaker = everyone.find((peer) => peer.peerId === track.peerId);
        if (!speaker || !this.canPull(listener, speaker, host)) {
          return json({ errorCode: "not_allowed" }, 403);
        }
        pulled.push({ track, speaker: speaker.peerId });
        track.sessionId = speaker.sessionId;
        track.trackName = speaker.trackName;
        delete track.peerId;
      }
    }

    const response = await callSfu(this.env, request.method, path, body);
    const data = await response.json().catch(() => ({}));

    if (session && response.ok) {
      if (pulled.length) {
        // remember which microphone each new track carries
        const results = data.tracks || [];
        pulled.forEach(({ track, speaker }, index) => {
          const result =
            results.find(
              (item) =>
                item.mid && track.mid !== undefined && item.mid === track.mid,
            ) ||
            results.filter((item) => item.location !== "local")[index] ||
            {};
          const mid = result.mid || track.mid;
          if (!mid || result.errorCode) return;
          this.sql.exec(
            `INSERT OR REPLACE INTO pulls (session, mid, speaker, open)
             VALUES (?, ?, ?, 1)`,
            session,
            String(mid),
            speaker,
          );
        });
      }
      if (path.endsWith("/tracks/close")) {
        ((body && body.tracks) || []).forEach(({ mid }) =>
          this.sql.exec(
            `DELETE FROM pulls WHERE session = ? AND mid = ?`,
            session,
            String(mid),
          ),
        );
      }
    }
    return json(data, response.status);
  }

  async webSocketMessage(ws, data) {
    let message;
    try {
      message = JSON.parse(data);
    } catch (e) {
      return;
    }
    if (isChat(ws)) {
      await this.handleChat(ws, message);
      return;
    }
    const me = withDefaults(ws.deserializeAttachment());
    switch (message.type) {
      case "join":
        ws.serializeAttachment({
          ...me,
          sessionId: String(message.sessionId),
          trackName: String(message.trackName),
          muted: !!message.muted,
          // tells clients a peer rejoined with a new connection
          since: Date.now(),
        });
        this.broadcastPeers();
        break;
      case "update":
        ws.serializeAttachment({ ...me, muted: !!message.muted });
        this.broadcastPeers();
        break;
      case "mute":
        // the storyteller mutes someone else's microphone
        this.ctx.getWebSockets(String(message.peerId)).forEach((target) => {
          target.send(JSON.stringify({ type: "mute", by: me.peerId }));
        });
        break;
      case "night":
        // storyteller only: who is awake at night, and whether they are
        // talking to everyone. Shared with all clients through the peer list.
        if (me.peerId !== STORYTELLER) break;
        ws.serializeAttachment({
          ...me,
          awake: (Array.isArray(message.awake) ? message.awake : [])
            .slice(0, 50)
            .map(String),
          broadcast: !!message.broadcast,
        });
        if (message.isNight !== undefined) {
          await this.setIsNight(message.isNight);
        }
        this.broadcastPeers();
        break;
      default:
        if (this.handleConversation(ws, me, message)) {
          this.cleanUp();
          this.broadcastPeers();
        }
    }
    await this.enforce();
  }

  /**
   * Private conversations and rooms. Returns true when locations changed.
   */
  handleConversation(ws, me, message) {
    const isStoryteller = me.peerId === STORYTELLER;
    switch (message.type) {
      case "invite": {
        // ask someone to talk in private (with us, or in our conversation)
        const target = this.socketOf(String(message.to));
        if (!target || message.to === me.peerId) return false;
        const them = withDefaults(target.deserializeAttachment());
        if (isConversation(me.location) && them.location === me.location) {
          return false;
        }
        this.update(target, {
          invitedBy: [
            ...them.invitedBy.filter((id) => id !== me.peerId),
            me.peerId,
          ].slice(-20),
        });
        this.send(target, { type: "invite", from: me.peerId });
        return false;
      }
      case "accept-invite": {
        const from = String(message.from);
        if (!me.invitedBy.includes(from)) return false;
        this.update(ws, {
          invitedBy: me.invitedBy.filter((id) => id !== from),
        });
        const inviter = this.socketOf(from);
        if (!inviter) return true;
        let { location } = inviter.deserializeAttachment();
        if (!isConversation(location)) {
          // start a new private conversation with the inviter
          location = "conv-" + crypto.randomUUID().slice(0, 8);
          this.moveTo(inviter, location);
        }
        this.moveTo(ws, location);
        return true;
      }
      case "decline-invite": {
        const from = String(message.from);
        this.update(ws, {
          invitedBy: me.invitedBy.filter((id) => id !== from),
        });
        const inviter = this.socketOf(from);
        if (inviter) {
          this.send(inviter, {
            type: "declined",
            kind: "invite",
            by: me.peerId,
          });
        }
        return false;
      }
      case "request": {
        // ask the members of a private conversation to let us in
        const location = String(message.location);
        if (!isConversation(location) || location === me.location) {
          return false;
        }
        const members = this.membersOf(location);
        if (!members.length) return false;
        this.update(ws, { requesting: location });
        members.forEach((member) =>
          this.send(member, { type: "request", from: me.peerId, location }),
        );
        return true;
      }
      case "cancel-request":
        this.update(ws, { requesting: null });
        return true;
      case "accept-request":
      case "decline-request": {
        const requester = this.socketOf(String(message.from));
        if (!requester || !isConversation(me.location)) return false;
        const { requesting } = requester.deserializeAttachment();
        if (requesting !== me.location) return false;
        if (message.type === "accept-request") {
          this.moveTo(requester, me.location);
        } else {
          this.update(requester, { requesting: null });
          this.send(requester, {
            type: "declined",
            kind: "request",
            by: me.peerId,
          });
        }
        return true;
      }
      case "move": {
        // plaza and fixed rooms are open to everyone; the storyteller can
        // also walk into any private conversation
        const location = String(message.location);
        const allowed =
          location === PLAZA ||
          FIXED_ROOMS.includes(location) ||
          (isStoryteller &&
            isConversation(location) &&
            this.membersOf(location).length > 0);
        if (!allowed || location === me.location) return false;
        this.moveTo(ws, location);
        return true;
      }
      case "gather":
        // storyteller: everyone back to the plaza (optionally with a sound)
        if (!isStoryteller) return false;
        this.sockets().forEach((socket) =>
          this.update(socket, {
            location: PLAZA,
            requesting: null,
            invitedBy: [],
          }),
        );
        this.sockets().forEach((socket) =>
          this.send(socket, { type: "gather", sound: !!message.sound }),
        );
        return true;
    }
    return false;
  }

  // --- text chat ----------------------------------------------------------

  acceptChat(peerId) {
    const tag = "chat:" + peerId;
    // the same player in a new tab replaces the old chat connection
    this.ctx.getWebSockets(tag).forEach((old) => {
      try {
        old.close(4000, "Replaced by a new connection");
      } catch (e) {
        // already closed
      }
    });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [tag]);
    server.serializeAttachment({ kind: "chat", peerId });
    return new Response(null, { status: 101, webSocket: client });
  }

  chatSockets() {
    return this.ctx.getWebSockets().filter(isChat);
  }

  // where a peer is: their voice location, or the plaza without voice
  locationOfPeer(peerId) {
    const voice = this.socketOf(peerId);
    return voice ? withDefaults(voice.deserializeAttachment()).location : PLAZA;
  }

  /**
   * Chat messages follow the voice rules: what you write is read by whoever
   * is in the same place (plaza, room or private conversation). Every
   * player also has a private channel with the storyteller ("dm:<playerId>"),
   * the only one players can use at night.
   */
  async handleChat(ws, message) {
    const { peerId } = ws.deserializeAttachment();
    const isStoryteller = peerId === STORYTELLER;
    switch (message.type) {
      case "hello": {
        // history: the messages this peer received, oldest first
        const messages = this.sql
          .exec(`SELECT * FROM chat ORDER BY id DESC LIMIT ${CHAT_HISTORY}`)
          .toArray()
          .filter((row) => JSON.parse(row.recipients).includes(peerId))
          .reverse()
          .map(chatMessage);
        this.send(ws, { type: "history", messages });
        break;
      }
      case "phase":
        // storyteller: day or night (players can't chat in public at night)
        if (isStoryteller && (await this.setIsNight(message.night))) {
          this.broadcastPeers();
          await this.enforce();
        }
        break;
      case "chat": {
        const text = String(message.text || "")
          .trim()
          .slice(0, MAX_MESSAGE_LENGTH);
        // info cards: storyteller only, always private
        const card =
          isStoryteller && message.to !== undefined && message.to !== null
            ? cleanCard(message.card)
            : null;
        if (!text && !card) break;
        let channel;
        let recipients;
        if (message.to !== undefined && message.to !== null) {
          // private channel between a player and the storyteller
          const to = String(message.to).slice(0, 200);
          if (to === peerId) break;
          if (!isStoryteller && to !== STORYTELLER) break;
          const player = isStoryteller ? to : peerId;
          channel = "dm:" + player;
          recipients = [STORYTELLER, player];
        } else {
          if (!isStoryteller && this.night) {
            this.send(ws, { type: "chat-error", reason: "night" });
            break;
          }
          channel = this.locationOfPeer(peerId);
          recipients = [
            ...new Set(
              this.chatSockets()
                .map((socket) => socket.deserializeAttachment().peerId)
                .filter((id) => this.locationOfPeer(id) === channel),
            ),
          ];
          if (!recipients.includes(peerId)) recipients.push(peerId);
        }
        const at = Date.now();
        const { id } = this.sql
          .exec(
            `INSERT INTO chat (at, sender, channel, text, recipients, card)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
            at,
            peerId,
            channel,
            text,
            JSON.stringify(recipients),
            card ? JSON.stringify(card) : null,
          )
          .one();
        this.sql.exec(`DELETE FROM chat WHERE id <= ?`, id - CHAT_HISTORY);
        const out = {
          type: "chat",
          message: { id, at, from: peerId, channel, text, card, seen: null },
        };
        this.chatSockets()
          .filter((socket) =>
            recipients.includes(socket.deserializeAttachment().peerId),
          )
          .forEach((socket) => this.send(socket, out));
        break;
      }
      case "card-seen": {
        // a player saw an info card: the storyteller gets a tick
        const row = this.sql
          .exec(`SELECT * FROM chat WHERE id = ?`, Number(message.id) || 0)
          .toArray()[0];
        if (!row || !row.card || row.seen) break;
        if (row.channel !== "dm:" + peerId) break;
        const seen = Date.now();
        this.sql.exec(`UPDATE chat SET seen = ? WHERE id = ?`, seen, row.id);
        const out = { type: "card-seen", id: row.id, seen };
        this.chatSockets()
          .filter((socket) =>
            [STORYTELLER, peerId].includes(
              socket.deserializeAttachment().peerId,
            ),
          )
          .forEach((socket) => this.send(socket, out));
        break;
      }
      case "clear-chat":
        // storyteller: start the next game with an empty chat
        if (!isStoryteller) break;
        this.sql.exec(`DELETE FROM chat`);
        this.chatSockets().forEach((socket) =>
          this.send(socket, { type: "cleared" }),
        );
        break;
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, "Closed");
    } catch (e) {
      // already closed
    }
    if (isChat(ws)) return;
    this.cleanUp(ws);
    this.broadcastPeers(ws);
    await this.enforce(ws);
  }

  async webSocketError(ws) {
    if (isChat(ws)) return;
    this.cleanUp(ws);
    this.broadcastPeers(ws);
    await this.enforce(ws);
  }
}
