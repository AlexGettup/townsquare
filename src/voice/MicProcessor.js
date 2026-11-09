import {
  RnnoiseWorkletNode,
  loadRnnoise,
} from "@sapphi-red/web-noise-suppressor";

/**
 * What we send to voice chat instead of the raw microphone, like Discord:
 *
 *   microphone → noise suppression (RNNoise, optional) → voice gate → track
 *              ↘ a little of the original (with RNNoise) ↗
 *
 * - RNNoise removes background noise (fans, keyboards…) also while talking.
 *   It only works at 48 kHz: when the browser can't run that, it's left out.
 * - The voice gate (public/voice/voiceGate.js) sends silence while nobody
 *   talks, with an automatic or manual threshold.
 *
 * The track it gives stays the same for the whole call: changing the
 * microphone or the settings only rewires what goes into it.
 */
const FILES = process.env.BASE_URL + "voice/";
// RNNoise can eat a soft voice close to the noise level: a little of the
// original microphone goes along with it (-10 dB), so a voice never vanishes.
// The gate still sends silence between sentences.
const DRY_MIX = 0.3;
// RNNoise's delay (512 samples of buffering + one 480 sample frame at 48 kHz),
// so the original lines up with it
const RNNOISE_DELAY = (512 + 480) / 48000;

let rnnoiseBinary = null;
const loadRnnoiseBinary = () => {
  if (!rnnoiseBinary) {
    rnnoiseBinary = loadRnnoise({
      url: FILES + "rnnoise.wasm",
      simdUrl: FILES + "rnnoise_simd.wasm",
    }).catch((error) => {
      rnnoiseBinary = null;
      throw error;
    });
  }
  return rnnoiseBinary;
};

export const isSupported = () =>
  typeof window !== "undefined" &&
  !!window.AudioContext &&
  typeof window.AudioWorkletNode !== "undefined";

export default class MicProcessor {
  /** options: { denoise, auto, threshold (dB) } */
  constructor(options) {
    this.options = { ...options };
    // { level, threshold, open } from the gate, every 50 ms
    this.level = null;
    // false when this browser can't run the noise suppression
    this.canDenoise = false;
    this.context = null;
    this.source = null;
    this.rnnoise = null;
    // the original microphone, delayed and quieter, mixed in with RNNoise
    this.dryDelay = null;
    this.dry = null;
    this.gate = null;
    this.destination = null;
    this.track = null;
  }

  /** Start with this microphone; gives the track to send. */
  async start(stream) {
    this.stream = stream;
    try {
      await this._build(true);
    } catch (error) {
      console.warn("Voice chat: noise suppression unavailable", error);
      this.dispose();
      await this._build(false);
    }
    return this.track;
  }

  async _build(withRnnoise) {
    const context = withRnnoise
      ? new AudioContext({ sampleRate: 48000 })
      : new AudioContext();
    this.context = context;
    const loading = [context.audioWorklet.addModule(FILES + "voiceGate.js")];
    if (withRnnoise) {
      loading.push(
        context.audioWorklet.addModule(FILES + "rnnoiseWorklet.js"),
        loadRnnoiseBinary(),
      );
    }
    const [, , wasmBinary] = await Promise.all(loading);
    if (withRnnoise) {
      this.rnnoise = new RnnoiseWorkletNode(context, {
        wasmBinary,
        maxChannels: 1,
      });
      this._mono(this.rnnoise);
      this.dryDelay = context.createDelay(0.1);
      this.dryDelay.delayTime.value = RNNOISE_DELAY;
      this.dry = context.createGain();
      this.dry.gain.value = DRY_MIX;
      this.dryDelay.connect(this.dry);
    }
    this.gate = new AudioWorkletNode(context, "voice-gate", {
      outputChannelCount: [1],
    });
    this._mono(this.gate);
    this.gate.port.onmessage = ({ data }) => {
      this.level = data;
    };
    this._sendOptions();
    if (this.dry) this.dry.connect(this.gate);
    this.destination = context.createMediaStreamDestination();
    this.gate.connect(this.destination);
    // Firefox can't take a microphone at another rate than the context's
    this.source = context.createMediaStreamSource(this.stream);
    this._wire();
    await context.resume();
    this.canDenoise = withRnnoise;
    this.track = this.destination.stream.getAudioTracks()[0];
  }

  _mono(node) {
    node.channelCount = 1;
    node.channelCountMode = "explicit";
  }

  _sendOptions() {
    this.gate.port.postMessage({
      auto: !!this.options.auto,
      threshold: this.options.threshold,
    });
  }

  _wire() {
    this.source.disconnect();
    if (this.rnnoise) this.rnnoise.disconnect();
    if (this.rnnoise && this.options.denoise) {
      this.source.connect(this.rnnoise);
      this.rnnoise.connect(this.gate);
      this.source.connect(this.dryDelay);
    } else {
      this.source.connect(this.gate);
    }
  }

  /** Another microphone, same track out. */
  setInput(stream) {
    this.stream = stream;
    if (!this.context) return;
    this.source.disconnect();
    this.source = this.context.createMediaStreamSource(stream);
    this._wire();
  }

  setOptions(options) {
    const denoiseChanged = !!options.denoise !== !!this.options.denoise;
    this.options = { ...options };
    if (!this.gate) return;
    this._sendOptions();
    if (denoiseChanged) this._wire();
  }

  dispose() {
    if (this.source) this.source.disconnect();
    if (this.rnnoise) {
      this.rnnoise.disconnect();
      this.rnnoise.destroy();
    }
    if (this.dry) this.dry.disconnect();
    if (this.gate) {
      this.gate.disconnect();
      this.gate.port.onmessage = null;
    }
    if (this.track) this.track.stop();
    if (this.context) this.context.close().catch(() => {});
    this.context = null;
    this.source = null;
    this.rnnoise = null;
    this.dryDelay = null;
    this.dry = null;
    this.gate = null;
    this.destination = null;
    this.track = null;
    this.level = null;
    this.canDenoise = false;
  }
}
