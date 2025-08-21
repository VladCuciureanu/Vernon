import { execSync } from "node:child_process";

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch {
    return "";
  }
}

export function isInsideGitRepo(): boolean {
  return run("git rev-parse --is-inside-work-tree") === "true";
}

export function getStagedDiff(): string {
  return run("git diff --cached -U0");
}

export function getCommitDiff(ref?: string): string {
  const range = ref ?? "HEAD~1..HEAD";
  return run(`git diff ${range} -U0`);
}

export function getFileCreationDate(filePath: string): string | null {
  const result = run(`git log --follow --diff-filter=A --format=%aI -- "${filePath}"`);
  const lines = result.split("\n").filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export function getFileAuthor(filePath: string): string | null {
  const result = run(`git log --follow --diff-filter=A --format=%an -- "${filePath}"`);
  const lines = result.split("\n").filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export function getLastEditor(filePath: string): string | null {
  const result = run(`git log -1 --format=%an -- "${filePath}"`);
  return result || null;
}

export function getCommitCount(filePath: string): number {
  const result = run(`git log --oneline --follow -- "${filePath}"`);
  return result ? result.split("\n").filter(Boolean).length : 0;
}

export function getLatestCommitMessage(): string {
  return run("git log -1 --format=%s") || "unknown cause";
}

export function getFileContentBeforeDeletion(filePath: string): string | null {
  // Try HEAD first, then HEAD~1 for staged deletions
  let result = run(`git show HEAD:"${filePath}"`);
  if (!result) {
    result = run(`git show HEAD~1:"${filePath}"`);
  }
  return result || null;
}

export function getRepoRoot(): string {
  return run("git rev-parse --show-toplevel");
}
