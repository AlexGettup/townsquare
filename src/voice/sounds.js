/**
 * Small synthesized sounds for the voice chat (no audio files needed).
 */
let context = null;

const getContext = () => {
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  }
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
};

// one bell strike: a few harmonics with an exponential decay
const strike = (ctx, at, frequency) => {
  [1, 2.01, 3.02].forEach((harmonic, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * harmonic;
    const volume = 0.25 / (index + 1);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 1.7);
  });
};

/** Town bell: everyone back to the plaza. */
export const playGatherBell = () => {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.05;
  strike(ctx, now, 659);
  strike(ctx, now + 0.45, 523);
  strike(ctx, now + 0.9, 659);
};

/** Soft chime: an invitation or a request to join. */
export const playChime = () => {
  const ctx = getContext();
  if (!ctx) return;
  strike(ctx, ctx.currentTime + 0.05, 988);
};
