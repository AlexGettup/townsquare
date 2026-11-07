/**
 * Voice chat client: sends the local microphone to Cloudflare Realtime (SFU)
 * and plays the microphones of everyone else in the same game session.
 *
 * One RTCPeerConnection per client: the microphone is pushed once, and each
 * remote peer's audio track is pulled through the same connection.
 * The voice server (see /voice-server) relays who is connected and proxies
 * the SFU API so its secret stays private.
 *
 * Events (callbacks passed to the constructor):
 * - onStatus(status, error)   "connecting" | "connected" | "off" | "error"
 * - onPeers(peers)            [{ peerId, muted }] for everyone else in voice
 * - onSpeaking(peerId, bool)  voice activity, also for the local peer
 * - onForceMute()             the storyteller muted us
 */

const TRACK_NAME = "microphone";
const PING_INTERVAL = 30 * 1000;
const RECONNECT_DELAY = 2000;
// voice activity detection
const SPEAKING_THRESHOLD = 0.02; // RMS of the signal
const SPEAKING_HOLD = 400; // ms to keep "speaking" after the last sound

export default class VoiceClient {
  constructor({ serverUrl, onStatus, onPeers, onSpeaking, onForceMute }) {
    this.serverUrl = serverUrl.replace(/\/$/, "");
    this.onStatus = onStatus;
    this.onPeers = onPeers;
    this.onSpeaking = onSpeaking;
    this.onForceMute = onForceMute;
    this._reset();
  }

  _reset() {
    this.channel = null;
    this.peerId = null;
    this.muted = false;
    this.stream = null;
    this.pc = null;
    this.sessionId = null;
    this.socket = null;
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.audioContext = null;
    this.vadTimer = null;
    // serializes SDP negotiations, which can't run concurrently
    this.queue = Promise.resolve();
    // peerId -> { key, mid, audio, analyser, speaking, lastSound }
    this.remotes = new Map();
    // mid -> MediaStream received before we knew whose it was
    this.pendingStreams = new Map();
    this.local = null;
    // peerId -> false for people we must not hear right now (e.g. at night)
    this.audible = new Map();
    // storyteller only: { awake, broadcast }, resent after reconnecting
    this.night = null;
  }

  get isActive() {
    return !!this.pc;
  }

