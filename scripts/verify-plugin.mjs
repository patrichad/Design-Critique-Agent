import { access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = join(dirname(fileURLToPath(import.meta.url)), "..", "plugin");
const required = ["manifest.json", "code.js", "ui.html"];

for (const file of required) {
  const path = join(pluginDir, file);
  await access(path);
  console.log(`OK: plugin/${file}`);
}

console.log("\nPlugin package is ready. Import plugin/manifest.json in Figma (not the repo root).");
