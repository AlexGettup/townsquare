/**
 * Live session: the game's sync between the storyteller and the players
 * (seats, characters, votes, info cards…). It replaces the original project's
 * server (clocktower.live), so the app no longer depends on it.
 *
 * /live/<channel>/<playerId>?secret=<secret>  WebSocket, one LiveRoom per
 * channel. The storyteller connects as "host". The room only relays
 * messages, as the original server did:
 * - ["ping", …]: player → storyteller, storyteller → every player
 * - ["direct", { <playerId>: [command, params] }]: each to its player only
 * - anything else: to everyone else in the session
 *
 * ["rtt"] is answered with ["rtt"] without waking the room, so clients
 * measure their own latency (and keep the socket alive) for free.
 *
 * Uses the hibernation API, so an idle room costs nothing.
 */

const HOST = "host";
// a client measures its latency (["rtt"]) every 30 s: twice that without one
// and its socket is dead, whatever the edge still thinks
const ALIVE_FOR = 65 * 1000;
// the original server's limit: 5 messages a second, counted over 30 s
const RATE_WINDOW = 30 * 1000;
const RATE_LIMIT = 5 * 30;
// a whole gamestate with a big custom script stays far below this
const MAX_MESSAGE = 512 * 1024;

// player IDs are "__s_" + SHA-256(PEPPER + secret), so nobody can take
// someone else's ID without their secret (same pepper as the client)
const PEPPER = [
  155, 113, 7, 193, 229, 225, 124, 147, 153, 27, 254, 60, 164, 234, 108, 10,
];

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "===".slice((base64.length + 3) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** Whether the secret proves the player ID (IDs without "__s_" aren't checked). */
export const isPlayerIdValid = async (playerId, secret) => {
  if (!playerId.startsWith("__s_")) return true;
  if (!secret) return false;
  let raw;
  try {
    raw = fromBase64Url(secret);
  } catch (e) {
    return false;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array([...PEPPER, ...raw]),
  );
  return playerId === "__s_" + toBase64Url(new Uint8Array(digest));
};

// one log line, as JSON, so Workers Logs can filter by its fields
const log = (event, fields) =>
  console.log(JSON.stringify({ event, ...fields }));

/**
 * Open the socket only to close it, telling the client why (the app shows
 * the reason). Not a hibernatable socket: its close must complete here.
 */
const refuse = (reason) => {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.close(1000, reason);
  return new Response(null, { status: 101, webSocket: client });
};

export class LiveRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('["rtt"]', '["rtt"]'),
    );
    // messages per socket in the current window (lost on hibernation, which
    // only happens to quiet rooms)
    this.rates = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/live\/([^/]+)\/([^/]+)$/);
    if (!match) return new Response("Not found", { status: 404 });
    const channel = decodeURIComponent(match[1]).toLowerCase();
    const playerId = decodeURIComponent(match[2]);
    // it's the socket's tag, which can't be longer than 256
    if (!playerId || playerId.length > 200) {
      return new Response("Bad player", { status: 400 });
    }

    if (!(await isPlayerIdValid(playerId, url.searchParams.get("secret")))) {
      log("live-refused", { channel, why: "secret" });
      return refuse("Player secret failed to validate.");
    }
    if (playerId === HOST) {
      const others = this.ctx.getWebSockets(HOST);
      if (others.some((ws) => this.isAlive(ws))) {
        log("live-refused", { channel, why: "host" });
        return refuse(`The channel "${channel}" already has a host`);
      }
      // a storyteller's old connection nobody closed (a phone that lost the
      // network): the storyteller coming back takes over
      others.forEach((ws) => ws.close(1000, "Replaced by a new connection"));
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [playerId]);
    server.serializeAttachment({ playerId, at: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Whether a socket's client is still there (it measured its latency lately). */
  isAlive(ws) {
    const { at } = ws.deserializeAttachment() || {};
    const rtt = this.ctx.getWebSocketAutoResponseTimestamp(ws);
    const last = Math.max(at || 0, rtt ? rtt.getTime() : 0);
    return Date.now() - last < ALIVE_FOR;
  }

  /** Count a message; false once the socket sent too many. */
  withinRate(ws) {
    const now = Date.now();
    const rate = this.rates.get(ws);
    if (!rate || now - rate.since > RATE_WINDOW) {
      this.rates.set(ws, { since: now, count: 1 });
      return true;
    }
    rate.count++;
    return rate.count <= RATE_LIMIT;
  }

  send(ws, data) {
    try {
      ws.send(data);
    } catch (e) {
      // closing already
    }
  }

  webSocketMessage(ws, data) {
    if (typeof data !== "string" || data.length > MAX_MESSAGE) return;
    const { playerId } = ws.deserializeAttachment() || {};
    if (!this.withinRate(ws)) {
      log("live-refused", { why: "spam" });
      this.rates.delete(ws);
      ws.close(
        1000,
        "Your app seems to be malfunctioning, please clear your browser cache.",
      );
      return;
    }
    // the command is the first element: ["ping", …], ["direct", …]
    const command = (data.match(/^\s*\[\s*"([^"]*)"/) || [])[1];
    const others = this.ctx.getWebSockets().filter((other) => other !== ws);
    if (command === "ping") {
      // storyteller → everyone, player → storyteller
      others
        .filter(
          (other) =>
            playerId === HOST ||
            (other.deserializeAttachment() || {}).playerId === HOST,
        )
        .forEach((other) => this.send(other, data));
    } else if (command === "direct") {
      let messages;
      try {
        messages = JSON.parse(data)[1];
      } catch (e) {
        return;
      }
      if (!messages || typeof messages !== "object") return;
      Object.keys(messages).forEach((to) => {
        const message = JSON.stringify(messages[to]);
        this.ctx
          .getWebSockets(to)
          .filter((other) => other !== ws)
          .forEach((other) => this.send(other, message));
      });
    } else {
      others.forEach((other) => this.send(other, data));
    }
  }

  webSocketClose(ws) {
    this.rates.delete(ws);
    try {
      ws.close(1000);
    } catch (e) {
      // closed already
    }
  }

  webSocketError(ws) {
    this.rates.delete(ws);
  }
}
