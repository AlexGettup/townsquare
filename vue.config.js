module.exports = {
  // GitHub Pages serves this project from a subfolder: https://alexgettup.github.io/townsquare/
  // If you move it to a custom domain or a user site (served from "/"), change this back to "/".
  publicPath: process.env.NODE_ENV === "production" ? "/townsquare/" : "/",
};
