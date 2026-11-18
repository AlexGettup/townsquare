/**
 * Voice chat client: sends the local microphone to Cloudflare Realtime (SFU)
 * and plays the microphones of everyone else in the same game session.
 *
 * One RTCPeerConnection per client: the microphone is pushed once, and each
 * remote peer's audio track is pulled through the same connection.
 * The voice server (see /voice-server) relays who is connected and proxies
 * the SFU API so its secret stays private. The server decides whose
 * microphone each client receives (only the people it may hear), and stops
 * the rest at the SFU.
 *
 * Events (callbacks passed to the constructor):
 * - onStatus(status, error)   "connecting" | "connected" | "off" | "error"
 * - onPeers(peers, self, hear) everyone else in voice, and our own entry:
 *                             { peerId, muted, location, requesting, … };
 *                             hear: the peerIds the server lets us receive
 * - onSpeaking(peerId, bool)  voice activity, also for the local peer
 * - onForceMute()             the storyteller muted us
 * - onEvent(message)          invite / request / declined / gather
 * - onMicrophoneLost()        our microphone was unplugged
 *
 * What we send goes through MicProcessor (noise suppression and voice gate,
 * like Discord) when the browser can run it, and is the raw microphone
 * otherwise.
 */
import MicProcessor, { isSupported as canProcessMic } from "./MicProcessor";

const TRACK_NAME = "microphone";
const PING_INTERVAL = 15 * 1000;
const RECONNECT_DELAY = 2000;
// nothing from the server for this long (not even the pong): the socket is
// dead without knowing it (phones changing network), so open another
const SOCKET_SILENCE = 40 * 1000;
// the audio connection "disconnected" often comes back by itself: wait
const ICE_DISCONNECTED_WAIT = 8 * 1000;
// the audio connection failed: join again after each of these, then give up
const RECOVER_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];
// errors with the microphone itself: joining again wouldn't help
const FATAL_ERRORS = [
  "InsecureContext",
  "NotAllowedError",
  "NotFoundError",
  "NotReadableError",
  "OverconstrainedError",
  "SecurityError",
];
// reports to the voice server's logs, at most this many a minute
const REPORTS_PER_MINUTE = 20;
// voice activity detection
const SPEAKING_THRESHOLD = 0.02; // RMS of the signal
const SPEAKING_HOLD = 400; // ms to keep "speaking" after the last sound

// waiting to receive someone again after it failed: doubles up to the maximum
const PULL_RETRY_DELAY = 1000;
const PULL_RETRY_MAX_DELAY = 5 * 1000;
// how long to wait for our microphone to reach the SFU before joining the room
const SENDING_TIMEOUT = 8 * 1000;
const SENDING_CHECK_INTERVAL = 150;
// someone we should hear whose audio stopped arriving (a muted microphone
// still sends silence): after this long, receive them again from scratch
const SILENT_CHECK_INTERVAL = 4 * 1000;
const SILENT_TIMEOUT = 12 * 1000;
// still silent after that (a locked phone sends nothing): wait longer each time
const SILENT_MAX_TIMEOUT = 2 * 60 * 1000;

// changes when a peer rejoins with a new connection
const remoteKey = (peer) => `${peer.peerId}/${peer.since}`;

const connectionLost = (state) => {
  const error = new Error(`audio connection ${state}`);
  error.name = "ConnectionLost";
  return error;
};

const errorText = (error) =>
  error && error.name ? `${error.name}: ${error.message}` : String(error);

