import { spawnSync } from "node:child_process";

// Runs git directly with an argument array (no shell), so file paths and refs
// are passed literally and cannot inject shell commands.
function git(args: string[]): string {
  const { stdout, error, status } = spawnSync("git", args, { encoding: "utf8", maxBuffer: Infinity });
  if (error || status !== 0) return "";
  return stdout.trim();
}

export function isInsideGitRepo(): boolean {
  return git(["rev-parse", "--is-inside-work-tree"]) === "true";
}

export function getStagedDiff(): string {
  return git(["diff", "--cached", "-U0"]);
}

export function getCommitDiff(ref?: string): string {
  const range = ref ?? "HEAD~1..HEAD";
  return git(["diff", "-U0", "--end-of-options", range]);
}

export function getFileCreationDate(filePath: string): string | null {
  const result = git(["log", "--follow", "--diff-filter=A", "--format=%aI", "--", filePath]);
  const lines = result.split("\n").filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export function getFileAuthor(filePath: string): string | null {
  const result = git(["log", "--follow", "--diff-filter=A", "--format=%an", "--", filePath]);
  const lines = result.split("\n").filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export function getLastEditor(filePath: string): string | null {
  const result = git(["log", "-1", "--format=%an", "--", filePath]);
  return result || null;
}

export function getCommitCount(filePath: string): number {
  const result = git(["log", "--oneline", "--follow", "--", filePath]);
  return result ? result.split("\n").filter(Boolean).length : 0;
}

export function getLatestCommitMessage(): string {
  return git(["log", "-1", "--format=%s"]) || "unknown cause";
}

export function getFileContentBeforeDeletion(filePath: string): string | null {
  let result = git(["show", `HEAD:${filePath}`]);
  if (!result) {
    result = git(["show", `HEAD~1:${filePath}`]);
  }
  return result || null;
}

export function getRepoRoot(): string {
  return git(["rev-parse", "--show-toplevel"]);
}
