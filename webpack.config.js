const path = require("path");

module.exports = {
  entry: {
    page1: "./src/page1.js",
    page2: "./src/page2.js",
  },
  context: process.cwd(),
  devtool: false,
  mode: "development",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "main.js",
  },
  module: {
    rules: [
      {
        test: /\.less$/,
        use: ["style-loader", "less-loader"],
      },
    ],
  },
};
