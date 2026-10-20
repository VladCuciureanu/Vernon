import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getRepoRoot } from "./git.ts";

const HOOK_MARKER = "# vernon hook";
// Runs the globally installed `vernon` bin, so the hook works without the
// package being published to a registry.
const HOOK_COMMAND = "vernon diff";
// Commands written by earlier versions of Vernon (Deno build, then npx); still
// removed on uninstall.
const LEGACY_HOOK_COMMANDS = [
  "deno run --allow-run --allow-read --allow-write jsr:@vladcuciureanu/vernon diff",
  "npx @vladcuciureanu/vernon diff",
];

function getHookPath(repoRoot?: string): string {
  const root = repoRoot ?? (getRepoRoot() || process.cwd());
  return join(root, ".git", "hooks", "pre-commit");
}

export function installHook(repoRoot?: string): void {
  const hookPath = getHookPath(repoRoot);
  const hookContent = `#!/bin/sh\n${HOOK_MARKER}\n${HOOK_COMMAND}\n`;

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");
    if (existing.includes(HOOK_MARKER)) {
      console.log("Hook already installed.");
      return;
    }
    writeFileSync(hookPath, existing + `\n${HOOK_MARKER}\n${HOOK_COMMAND}\n`);
  } else {
    writeFileSync(hookPath, hookContent);
  }

  chmodSync(hookPath, 0o755);
  console.log("Pre-commit hook installed.");
}

export function uninstallHook(repoRoot?: string): void {
  const hookPath = getHookPath(repoRoot);
  if (!existsSync(hookPath)) {
    console.log("No hook to remove.");
    return;
  }

  const content = readFileSync(hookPath, "utf8");
  if (!content.includes(HOOK_MARKER)) {
    console.log("No Vernon hook found.");
    return;
  }

  const lines = content.split("\n");
  const filtered = lines.filter(
    (line) => line !== HOOK_MARKER && line !== HOOK_COMMAND && !LEGACY_HOOK_COMMANDS.includes(line),
  );
  const result = filtered.join("\n").trim();

  if (result === "#!/bin/sh" || result === "") {
    rmSync(hookPath);
  } else {
    writeFileSync(hookPath, result + "\n");
  }

  console.log("Pre-commit hook removed.");
}
