import { build } from "esbuild";
import { rename } from "node:fs/promises";

await build({
  entryPoints: ["plugin/code.ts"],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2017",
  outfile: "plugin/code.tmp.js",
});

await rename("plugin/code.tmp.js", "plugin/code.js");

console.log("Built plugin/code.js");
