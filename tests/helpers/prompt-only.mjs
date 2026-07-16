import { hasPromptCommandSyntax } from "../../skills/loop-it/scripts/goal-library.mjs";

export function assertUserFacingPromptOnly(content, label) {
  if (hasPromptCommandSyntax(content)) {
    throw new Error(`Expected ${label} not to contain user-facing terminal or slash-command syntax`);
  }
}
