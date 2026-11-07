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

/**
 * One VoiceRoom per game session. Every connected client has a WebSocket
 * whose attachment holds its voice state:
 * { peerId, sessionId, trackName, muted }
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
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  // everyone currently sending audio, except an optional closing socket
  peers(except) {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== except)
      .map((ws) => ws.deserializeAttachment())
      .filter((peer) => peer && peer.sessionId);
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
    const me = ws.deserializeAttachment();
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
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, "Closed");
    } catch (e) {
      // already closed
    }
    this.broadcastPeers(ws);
  }

  async webSocketError(ws) {
    this.broadcastPeers(ws);
  }
}
