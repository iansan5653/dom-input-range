import * as url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

/** @type {import("webpack").Configuration} */
const config = {
  mode: "development",
  devtool: "source-map",
  entry: {
    words: "./words/words.ts",
    caret: "./caret/caret.ts",
    playground: "./playground/playground.ts",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    extensionAlias: {
      ".js": [".js", ".ts"],
    },
  },
  output: {
    path: `${__dirname}`,
    filename: "./[name]/[name].js",
  },
};

export default config;
