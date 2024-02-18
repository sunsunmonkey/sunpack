const path = require("path");

module.exports = {
  entry: "./src/index.js",
  context: process.cwd(),
  devtool: false,
  mode: "development",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "main.js",
  },
};
