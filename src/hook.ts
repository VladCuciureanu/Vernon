import { existsSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { getRepoRoot } from "./git.js";

const HOOK_MARKER = "# vernon hook";
const HOOK_COMMAND = "npx vernon diff";

function getHookPath(): string {
  const root = getRepoRoot() || process.cwd();
  return join(root, ".git", "hooks", "pre-commit");
}

export function installHook(): void {
  const hookPath = getHookPath();
  const hookContent = `#!/bin/sh\n${HOOK_MARKER}\n${HOOK_COMMAND}\n`;

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf-8");
    if (existing.includes(HOOK_MARKER)) {
      console.log("Hook already installed.");
      return;
    }
    // Append to existing hook
    writeFileSync(hookPath, existing + `\n${HOOK_MARKER}\n${HOOK_COMMAND}\n`, "utf-8");
  } else {
    writeFileSync(hookPath, hookContent, "utf-8");
  }

  chmodSync(hookPath, 0o755);
  console.log("Pre-commit hook installed.");
}

export function uninstallHook(): void {
  const hookPath = getHookPath();
  if (!existsSync(hookPath)) {
    console.log("No hook to remove.");
    return;
  }

  const content = readFileSync(hookPath, "utf-8");
  if (!content.includes(HOOK_MARKER)) {
    console.log("No vernon hook found.");
    return;
  }

  // Remove our lines
  const lines = content.split("\n");
  const filtered = lines.filter(
    (line) => line !== HOOK_MARKER && line !== HOOK_COMMAND,
  );
  const result = filtered.join("\n").trim();

  if (result === "#!/bin/sh" || result === "") {
    // Hook is now empty, remove it
    unlinkSync(hookPath);
  } else {
    writeFileSync(hookPath, result + "\n", "utf-8");
  }

  console.log("Pre-commit hook removed.");
}
