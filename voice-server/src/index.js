/**
 * Townsquare voice server (Cloudflare Worker).
 *
 * - /rooms/<channel>/ws?peer=<peerId>  WebSocket into the VoiceRoom of a game
 *   session: tells every client who is connected to voice and which audio
 *   track to pull from Cloudflare Realtime for each of them.
 * - /sfu/...  proxy to the Cloudflare Realtime SFU API, so the app secret
 *   never reaches the browser.
 *
 * Secrets (set with `wrangler secret put`): CF_APP_ID, CF_APP_TOKEN.
 */

const SFU_API = "https://rtc.live.cloudflare.com/v1/apps";

// SFU endpoints the app is allowed to call through the proxy
const SFU_ROUTES = [
  ["POST", /^sessions\/new$/],
  ["POST", /^sessions\/[\w-]+\/tracks\/new$/],
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

async function proxySfu(request, env, path) {
  const allowed = SFU_ROUTES.some(
    ([method, pattern]) => request.method === method && pattern.test(path),
  );
  if (!allowed) return new Response("Not found", { status: 404 });
  return fetch(`${SFU_API}/${env.CF_APP_ID}/${path}`, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${env.CF_APP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: request.method === "GET" ? undefined : await request.text(),
  });
}

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

    const room = url.pathname.match(/^\/rooms\/([^/]+)\/ws$/);
    if (room) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected a WebSocket", { status: 426 });
      }
      const channel = decodeURIComponent(room[1]).toLowerCase();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(channel));
      return stub.fetch(request);
    }

    if (url.pathname.startsWith("/sfu/")) {
      const path = url.pathname.slice("/sfu/".length);
      return withCors(await proxySfu(request, env, path), origin);
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
// clients connected before conversations existed lack these fields
const withDefaults = (state) => ({
  location: PLAZA,
  requesting: null,
  invitedBy: [],
  ...state,
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
  constructor(ctx) {
    this.ctx = ctx;
    // answer keepalive pings without waking the object up
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'),
    );
  }

  async fetch(request) {
    const peerId = new URL(request.url).searchParams.get("peer");
    if (!peerId || peerId.length > 200) {
      return new Response("Missing peer", { status: 400 });
    }
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
        return visible;
      });
  }

  sockets(except) {
    return this.ctx.getWebSockets().filter((ws) => ws !== except);
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
    const message = JSON.stringify({
      type: "peers",
      peers: this.peers(except),
    });
    this.ctx.getWebSockets().forEach((ws) => {
      if (ws === except) return;
      try {
        ws.send(message);
      } catch (e) {
        // socket is closing
      }
    });
  }

  async webSocketMessage(ws, data) {
    let message;
    try {
      message = JSON.parse(data);
    } catch (e) {
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
        this.broadcastPeers();
        break;
      default:
        if (this.handleConversation(ws, me, message)) {
          this.cleanUp();
          this.broadcastPeers();
        }
    }
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

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, "Closed");
    } catch (e) {
      // already closed
    }
    this.cleanUp(ws);
    this.broadcastPeers(ws);
  }

  async webSocketError(ws) {
    this.cleanUp(ws);
    this.broadcastPeers(ws);
  }
}
