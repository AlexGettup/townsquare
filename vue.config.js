const path = require("path");

// RNNoise (voice chat noise suppression): its audio worklet and WebAssembly
// files are served next to our voice gate (public/voice/voiceGate.js)
const noiseSuppressor = path.dirname(
  require.resolve("@sapphi-red/web-noise-suppressor"),
);

module.exports = {
  // GitHub Pages serves this project from a subfolder: https://alexgettup.github.io/townsquare/
  // If you move it to a custom domain or a user site (served from "/"), change this back to "/".
  publicPath: process.env.NODE_ENV === "production" ? "/townsquare/" : "/",
  chainWebpack: (config) => {
    config.plugin("copy").tap(([options]) => {
      options.patterns.push(
        {
          from: path.join(noiseSuppressor, "rnnoise/workletProcessor.js"),
          to: "voice/rnnoiseWorklet.js",
        },
        { from: path.join(noiseSuppressor, "rnnoise.wasm"), to: "voice/" },
        { from: path.join(noiseSuppressor, "rnnoise_simd.wasm"), to: "voice/" },
      );
      return [options];
    });
  },
};
