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
  module: {
    rules: [
      {
        test: /\.less$/,
        use: ["style-loader", "less-loader"],
      },
    ],
  },
};
