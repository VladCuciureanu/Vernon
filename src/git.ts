import { spawnSync } from "node:child_process";

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

// Runs git directly with an argument array (no shell), so file paths and refs
// are passed literally and cannot inject shell commands. Throws GitError with
// git's own error output when git cannot be run or exits non-zero.
function git(args: string[]): string {
  const { stdout, stderr, error, status } = spawnSync("git", args, { encoding: "utf8", maxBuffer: Infinity });
  if (error) throw new GitError(`could not run git: ${error.message}`);
  if (status !== 0) {
    throw new GitError(stderr.trim() || `git ${args[0]} exited with status ${status}`);
  }
  return stdout.trim();
}

// For lookups where failure is an expected answer (not a repo, path absent at
// a revision): returns null instead of throwing.
function tryGit(args: string[]): string | null {
  try {
    return git(args);
  } catch (err) {
    if (err instanceof GitError) return null;
    throw err;
  }
}

export function isInsideGitRepo(): boolean {
  return tryGit(["rev-parse", "--is-inside-work-tree"]) === "true";
}

// Pin the output format the diff parser relies on, regardless of user config
// (diff.noprefix, diff.mnemonicPrefix, color.diff, diff.external).
const DIFF_ARGS = ["diff", "-U0", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"];

export function getStagedDiff(): string {
  return git([...DIFF_ARGS, "--cached"]);
}

export function getCommitDiff(ref?: string): string {
  if (ref === undefined) {
    // The root commit (or an empty repo) has no parent and deletes nothing.
    if (tryGit(["rev-parse", "--verify", "--quiet", "HEAD~1^{commit}"]) === null) return "";
    ref = "HEAD~1..HEAD";
  }
  return git([...DIFF_ARGS, "--end-of-options", ref]);
}

export function getFileCreationDate(filePath: string): string | null {
  const result = tryGit(["log", "--follow", "--diff-filter=A", "--format=%aI", "--", filePath]) ?? "";
  const lines = result.split("\n").filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export function getFileAuthor(filePath: string): string | null {
  const result = tryGit(["log", "--follow", "--diff-filter=A", "--format=%an", "--", filePath]) ?? "";
  const lines = result.split("\n").filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export function getLastEditor(filePath: string): string | null {
  const result = tryGit(["log", "-1", "--format=%an", "--", filePath]);
  return result || null;
}

export function getCommitCount(filePath: string): number {
  const result = tryGit(["log", "--oneline", "--follow", "--", filePath]);
  return result ? result.split("\n").filter(Boolean).length : 0;
}

export function getLatestCommitMessage(): string {
  return tryGit(["log", "-1", "--format=%s"]) || "unknown cause";
}

export function getFileContentBeforeDeletion(filePath: string): string | null {
  let result = tryGit(["show", `HEAD:${filePath}`]);
  if (!result) {
    result = tryGit(["show", `HEAD~1:${filePath}`]);
  }
  return result || null;
}

export function getRepoRoot(): string {
  return tryGit(["rev-parse", "--show-toplevel"]) ?? "";
}
