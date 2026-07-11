import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { delimiter, resolve } from "node:path";

const CODEX_DESKTOP_RELATIVE_PATHS = [
  ["Applications", "ChatGPT.app", "Contents", "Resources", "codex"],
  ["Applications", "Codex.app", "Contents", "Resources", "codex"],
];

export function resolveCodexCli(options = {}) {
  const env = options.env ?? process.env;
  const requested = nonEmpty(options.requested) || nonEmpty(env.LOOP_IT_CODEX_BIN) || "codex";

  if (requested !== "codex") {
    return {
      bin: requested,
      source: options.requested ? "argument" : "environment",
    };
  }

  if (isCommandOnPath("codex", env)) {
    return {
      bin: "codex",
      source: "path",
    };
  }

  for (const candidate of desktopCandidates(env)) {
    if (isExecutable(candidate)) {
      return {
        bin: candidate,
        source: "desktop",
      };
    }
  }

  return {
    bin: "codex",
    source: "missing",
  };
}

function desktopCandidates(env) {
  const home = nonEmpty(env.HOME) || homedir();
  const candidates = CODEX_DESKTOP_RELATIVE_PATHS.map((parts) => resolve(home, ...parts));

  if (process.platform === "darwin") {
    candidates.push(
      "/Applications/ChatGPT.app/Contents/Resources/codex",
      "/Applications/Codex.app/Contents/Resources/codex"
    );
  }

  return [...new Set(candidates)];
}

function isCommandOnPath(command, env) {
  const pathEntries = String(env.PATH ?? "")
    .split(delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  const extensions = process.platform === "win32"
    ? String(env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(delimiter)
    : [""];

  return pathEntries.some((entry) =>
    extensions.some((extension) => isExecutable(resolve(entry, `${command}${extension}`)))
  );
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