export default class VoiceClient {
  constructor({
    serverUrl,
    onStatus,
    onPeers,
    onSpeaking,
    onForceMute,
    onEvent,
    onMicrophoneLost,
  }) {
    this.serverUrl = serverUrl.replace(/\/$/, "");
    this.onStatus = onStatus;
    this.onPeers = onPeers;
    this.onSpeaking = onSpeaking;
    this.onForceMute = onForceMute;
    this.onEvent = onEvent;
    this.onMicrophoneLost = onMicrophoneLost;
    // the devices chosen ("" is the system's default). Kept between calls
    this.inputId = "";
    this.outputId = "";
    // peerId -> how loud we play them (1 = as they come). Kept between calls
    this.volumes = new Map();
    // noise suppression and voice gate: { denoise, auto, threshold (dB) }
    this.processing = { denoise: true, auto: true, threshold: -50 };
    // getting back by ourselves after the connection failed (see _recover)
    this.wasConnected = false;
    this.recoverAttempt = 0;
    this.recoverTimer = null;
    this.reports = [];
    this._reset();
    // a phone back from the background, or the network back: check at once
    // instead of waiting for timers the browser may have paused
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") this._checkNow();
      });
      window.addEventListener("online", () => this._checkNow());
    }
  }

  /** Send a room message (conversations, invitations…) to the server. */
  send(message) {
    this._sendSocket(message);
  }

  _reset() {
    this.channel = null;
    this.peerId = null;
    this.muted = false;
    this.stream = null;
    // what we send: the microphone after noise suppression and the voice gate
    this.processor = null;
    this.micSender = null;
    this.micRequest = 0;
    this.pc = null;
    this.sessionId = null;
    this.socket = null;
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.lastHeard = 0;
    this.iceTimer = null;
    this.pullRetryTimer = null;
    this.pullFailures = 0;
    // the latest room state from the voice server
    this.roomPeers = [];
    this.hear = [];
    this.audioContext = null;
    this.vadTimer = null;
    this.silentTimer = null;
    // peerId -> times in a row we received them again for being silent
    this.silentRetries = new Map();
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

  // in voice chat, or getting back into it
  get isActive() {
    return !!this.pc || !!this.recoverTimer;
  }

  /**
   * Join the voice room of a game session. Must be called from a user
   * gesture (click), as browsers only allow microphone and audio then.
   */
  async join({
    channel,
    peerId,
    muted = false,
    recovering = false,
    keepPlace = false,
  }) {
    if (!recovering) {
      // joining by hand: whatever recovery was going on is over
      clearTimeout(this.recoverTimer);
      this.recoverTimer = null;
      this.recoverAttempt = 0;
      this.wasConnected = false;
    }
    // keepPlace: like a dropped connection, the server keeps where we were
    if (this.pc) this._teardown(!keepPlace);
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
      this.stream = await this._openAnyMicrophone();
      this._watchMicrophoneEnd();
      this._applyMute();
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this._applyContextOutput();
      await this.audioContext.resume();
      this.processor = await this._startProcessor(this.stream);
      // our own "speaking" ring: what the others get, after the voice gate
      this.local = this._watchVolume(new MediaStream([this._sentTrack()]));

      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      this.pc.ontrack = (event) => this._onTrack(event);
      const pc = this.pc;
      pc.onconnectionstatechange = () => {
        if (this.pc !== pc) return;
        const state = pc.connectionState;
        clearTimeout(this.iceTimer);
        if (state === "failed") {
          this._fail(connectionLost("failed"));
        } else if (state === "disconnected") {
          // usually comes back by itself in a few seconds
          this.iceTimer = setTimeout(() => {
            if (this.pc === pc && pc.connectionState === "disconnected") {
              this._fail(connectionLost("disconnected"));
            }
          }, ICE_DISCONNECTED_WAIT);
        }
      };

      const { sessionId } = await this._api("POST", "sessions/new");
      this.sessionId = sessionId;
      await this._push();
      // others pull our microphone as soon as we join the room: it has to exist
      await this._waitUntilSending();
      if (!this.pc) return;
      this._openSocket();
      this.vadTimer = setInterval(() => this._detectSpeaking(), 100);
      this.silentTimer = setInterval(
        () => this._checkSilent(),
        SILENT_CHECK_INTERVAL,
      );
      if (recovering) {
        this._report("recovered", `after ${this.recoverAttempt} attempt(s)`);
      }
      this.wasConnected = true;
      this.recoverAttempt = 0;
      this.onStatus("connected");
    } catch (error) {
      this._fail(error);
    }
  }

  async leave() {
    clearTimeout(this.recoverTimer);
    this.recoverTimer = null;
    this.recoverAttempt = 0;
    this.wasConnected = false;
    this._teardown();
    this.onPeers([]);
    this.onStatus("off");
  }

  /** Close everything of this call. `leaving`: tell the server it's on purpose. */
  _teardown(leaving = true) {
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.pullRetryTimer);
    clearTimeout(this.iceTimer);
    clearInterval(this.vadTimer);
    clearInterval(this.silentTimer);
    if (this.socket) {
      this.socket.onclose = null;
      // 1000 tells the server we left; otherwise it keeps our place a while
      if (leaving) this.socket.close(1000, "Leaving");
      else this.socket.close(4001, "Reconnecting");
    }
    this.remotes.forEach((remote) => this._disposeRemote(remote));
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
    if (this.processor) this.processor.dispose();
    if (this.pc) this.pc.close();
    if (this.audioContext) this.audioContext.close().catch(() => {});
    this._reset();
  }

  /**
   * The audio connection failed during a call: join again by ourselves, a
   * few times, waiting longer each time, before giving up with an error.
   * The server keeps our place meanwhile (the socket closes as "reconnecting").
   */
  _recover(error) {
    const { channel, peerId, muted } = this;
    const why = errorText(error);
    this._teardown(false);
    this.channel = channel;
    this.peerId = peerId;
    this.muted = muted;
    if (this.recoverAttempt >= RECOVER_DELAYS.length) {
      this._report("gave-up", why);
      this.recoverAttempt = 0;
      this.wasConnected = false;
      this.onPeers([]);
      this.onStatus("error", error && error.name ? error.name : String(error));
      return;
    }
    const delay = RECOVER_DELAYS[this.recoverAttempt++];
    this._report("recovering", `${why} (attempt ${this.recoverAttempt})`);
    this.onPeers([]);
    this.onStatus("connecting");
    this.recoverTimer = setTimeout(() => this._retryJoin(), delay);
  }

  _retryJoin() {
    clearTimeout(this.recoverTimer);
    this.recoverTimer = null;
    if (!this.channel) return;
    this.join({
      channel: this.channel,
      peerId: this.peerId,
      muted: this.muted,
      recovering: true,
    });
  }

  /** Back in the foreground or online: don't wait for timers to notice. */
  _checkNow() {
    if (this.recoverTimer) {
      this._retryJoin();
      return;
    }
    if (!this.pc) return;
    if (this.pc.connectionState === "failed") {
      this._fail(connectionLost("failed"));
      return;
    }
    const socket = this.socket;
    if (!socket || socket.readyState > WebSocket.OPEN) {
      clearTimeout(this.reconnectTimer);
      this._openSocket();
    } else if (
      socket.readyState === WebSocket.OPEN &&
      Date.now() - this.lastHeard > SOCKET_SILENCE
    ) {
      this._restartSocket("silent after the background");
    } else {
      this._sendSocket({ type: "ping" });
    }
  }

  /**
   * Tell the voice server's logs what went wrong here, which it can't see
   * (no personal data: the player ID it knows already, and the browser).
   */
  _report(event, detail = "", maxLength = 300, target = {}) {
    const channel = target.channel || this.channel;
    const peerId = target.peerId || this.peerId;
    const now = Date.now();
    this.reports = this.reports.filter((at) => now - at < 60 * 1000);
    if (this.reports.length >= REPORTS_PER_MINUTE || !channel) return;
    this.reports.push(now);
    const room = encodeURIComponent(channel);
    fetch(`${this.serverUrl}/rooms/${room}/report`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        peer: peerId,
        event,
        detail: String(detail).slice(0, maxLength),
        device: navigator.userAgent.slice(0, 200),
      }),
    }).catch(() => {});
  }

  /**
   * What this device sees of the call, for the logs: whom it should hear,
   * whether their audio arrives and whether it plays it, what it sends.
   * `extra`: what the app knows (day or night, place).
   */
  async snapshot(extra = {}) {
    if (!this.pc) return { ...extra, voice: "off" };
    const packetsOf = async (rtc, type, field) => {
      let total = 0;
      try {
        (await rtc.getStats()).forEach((report) => {
          if (report.type === type) total += report[field] || 0;
        });
      } catch (error) {
        return null;
      }
      return total;
    };
    const now = Date.now();
    const transceivers = this.pc.getTransceivers();
    const peers = {};
    for (const { peerId } of this.roomPeers) {
      const remote = this.remotes.get(peerId);
      const transceiver =
        remote && remote.mid && transceivers.find((t) => t.mid === remote.mid);
      // one short line each, to fit 20 players in a log line. Flags: H the
      // server lets us hear them, A we play them (not silenced here), C the
      // server stopped them, P pulled, > playing, M element muted (volume
      // through Web Audio, or silenced); then packets received, seconds
      // without audio and volume. "-" where a flag is off.
      const flag = (on, letter) => (on ? letter : "-");
      const hear = flag(this.hear.includes(peerId), "H");
      if (!remote) {
        peers[peerId] = `${hear} not received`;
        continue;
      }
      const packets = transceiver
        ? await packetsOf(
            transceiver.receiver,
            "inbound-rtp",
            "packetsReceived",
          )
        : null;
      const volume = this.volumes.has(peerId) ? this.volumes.get(peerId) : 1;
      peers[peerId] =
        hear +
        flag(this.audible.get(peerId) !== false, "A") +
        flag(remote.closed, "C") +
        flag(!!remote.mid, "P") +
        flag(!!remote.audio && !remote.audio.paused, ">") +
        flag(!!remote.audio && remote.audio.muted, "M") +
        ` n${packets} s${Math.round((now - remote.packetsAt) / 1000)}` +
        ` v${volume}`;
    }
    const snapshot = {
      ...extra,
      muted: this.muted,
      sent: this.micSender
        ? await packetsOf(this.micSender, "outbound-rtp", "packetsSent")
        : null,
      audioContext: this.audioContext ? this.audioContext.state : null,
      connection: this.pc.connectionState,
      ice: this.pc.iceConnectionState,
      socket: this.socket ? this.socket.readyState : null,
      peers,
    };
    return snapshot;
  }

  /**
   * "I can't hear someone": send the logs what this device sees, then
   * receive everyone again from scratch, without leaving. Returns the
   * snapshot, or null when not in voice.
   */
  async checkAudio(extra = {}) {
    if (!this.pc) return null;
    const snapshot = await this.snapshot(extra);
    this._report("no-audio", JSON.stringify(snapshot), 3000);
    if (this.audioContext && this.audioContext.state !== "running") {
      this.audioContext.resume().catch(() => {});
    }
    [...this.remotes.keys()].forEach((peerId) => this._drop(peerId));
    this._syncRemotes();
    this._checkNow();
    return snapshot;
  }

  /**
   * Leave and join again, keeping our place (the server keeps it a while
   * for a connection that drops). Must be called from a click.
   */
  async reconnect(extra = {}, target = {}) {
    // after an error we are out of the call: `target` says where to go back
    const inCall = !!this.pc;
    const channel = inCall ? this.channel : target.channel;
    const peerId = inCall ? this.peerId : target.peerId;
    if (!channel || !peerId) return;
    const snapshot = await this.snapshot(extra);
    this._report("reconnect", JSON.stringify(snapshot), 3000, {
      channel,
      peerId,
    });
    await this.join({
      channel,
      peerId,
      muted: inCall ? this.muted : !!target.muted,
      keepPlace: true,
    });
  }

  /**
   * Someone tells what went wrong, in their own words: to the logs with what
   * this device sees. Works outside voice too (`target`: the game session's
   * channel and our peerId).
   */
  async sendReport(text, extra = {}, target = {}) {
    const snapshot = await this.snapshot(extra);
    const detail = JSON.stringify({
      text: String(text || "").slice(0, 500),
      ...snapshot,
    });
    this._report("user-report", detail, 3000, target);
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
  setNight({ awake, broadcast, isNight }) {
    this.night = { awake, broadcast, isNight };
    this._sendSocket({ type: "night", awake, broadcast, isNight });
  }

  /**
   * Play or silence a peer locally. The audio keeps flowing so switching
   * (day / night, waking someone up) is instant.
   */
  setAudible(peerId, audible) {
    this.audible.set(peerId, audible);
    this._applyOutput(peerId);
  }

  /** Noise suppression and voice gate: { denoise, auto, threshold }. */
  setProcessing(processing) {
    this.processing = { ...processing };
    if (this.processor) this.processor.setOptions(this.processing);
  }

  /**
   * For the level meter: { level, threshold (dB), open, canDenoise }, or
   * null when not in voice chat or not processing the microphone.
   */
  getMicLevel() {
    if (!this.processor || !this.processor.level) return null;
    return { ...this.processor.level, canDenoise: this.processor.canDenoise };
  }

  /** How loud to play a peer: 1 is as they come, up to 2. */
  setVolume(peerId, volume) {
    this.volumes.set(peerId, volume);
    this._applyOutput(peerId);
  }

  /**
   * Use another microphone, also in the middle of a call: nobody has to
   * reconnect. If it can't be opened, the current one stays and this throws.
   */
  async setInputDevice(deviceId) {
    const previousId = this.inputId;
    this.inputId = deviceId;
    if (!this.pc || !this.micSender) return;
    const pc = this.pc;
    const request = ++this.micRequest;
    let stream;
    try {
      stream = await this._openMicrophone();
      // left voice chat, or chose another one in the meantime
      if (this.pc !== pc || request !== this.micRequest) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      // with the processor, what we send stays the same track
      if (this.processor) this.processor.setInput(stream);
      else await this.micSender.replaceTrack(stream.getAudioTracks()[0]);
    } catch (error) {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (request === this.micRequest) this.inputId = previousId;
      throw error;
    }
    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = stream;
    this._watchMicrophoneEnd();
    this._applyMute();
    if (this.processor) return;
    const { speaking, lastSound, source } = this.local;
    source.disconnect();
    this.local = { ...this._watchVolume(stream), speaking, lastSound };
  }

  /** Play everyone through this speaker, now and from now on. */
  async setOutputDevice(deviceId) {
    this.outputId = deviceId;
    this._applyContextOutput();
    const audios = [...this.remotes.values()]
      .map((remote) => remote.audio)
      .filter(Boolean);
    await Promise.all(audios.map((audio) => audio.setSinkId(deviceId)));
  }

  // --- internals -----------------------------------------------------------

  /** The microphone through MicProcessor, or null to send it raw. */
  async _startProcessor(stream) {
    if (!canProcessMic()) return null;
    const processor = new MicProcessor(this.processing);
    try {
      await processor.start(stream);
      return processor;
    } catch (error) {
      console.warn("Voice chat: sending the microphone unprocessed", error);
      processor.dispose();
      return null;
    }
  }

  _sentTrack() {
    return this.processor
      ? this.processor.track
      : this.stream.getAudioTracks()[0];
  }

  /** Exactly the device chosen: browsers may ignore a mere preference. */
  _openMicrophone(deviceId = this.inputId) {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  /** On joining, a device that is no longer there gives way to the default. */
  async _openAnyMicrophone() {
    try {
      return await this._openMicrophone();
    } catch (error) {
      if (!this.inputId || error.name !== "OverconstrainedError") throw error;
      return this._openMicrophone("");
    }
  }

  _watchMicrophoneEnd() {
    const track = this.stream.getAudioTracks()[0];
    track.onended = () => {
      if (this.stream && this.stream.getAudioTracks()[0] === track) {
        this.onMicrophoneLost();
      }
    };
  }

  // people at another volume play through Web Audio
  _applyContextOutput() {
    if (this.audioContext && this.audioContext.setSinkId) {
      this.audioContext.setSinkId(this.outputId).catch((error) => {
        console.warn("Voice chat: can't use that speaker", error);
      });
    }
  }

  _fail(error) {
    console.error("Voice chat error", error);
    const name = error && error.name ? error.name : String(error);
    // during a call, anything but the microphone itself: try again
    if (this.wasConnected && !FATAL_ERRORS.includes(name)) {
      this._recover(error);
      return;
    }
    this._report("join-failed", errorText(error));
    this.leave().then(() => this.onStatus("error", name));
  }

  _applyMute() {
    if (!this.stream) return;
    this.stream.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted;
    });
  }

  async _api(method, path, body) {
    const room = encodeURIComponent(this.channel);
    const response = await fetch(
      `${this.serverUrl}/rooms/${room}/sfu/${path}`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
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
    const transceiver = this.pc.addTransceiver(this._sentTrack(), {
      direction: "sendonly",
    });
    this.micSender = transceiver.sender;
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

  /**
   * Wait for the first packets of our microphone, or give up after a while:
   * joining late is better than not joining at all.
   */
  async _waitUntilSending() {
    const deadline = Date.now() + SENDING_TIMEOUT;
    while (this.pc && Date.now() < deadline) {
      const stats = await this.pc.getStats();
      let packets = 0;
      stats.forEach((report) => {
        if (report.type === "outbound-rtp" && report.kind === "audio") {
          packets += report.packetsSent || 0;
        }
      });
      if (packets > 0) return;
      await new Promise((resolve) =>
        setTimeout(resolve, SENDING_CHECK_INTERVAL),
      );
    }
  }

  /**
   * Receive the microphone of a remote peer. The voice server only lets us
   * pull the people we may hear, naming them by peerId.
   */
  _pull(peer) {
    const remote = {
      peerId: peer.peerId,
      key: remoteKey(peer),
      mid: null,
      audio: null,
      analyser: null,
      closed: false,
      // audio packets received so far, and when that last went up
      packets: 0,
      packetsAt: Date.now(),
    };
    this.remotes.set(peer.peerId, remote);
    return this._enqueue(async () => {
      if (!this.pc || this.remotes.get(peer.peerId) !== remote) return;
      try {
        const response = await this._api(
          "POST",
          `sessions/${this.sessionId}/tracks/new`,
          { tracks: [{ location: "remote", peerId: peer.peerId }] },
        );
        const track = (response.tracks || [])[0];
        if (!track || track.errorCode) {
          throw new Error(track ? track.errorDescription : "no track");
        }
        remote.mid = track.mid;
        await this._renegotiateIfNeeded(response);
        this.pullFailures = 0;
      } catch (error) {
        // not allowed (any more), or someone who just joined and isn't sending
        // audio yet: nothing else may happen in the room, so try again later
        if (this.remotes.get(peer.peerId) === remote && !remote.mid) {
          this.remotes.delete(peer.peerId);
          this._schedulePullRetry();
        }
        this._report("pull-failed", `${peer.peerId}: ${errorText(error)}`);
        throw error;
      }
      // the track may have arrived during the negotiation
      if (this.pendingStreams.has(remote.mid)) {
        this._attach(remote, this.pendingStreams.get(remote.mid));
        this.pendingStreams.delete(remote.mid);
      }
    });
  }

  _schedulePullRetry() {
    if (this.pullRetryTimer) return;
    const delay = Math.min(
      PULL_RETRY_DELAY * 2 ** this.pullFailures,
      PULL_RETRY_MAX_DELAY,
    );
    this.pullFailures++;
    this.pullRetryTimer = setTimeout(() => {
      this.pullRetryTimer = null;
      this._syncRemotes();
    }, delay);
  }

  /**
   * We may hear a peer again (back in the same place, woken up…): reuse the
   * transceiver the server stopped, or pull again if that fails.
   */
  _reopen(peer) {
    const remote = this.remotes.get(peer.peerId);
    remote.closed = false;
    // still being pulled: nothing to reopen yet
    if (!remote.mid) return;
    return this._enqueue(async () => {
      if (!this.pc || this.remotes.get(peer.peerId) !== remote) return;
      if (remote.closed) return;
      try {
        const response = await this._api(
          "PUT",
          `sessions/${this.sessionId}/tracks/update`,
          {
            tracks: [
              { location: "remote", mid: remote.mid, peerId: peer.peerId },
            ],
          },
        );
        const track = (response.tracks || [])[0];
        if (track && track.errorCode) throw new Error(track.errorDescription);
        await this._renegotiateIfNeeded(response);
      } catch (error) {
        console.warn("Voice chat: reopening failed, pulling again", error);
        if (this.remotes.get(peer.peerId) !== remote) return;
        this.remotes.delete(peer.peerId);
        this._disposeRemote(remote);
        this._pull(peer);
      }
    });
  }

  /** The server stopped forwarding this peer: we can't hear them now. */
  _markClosed(peerId) {
    const remote = this.remotes.get(peerId);
    if (!remote || remote.closed) return;
    remote.closed = true;
    if (remote.speaking) {
      remote.speaking = false;
      this.onSpeaking(peerId, false);
    }
  }

  async _renegotiateIfNeeded(response) {
    if (!response.requiresImmediateRenegotiation) return;
    await this.pc.setRemoteDescription(response.sessionDescription);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this._api("PUT", `sessions/${this.sessionId}/renegotiate`, {
      sessionDescription: {
        type: "answer",
        sdp: this.pc.localDescription.sdp,
      },
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
      if (remote.closed) {
        // already stopped by the server: just forget it
        await this._api("PUT", `sessions/${this.sessionId}/tracks/close`, {
          tracks: [{ mid: remote.mid }],
          force: true,
        }).catch(() => {});
        return;
      }
      transceiver.direction = "inactive";
      await this.pc.setLocalDescription(await this.pc.createOffer());
      try {
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
      } catch (error) {
        // don't leave the connection waiting for an answer
        await this.pc.setLocalDescription({ type: "rollback" }).catch(() => {});
        throw error;
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
    if (this.outputId && audio.setSinkId) {
      audio.setSinkId(this.outputId).catch((error) => {
        console.warn("Voice chat: can't use that speaker", error);
      });
    }
    audio.play().catch(() => {});
    remote.audio = audio;
    Object.assign(remote, this._watchVolume(stream));
    this._applyOutput(remote.peerId);
  }

  /**
   * Play a peer as they should sound now. At their normal volume they stay on
   * the audio element alone, which browsers cancel the echo of most reliably.
   * Any other volume goes through Web Audio: iPhones ignore an element's
   * volume, and nothing else can go above 100%. The element has to stay
   * attached, muted, or Chrome stops delivering the stream.
   */
  _applyOutput(peerId) {
    const remote = this.remotes.get(peerId);
    if (!remote || !remote.audio) return;
    const audible = this.audible.get(peerId) !== false;
    const volume = this.volumes.has(peerId) ? this.volumes.get(peerId) : 1;
    const isAdjusted = volume !== 1;
    if (isAdjusted && !remote.gain) {
      remote.gain = this.audioContext.createGain();
      remote.source.connect(remote.gain);
      remote.gain.connect(this.audioContext.destination);
    }
    remote.audio.muted = isAdjusted || !audible;
    if (remote.gain)
      remote.gain.gain.value = isAdjusted && audible ? volume : 0;
  }

  _disposeRemote(remote) {
    if (remote.audio) {
      remote.audio.pause();
      remote.audio.srcObject = null;
    }
    if (remote.source) remote.source.disconnect();
    if (remote.gain) remote.gain.disconnect();
  }

  /**
   * Room state from the voice server: receive whoever we may hear ("hear",
   * decided by the server), stop the rest, drop who left.
   */
  _onPeers(peers, hear = []) {
    this.roomPeers = peers.filter((peer) => peer.peerId !== this.peerId);
    this.hear = hear;
    this._syncRemotes();
    const others = this.roomPeers;
    const visible = ({
      peerId,
      muted,
      awake,
      broadcast,
      location,
      requesting,
    }) => ({
      peerId,
      muted,
      awake: awake || [],
      broadcast: !!broadcast,
      location: location || "plaza",
      requesting: requesting || null,
    });
    const self = peers.find((peer) => peer.peerId === this.peerId);
    this.onPeers(others.map(visible), self ? visible(self) : null, hear);
  }

  /** Match what we receive to the latest room state. */
  _syncRemotes() {
    if (!this.pc) return;
    this.roomPeers.forEach((peer) => {
      const remote = this.remotes.get(peer.peerId);
      if (remote && remote.key !== remoteKey(peer)) this._drop(peer.peerId);
      if (!this.hear.includes(peer.peerId)) {
        this._markClosed(peer.peerId);
      } else if (!this.remotes.has(peer.peerId)) {
        this._pull(peer);
      } else if (this.remotes.get(peer.peerId).closed) {
        this._reopen(peer);
      }
    });
    [...this.remotes.keys()].forEach((peerId) => {
      if (!this.roomPeers.some((peer) => peer.peerId === peerId)) {
        this._drop(peerId);
      }
    });
  }

  /**
   * Receive again anyone we should hear whose audio stopped arriving. Both
   * ends may believe the audio is flowing when it isn't (a connection lost
   * halfway through receiving someone), and nothing else would notice until
   * people moved somewhere else. A muted microphone still sends silence, so
   * no packets at all means it's broken.
   */
  async _checkSilent() {
    if (!this.pc) return;
    const now = Date.now();
    // in the background a phone may stop receiving: start counting again
    if (typeof document !== "undefined" && document.hidden) {
      this.remotes.forEach((remote) => (remote.packetsAt = now));
      return;
    }
    const transceivers = this.pc.getTransceivers();
    for (const remote of [...this.remotes.values()]) {
      if (!remote.mid || remote.closed) {
        remote.packetsAt = now;
        continue;
      }
      const transceiver = transceivers.find((t) => t.mid === remote.mid);
      if (!transceiver) continue;
      let packets = 0;
      try {
        const stats = await transceiver.receiver.getStats();
        stats.forEach((report) => {
          if (report.type === "inbound-rtp") packets += report.packetsReceived;
        });
      } catch (error) {
        continue;
      }
      if (this.remotes.get(remote.peerId) !== remote) continue;
      const retries = this.silentRetries.get(remote.peerId) || 0;
      const timeout = Math.min(
        SILENT_TIMEOUT * 2 ** retries,
        SILENT_MAX_TIMEOUT,
      );
      if (packets > remote.packets) {
        remote.packets = packets;
        remote.packetsAt = now;
        this.silentRetries.delete(remote.peerId);
      } else if (now - remote.packetsAt > timeout) {
        this.silentRetries.set(remote.peerId, retries + 1);
        this._report(
          "silent-track",
          `${remote.peerId}: no audio for ${Math.round(
            (now - remote.packetsAt) / 1000,
          )} s, receiving again`,
        );
        this._drop(remote.peerId);
        this._syncRemotes();
      }
    }
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
      this.lastHeard = Date.now();
      this._sendSocket({
        type: "join",
        sessionId: this.sessionId,
        trackName: TRACK_NAME,
        muted: this.muted,
      });
      if (this.night) this._sendSocket({ type: "night", ...this.night });
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastHeard > SOCKET_SILENCE) {
          this._restartSocket("no answer from the server");
        } else {
          this._sendSocket({ type: "ping" });
        }
      }, PING_INTERVAL);
    };
    socket.onmessage = ({ data }) => {
      this.lastHeard = Date.now();
      let message;
      try {
        message = JSON.parse(data);
      } catch (e) {
        return;
      }
      if (message.type === "pong") return;
      if (message.type === "peers") {
        this._onPeers(message.peers, message.hear);
      } else if (message.type === "mute") this.onForceMute();
      // invitations, join requests, declines, gathering in the plaza
      else this.onEvent(message);
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

  /**
   * The socket looks open but nothing comes through: drop it and open
   * another. Closed as "reconnecting", so the server keeps our place.
   */
  _restartSocket(why) {
    this._report("socket-restart", why);
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close(4001, "Reconnecting");
    }
    if (this.pc) this._openSocket();
  }

  _sendSocket(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
