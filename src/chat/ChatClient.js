const PING_INTERVAL = 30 * 1000;
const RECONNECT_DELAY = 3000;

/**
 * Text chat connection to the voice server's room for a game session. It
 * doesn't need the microphone: everyone in a live session is connected.
 *
 * Server messages: history (on connect), chat (a new message), cleared
 * (the storyteller emptied the chat) and chat-error.
 */
export default class ChatClient {
  constructor({
    serverUrl,
    onStatus,
    onHistory,
    onMessage,
    onCleared,
    onError,
  }) {
    this.serverUrl = serverUrl;
    this.onStatus = onStatus;
    this.onHistory = onHistory;
    this.onMessage = onMessage;
    this.onCleared = onCleared;
    this.onError = onError;
    this.socket = null;
    this.target = null;
    this.night = null;
    this.pingTimer = null;
    this.reconnectTimer = null;
  }

  /** Connect to a session's chat as peerId (reconnects if it changed). */
  connect(channel, peerId) {
    if (
      this.target &&
      this.target.channel === channel &&
      this.target.peerId === peerId
    ) {
      return;
    }
    this.disconnect();
    this.target = { channel, peerId };
    this._open();
  }

  disconnect() {
    this.target = null;
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close(1000, "Leaving");
      this.socket = null;
    }
    this.onStatus("off");
  }

  /** Storyteller only: tell the server whether it is night. */
  setNight(night) {
    this.night = night;
    this._send({ type: "phase", night });
  }

  /** Write in our current place, or privately (to = peerId). */
  sendMessage(text, to = null) {
    this._send({ type: "chat", text, to });
  }

  clear() {
    this._send({ type: "clear-chat" });
  }

  _open() {
    const { channel, peerId } = this.target;
    const url =
      this.serverUrl.replace(/^http/, "ws") +
      `/rooms/${encodeURIComponent(channel)}/chat?peer=` +
      encodeURIComponent(peerId);
    this.onStatus("connecting");
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      this._send({ type: "hello" });
      if (this.night !== null && peerId === "host") {
        this._send({ type: "phase", night: this.night });
      }
      this.onStatus("connected");
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(
        () => this._send({ type: "ping" }),
        PING_INTERVAL,
      );
    };
    socket.onmessage = ({ data }) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch (e) {
        return;
      }
      switch (message.type) {
        case "history":
          this.onHistory(message.messages || []);
          break;
        case "chat":
          this.onMessage(message.message);
          break;
        case "cleared":
          this.onCleared();
          break;
        case "chat-error":
          this.onError(message.reason);
          break;
      }
    };
    socket.onclose = (event) => {
      clearInterval(this.pingTimer);
      if (this.socket !== socket) return;
      this.socket = null;
      // the same player opened the game in another tab
      if (event.code === 4000) {
        this.target = null;
        this.onStatus("error");
        return;
      }
      if (!this.target) return;
      this.onStatus("connecting");
      this.reconnectTimer = setTimeout(() => {
        if (this.target) this._open();
      }, RECONNECT_DELAY);
    };
  }

  _send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
