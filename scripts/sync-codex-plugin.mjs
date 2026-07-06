#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginSource = resolve(homedir(), "plugins", "loop-it");
const pluginMetadataPath = resolve(root, ".codex-plugin", "plugin.json");
const pluginMetadata = JSON.parse(readFileSync(pluginMetadataPath, "utf8"));
const args = new Set(process.argv.slice(2));

syncPath(".codex-plugin");
syncPath("skills");

console.log(`Synced Loop It personal Codex plugin source to ${pluginSource} (v${pluginMetadata.version}).`);

if (!args.has("--no-install")) {
  reinstallCodexPlugin();
}

function syncPath(relativePath) {
  const source = resolve(root, relativePath);
  const target = resolve(pluginSource, relativePath);

  if (!existsSync(source)) {
    fail(`Missing source path: ${source}`);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function reinstallCodexPlugin() {
  const removeResult = runCodex(["plugin", "remove", "loop-it@personal", "--json"], { allowFailure: true });
  if (removeResult.status !== 0) {
    console.warn("Loop It personal Codex plugin was not installed, continuing with install.");
  }

  runCodex(["plugin", "add", "loop-it@personal", "--json"]);
  console.log(`Installed loop-it@personal in Codex (v${pluginMetadata.version}).`);
}

function runCodex(codexArgs, options = {}) {
  const result = spawnSync("codex", codexArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    fail(`Failed to run codex ${codexArgs.join(" ")}: ${result.error.message}`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    fail(`codex ${codexArgs.join(" ")} exited ${result.status}`);
  }

  return result;
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