  /**
   * Join the voice room of a game session. Must be called from a user
   * gesture (click), as browsers only allow microphone and audio then.
   */
  async join({ channel, peerId, muted = false }) {
    if (this.pc) await this.leave();
    this.channel = channel;
    this.peerId = peerId;
    this.muted = muted;
    this.onStatus("connecting");
    try {
      // browsers only expose the microphone on HTTPS (or localhost)
      if (!navigator.mediaDevices || !window.RTCPeerConnection) {
        const error = new Error("Microphone requires HTTPS");
        error.name = "InsecureContext";
        throw error;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this._applyMute();
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      await this.audioContext.resume();
      this.local = this._watchVolume(this.stream);

      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      this.pc.ontrack = (event) => this._onTrack(event);
      this.pc.onconnectionstatechange = () => {
        if (this.pc && this.pc.connectionState === "failed") {
          this._fail(new Error("connection-lost"));
        }
      };

      const { sessionId } = await this._api("POST", "sessions/new");
      this.sessionId = sessionId;
      await this._push();
      this._openSocket();
      this.vadTimer = setInterval(() => this._detectSpeaking(), 100);
      this.onStatus("connected");
    } catch (error) {
      this._fail(error);
    }
  }

  async leave() {
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    clearInterval(this.vadTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close(1000, "Leaving");
    }
    this.remotes.forEach((remote) => this._disposeRemote(remote));
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
    if (this.pc) this.pc.close();
    if (this.audioContext) this.audioContext.close().catch(() => {});
    this._reset();
    this.onPeers([]);
    this.onStatus("off");
  }

  setMuted(muted) {
    this.muted = muted;
    this._applyMute();
    this._sendSocket({ type: "update", muted });
  }

  /** Storyteller only: ask another peer's client to mute itself. */
  muteRemote(peerId) {
    this._sendSocket({ type: "mute", peerId });
  }

  /** Storyteller only: share who is awake at night and the broadcast mode. */
  setNight({ awake, broadcast }) {
    this.night = { awake, broadcast };
    this._sendSocket({ type: "night", awake, broadcast });
  }

  /**
   * Play or silence a peer locally. The audio keeps flowing so switching
   * (day / night, waking someone up) is instant.
   */
  setAudible(peerId, audible) {
    this.audible.set(peerId, audible);
    const remote = this.remotes.get(peerId);
    if (remote && remote.audio) remote.audio.muted = !audible;
  }

  // --- internals -----------------------------------------------------------

  _fail(error) {
    console.error("Voice chat error", error);
    const message = error && error.name ? error.name : String(error);
    this.leave().then(() => this.onStatus("error", message));
  }

  _applyMute() {
    if (!this.stream) return;
    this.stream.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted;
    });
  }

  async _api(method, path, body) {
    const response = await fetch(`${this.serverUrl}/sfu/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.errorCode) {
      throw new Error(data.errorDescription || `SFU ${response.status}`);
    }
    return data;
  }

  _enqueue(task) {
    this.queue = this.queue.then(task).catch((error) => {
      console.error("Voice chat negotiation error", error);
    });
    return this.queue;
  }

  /** Send our microphone to the SFU. */
  async _push() {
    const transceiver = this.pc.addTransceiver(
      this.stream.getAudioTracks()[0],
      {
        direction: "sendonly",
      },
    );
    await this.pc.setLocalDescription(await this.pc.createOffer());
    const response = await this._api(
      "POST",
      `sessions/${this.sessionId}/tracks/new`,
      {
        sessionDescription: {
          type: "offer",
          sdp: this.pc.localDescription.sdp,
        },
        tracks: [
          { location: "local", mid: transceiver.mid, trackName: TRACK_NAME },
        ],
      },
    );
    await this.pc.setRemoteDescription(response.sessionDescription);
  }

  /** Receive the microphone of a remote peer. */
  _pull(peer) {
    const key = `${peer.sessionId}/${peer.trackName}`;
    const remote = {
      peerId: peer.peerId,
      key,
      mid: null,
      audio: null,
      analyser: null,
    };
    this.remotes.set(peer.peerId, remote);
    return this._enqueue(async () => {
      if (!this.pc || this.remotes.get(peer.peerId) !== remote) return;
      const response = await this._api(
        "POST",
        `sessions/${this.sessionId}/tracks/new`,
        {
          tracks: [
            {
              location: "remote",
              sessionId: peer.sessionId,
              trackName: peer.trackName,
            },
          ],
        },
      );
      const track = (response.tracks || [])[0];
      if (!track || track.errorCode) {
        throw new Error(track ? track.errorDescription : "no track");
      }
      remote.mid = track.mid;
      if (response.requiresImmediateRenegotiation) {
        await this.pc.setRemoteDescription(response.sessionDescription);
        await this.pc.setLocalDescription(await this.pc.createAnswer());
        await this._api("PUT", `sessions/${this.sessionId}/renegotiate`, {
          sessionDescription: {
            type: "answer",
            sdp: this.pc.localDescription.sdp,
          },
        });
      }
      // the track may have arrived during the negotiation
      if (this.pendingStreams.has(remote.mid)) {
        this._attach(remote, this.pendingStreams.get(remote.mid));
        this.pendingStreams.delete(remote.mid);
      }
    });
  }

  /** Stop receiving a peer that left (or reconnected with a new session). */
  _drop(peerId) {
    const remote = this.remotes.get(peerId);
    if (!remote) return;
    this.remotes.delete(peerId);
    this._disposeRemote(remote);
    if (remote.speaking) this.onSpeaking(peerId, false);
    if (!remote.mid) return;
    this._enqueue(async () => {
      if (!this.pc) return;
      const transceiver = this.pc
        .getTransceivers()
        .find((t) => t.mid === remote.mid);
      if (!transceiver) return;
      transceiver.direction = "inactive";
      await this.pc.setLocalDescription(await this.pc.createOffer());
      const response = await this._api(
        "PUT",
        `sessions/${this.sessionId}/tracks/close`,
        {
          tracks: [{ mid: remote.mid }],
          sessionDescription: {
            type: "offer",
            sdp: this.pc.localDescription.sdp,
          },
          force: false,
        },
      );
      if (response.sessionDescription) {
        await this.pc.setRemoteDescription(response.sessionDescription);
      }
    });
  }

  _onTrack(event) {
    const mid = event.transceiver.mid;
    const stream = event.streams[0] || new MediaStream([event.track]);
    for (const remote of this.remotes.values()) {
      if (remote.mid === mid) {
        this._attach(remote, stream);
        return;
      }
    }
    this.pendingStreams.set(mid, stream);
  }

  _attach(remote, stream) {
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = this.audible.get(remote.peerId) === false;
    audio.srcObject = stream;
    audio.play().catch(() => {});
    remote.audio = audio;
    Object.assign(remote, this._watchVolume(stream));
  }

  _disposeRemote(remote) {
    if (remote.audio) {
      remote.audio.pause();
      remote.audio.srcObject = null;
    }
    if (remote.source) remote.source.disconnect();
  }

  /** Room state from the voice server: pull new peers, drop gone ones. */
  _onPeers(peers) {
    const others = peers.filter((peer) => peer.peerId !== this.peerId);
    others.forEach((peer) => {
      const remote = this.remotes.get(peer.peerId);
      const key = `${peer.sessionId}/${peer.trackName}`;
      if (remote && remote.key !== key) this._drop(peer.peerId);
      if (!this.remotes.has(peer.peerId)) this._pull(peer);
    });
    [...this.remotes.keys()].forEach((peerId) => {
      if (!others.some((peer) => peer.peerId === peerId)) this._drop(peerId);
    });
    this.onPeers(
      others.map(({ peerId, muted, awake, broadcast }) => ({
        peerId,
        muted,
        awake: awake || [],
        broadcast: !!broadcast,
      })),
    );
  }

  // --- voice activity detection --------------------------------------------

  _watchVolume(stream) {
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    return {
      source,
      analyser,
      buffer: new Float32Array(analyser.fftSize),
      speaking: false,
      lastSound: 0,
    };
  }

  _isLoud(meter) {
    meter.analyser.getFloatTimeDomainData(meter.buffer);
    let sum = 0;
    for (let i = 0; i < meter.buffer.length; i++) {
      sum += meter.buffer[i] * meter.buffer[i];
    }
    return Math.sqrt(sum / meter.buffer.length) > SPEAKING_THRESHOLD;
  }

  _updateSpeaking(peerId, meter, forceSilent = false) {
    const now = Date.now();
    if (!forceSilent && this._isLoud(meter)) meter.lastSound = now;
    const speaking = !forceSilent && now - meter.lastSound < SPEAKING_HOLD;
    if (speaking !== meter.speaking) {
      meter.speaking = speaking;
      this.onSpeaking(peerId, speaking);
    }
  }

  _detectSpeaking() {
    if (this.local) this._updateSpeaking(this.peerId, this.local, this.muted);
    this.remotes.forEach((remote, peerId) => {
      if (remote.analyser) this._updateSpeaking(peerId, remote);
    });
  }

  // --- room WebSocket ------------------------------------------------------

  _openSocket() {
    const url =
      this.serverUrl.replace(/^http/, "ws") +
      `/rooms/${encodeURIComponent(this.channel)}/ws?peer=` +
      encodeURIComponent(this.peerId);
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      this._sendSocket({
        type: "join",
        sessionId: this.sessionId,
        trackName: TRACK_NAME,
        muted: this.muted,
      });
      if (this.night) this._sendSocket({ type: "night", ...this.night });
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(
        () => this._sendSocket({ type: "ping" }),
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
      if (message.type === "peers") this._onPeers(message.peers);
      if (message.type === "mute") this.onForceMute();
    };
    socket.onclose = (event) => {
      clearInterval(this.pingTimer);
      // replaced by the same player in another tab: stop here
      if (event.code === 4000) {
        this.leave().then(() => this.onStatus("error", "Replaced"));
        return;
      }
      // otherwise keep the audio connection and rejoin the room
      if (this.pc) {
        this.reconnectTimer = setTimeout(
          () => this._openSocket(),
          RECONNECT_DELAY,
        );
      }
    };
  }

  _sendSocket(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
