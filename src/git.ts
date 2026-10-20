import { spawnSync } from "node:child_process";
import type { DiffSource } from "./types.ts";

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
  const { stdout, stderr, error, status } = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: Infinity,
  });
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
const DIFF_ARGS = [
  "diff",
  "-U0",
  "--no-color",
  "--no-ext-diff",
  "--src-prefix=a/",
  "--dst-prefix=b/",
];

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

// When and by whom the file was first added (following renames), from a
// single `git log`; null when git has no record of it.
export function getFileOrigin(filePath: string): { date: string; author: string } | null {
  const result =
    tryGit(["log", "--follow", "--diff-filter=A", "--format=%aI%x00%an", "--", filePath]) ?? "";
  const first = result.split("\n").filter(Boolean).at(-1);
  if (!first) return null;
  const [date, author] = first.split("\0");
  return { date, author };
}

export function getLastEditor(filePath: string): string | null {
  const result = tryGit(["log", "-1", "--format=%an", "--", filePath]);
  return result || null;
}

export function getCommitCount(filePath: string): number {
  const result = tryGit(["log", "--oneline", "--follow", "--", filePath]);
  return result ? result.split("\n").filter(Boolean).length : 0;
}

// The revision holding the "before" side of the diff.
function beforeRevision(source: DiffSource): string | null {
  if (source.kind === "staged") return "HEAD";
  const ref = source.ref;
  if (ref === undefined) return "HEAD~1";
  const symmetric = ref.indexOf("...");
  if (symmetric !== -1) {
    const left = ref.slice(0, symmetric) || "HEAD";
    const right = ref.slice(symmetric + 3) || "HEAD";
    return tryGit(["merge-base", "--end-of-options", left, right]);
  }
  const twoDot = ref.indexOf("..");
  if (twoDot !== -1) return ref.slice(0, twoDot) || "HEAD";
  // A single ref is diffed against the working tree.
  return ref;
}

// The commit message of the last commit in the scanned range that touched
// the file: the one that killed it.
export function getCauseOfDeath(filePath: string, source: DiffSource): string {
  if (source.kind === "staged") return "not yet committed";
  const ref = source.ref ?? "HEAD~1..HEAD";
  // A single ref is diffed against the working tree, so look at commits since.
  const range = ref.includes("..") ? ref : `${ref}..HEAD`;
  const message = tryGit(["log", "-1", "--format=%s", "--end-of-options", range, "--", filePath]);
  if (message) return message;
  return ref.includes("..") ? "unknown cause" : "uncommitted changes";
}

export function getFileContentBeforeDeletion(filePath: string, source: DiffSource): string | null {
  const rev = beforeRevision(source);
  if (!rev) return null;
  return tryGit(["show", "--end-of-options", `${rev}:${filePath}`]) || null;
}

// The hooks directory git actually uses for the repo at `cwd` (honours
// core.hooksPath and linked worktrees), or null outside a repository.
export function getHooksDir(cwd: string): string | null {
  return tryGit(["-C", cwd, "rev-parse", "--path-format=absolute", "--git-path", "hooks"]);
}

// The repository root, or the current directory outside a repository.
export function getRepoRoot(): string {
  return tryGit(["rev-parse", "--show-toplevel"]) || process.cwd();
}
