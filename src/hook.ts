import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getHooksDir, getRepoRoot } from "./git.ts";

const HOOK_MARKER = "# vernon hook";
// Runs the globally installed `vernon` bin, so the hook works without the
// package being published to a registry. Obituaries are a side show: the hook
// skips when vernon isn't installed and never blocks the commit.
const HOOK_COMMAND = "command -v vernon >/dev/null 2>&1 && vernon diff || true";
// Commands written by earlier versions of Vernon (Deno build, npx, bare bin);
// still removed on uninstall.
const LEGACY_HOOK_COMMANDS = [
  "deno run --allow-run --allow-read --allow-write jsr:@vladcuciureanu/vernon diff",
  "npx @vladcuciureanu/vernon diff",
  "vernon diff",
];

function getHookPath(repoRoot?: string): string {
  const root = repoRoot ?? (getRepoRoot() || process.cwd());
  const hooksDir = getHooksDir(root) ?? join(root, ".git", "hooks");
  return join(hooksDir, "pre-commit");
}

// Adds Vernon's lines to an existing hook. If the hook ends with an `exit`,
// they go before it so they still run.
function addToHook(existing: string): string {
  const block = [HOOK_MARKER, HOOK_COMMAND];
  const lines = existing.replace(/\n+$/, "").split("\n");
  const last = lines.length - 1;
  if (/^\s*exit(\s|;|$)/.test(lines[last])) {
    return [...lines.slice(0, last), ...block, lines[last]].join("\n") + "\n";
  }
  return [...lines, "", ...block].join("\n") + "\n";
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
    writeFileSync(hookPath, addToHook(existing));
  } else {
    mkdirSync(dirname(hookPath), { recursive: true });
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
