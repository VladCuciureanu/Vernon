import { join } from "@std/path";
import { existsSync } from "@std/fs";
import { getRepoRoot } from "./git.ts";

const HOOK_MARKER = "# vernon hook";
const HOOK_COMMAND = "deno run --allow-run --allow-read --allow-write jsr:@vladcuciureanu/vernon diff";

function getHookPath(repoRoot?: string): string {
  const root = repoRoot ?? (getRepoRoot() || Deno.cwd());
  return join(root, ".git", "hooks", "pre-commit");
}

export function installHook(repoRoot?: string): void {
  const hookPath = getHookPath(repoRoot);
  const hookContent = `#!/bin/sh\n${HOOK_MARKER}\n${HOOK_COMMAND}\n`;

  if (existsSync(hookPath)) {
    const existing = Deno.readTextFileSync(hookPath);
    if (existing.includes(HOOK_MARKER)) {
      console.log("Hook already installed.");
      return;
    }
    Deno.writeTextFileSync(hookPath, existing + `\n${HOOK_MARKER}\n${HOOK_COMMAND}\n`);
  } else {
    Deno.writeTextFileSync(hookPath, hookContent);
  }

  Deno.chmodSync(hookPath, 0o755);
  console.log("Pre-commit hook installed.");
}

export function uninstallHook(repoRoot?: string): void {
  const hookPath = getHookPath(repoRoot);
  if (!existsSync(hookPath)) {
    console.log("No hook to remove.");
    return;
  }

  const content = Deno.readTextFileSync(hookPath);
  if (!content.includes(HOOK_MARKER)) {
    console.log("No Vernon hook found.");
    return;
  }

  const lines = content.split("\n");
  const filtered = lines.filter(
    (line) => line !== HOOK_MARKER && line !== HOOK_COMMAND,
  );
  const result = filtered.join("\n").trim();

  if (result === "#!/bin/sh" || result === "") {
    Deno.removeSync(hookPath);
  } else {
    Deno.writeTextFileSync(hookPath, result + "\n");
  }

  console.log("Pre-commit hook removed.");
}
