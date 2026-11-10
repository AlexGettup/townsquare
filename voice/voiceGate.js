/**
 * Voice gate for voice chat, like Discord's input sensitivity: only lets the
 * microphone through while someone talks, and sends silence otherwise.
 *
 * Runs on the audio thread (AudioWorklet), so it keeps working in a tab in
 * the background. Served as is from public/: no build step, plain ES2017.
 *
 * - On the side of letting things through: cutting a soft voice is worse
 *   than letting some noise in. Low automatic threshold, it stays open while
 *   the sound is a bit below the opening level, and for half a second after.
 * - It only opens for sounds that last (20 ms above the threshold): a voice
 *   does, a key or a click doesn't.
 * - The decision looks 40 ms ahead (the output is delayed that much), so the
 *   first syllable isn't cut by that wait.
 * - Automatic sensitivity: the threshold sits a margin above the background
 *   noise, which it keeps measuring. Manual: a fixed threshold in dB.
 * - Every 50 ms it reports { level, threshold, open } for the level meter.
 *
 * Messages in: { auto: boolean, threshold: dB }.
 */
const LOOKAHEAD = 0.04; // s
const MIN_LOUD = 0.02; // s above the threshold before opening
const KEEP_OPEN_BELOW = 6; // dB under the threshold that still keeps it open
const HOLD = 0.5; // s open after the last loud moment, for the ends of words
const ATTACK = 0.003; // s to open
const RELEASE = 0.06; // s to close, after the hold
const REPORT_EVERY = 0.05; // s
const MIN_DB = -100;
// automatic sensitivity: how far above the noise, and between which limits
const AUTO_MARGIN = 8;
const AUTO_MIN = -70;
const AUTO_MAX = -45;
// the noise estimate falls fast and rises slowly (dB per second), so speech,
// which comes and goes, barely moves it
const FLOOR_RISE = 2;
const FLOOR_FALL = 0.3; // s to follow it down
const AVERAGE = 0.05; // s of sound the noise estimate looks at
const ENVELOPE_FALL = 300; // dB per second

class VoiceGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.auto = true;
    this.manual = -50;
    this.floor = -60;
    this.envelope = MIN_DB;
    this.energy = 0;
    this.holdLeft = 0;
    this.loudFor = 0;
    this.gain = 0;
    this.size = Math.max(1, Math.round(LOOKAHEAD * sampleRate));
    this.delay = [];
    this.position = 0;
    this.sinceReport = 0;
    this.port.onmessage = ({ data }) => {
      if (typeof data.auto === "boolean") this.auto = data.auto;
      if (typeof data.threshold === "number") this.manual = data.threshold;
    };
  }

  threshold() {
    if (!this.auto) return this.manual;
    return Math.min(AUTO_MAX, Math.max(AUTO_MIN, this.floor + AUTO_MARGIN));
  }

  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0];
    const frames = output[0] ? output[0].length : 128;
    const seconds = frames / sampleRate;

    // loudness of this block
    const first = input[0];
    let sum = 0;
    if (first)
      for (let i = 0; i < first.length; i++) sum += first[i] * first[i];
    const rms = first ? Math.sqrt(sum / first.length) : 0;
    const db = rms > 0 ? Math.max(MIN_DB, 20 * Math.log10(rms)) : MIN_DB;
    this.envelope = Math.max(db, this.envelope - ENVELOPE_FALL * seconds);

    // background noise, from the average level (single blocks dip too low)
    this.energy += (rms * rms - this.energy) * Math.min(1, seconds / AVERAGE);
    const average =
      this.energy > 0 ? Math.max(MIN_DB, 10 * Math.log10(this.energy)) : MIN_DB;
    if (average < this.floor) {
      this.floor += (average - this.floor) * Math.min(1, seconds / FLOOR_FALL);
    } else {
      this.floor += Math.min(average - this.floor, FLOOR_RISE * seconds);
    }

    const threshold = this.threshold();
    // how long it has been loud, block by block (the envelope would make a
    // click last too long)
    this.loudFor = db > threshold ? this.loudFor + seconds : 0;
    const isOpen = this.holdLeft > 0;
    if (
      isOpen
        ? this.envelope > threshold - KEEP_OPEN_BELOW
        : this.loudFor >= MIN_LOUD
    ) {
      this.holdLeft = HOLD;
    } else {
      this.holdLeft = Math.max(0, this.holdLeft - seconds);
    }
    const open = this.holdLeft > 0;
    const target = open ? 1 : 0;
    const step = 1 - Math.exp(-1 / ((open ? ATTACK : RELEASE) * sampleRate));

    // the delayed signal, through the gate
    const gains = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      this.gain += (target - this.gain) * step;
      gains[i] = this.gain;
    }
    for (let channel = 0; channel < output.length; channel++) {
      const samples = input[channel] || input[0];
      const out = output[channel];
      if (!this.delay[channel])
        this.delay[channel] = new Float32Array(this.size);
      const buffer = this.delay[channel];
      let position = this.position;
      for (let i = 0; i < frames; i++) {
        const delayed = buffer[position];
        buffer[position] = samples ? samples[i] : 0;
        out[i] = delayed * gains[i];
        position = position + 1 === this.size ? 0 : position + 1;
      }
    }
    this.position = (this.position + frames) % this.size;

    this.sinceReport += seconds;
    if (this.sinceReport >= REPORT_EVERY) {
      this.sinceReport = 0;
      this.port.postMessage({ level: this.envelope, threshold, open });
    }
    return true;
  }
}

registerProcessor("voice-gate", VoiceGate);
