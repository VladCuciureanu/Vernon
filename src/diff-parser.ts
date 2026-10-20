import type { Deletion } from "./types.ts";
import { detectLanguage, detectDeletedFunctions } from "./function-detector.ts";

interface DiffFile {
  filePath: string;
  isDeleted: boolean;
  removedLines: string[];
  addedLines: string[];
  // Index into removedLines where each hunk's removed lines begin.
  hunkStarts: number[];
}

export function parseDiff(rawDiff: string): Deletion[] {
  if (!rawDiff.trim()) return [];

  const files = splitIntoFiles(rawDiff);
  const deletions: Deletion[] = [];

  for (const file of files) {
    if (file.isDeleted) {
      deletions.push({
        type: "file",
        name: file.filePath.split("/").pop() || file.filePath,
        filePath: file.filePath,
        language: detectLanguage(file.filePath),
        removedLines: file.removedLines,
      });
    } else if (file.removedLines.length > 0) {
      const funcDeletions = detectDeletedFunctions(file.removedLines, file.filePath, {
        addedLines: file.addedLines,
        hunkStarts: file.hunkStarts,
      });
      deletions.push(...funcDeletions);
    }
  }

  return deletions;
}

function splitIntoFiles(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const fileChunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of fileChunks) {
    const lines = chunk.split("\n");

    // Extended header: everything before the first hunk.
    let isDeleted = false;
    let oldPath: string | null = null;
    let newPath: string | null = null;
    let renameFrom: string | null = null;
    let i = 1;
    for (; i < lines.length && !lines[i].startsWith("@@"); i++) {
      const line = lines[i];
      if (line.startsWith("deleted file mode ")) isDeleted = true;
      else if (line.startsWith("--- ")) oldPath = parseHeaderPath(line.slice(4), "a/");
      else if (line.startsWith("+++ ")) newPath = parseHeaderPath(line.slice(4), "b/");
      else if (line.startsWith("rename from ")) renameFrom = unquote(line.slice("rename from ".length));
    }

    const filePath = oldPath ?? renameFrom ?? newPath ?? parseGitHeader(lines[0]);
    if (!filePath) continue;

    const removedLines: string[] = [];
    const addedLines: string[] = [];
    const hunkStarts: number[] = [];
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("@@")) hunkStarts.push(removedLines.length);
      else if (line.startsWith("-")) removedLines.push(line.slice(1));
      else if (line.startsWith("+")) addedLines.push(line.slice(1));
    }

    files.push({ filePath, isDeleted, removedLines, addedLines, hunkStarts });
  }

  return files;
}

// Parses the path from a `--- a/path` / `+++ b/path` line. Returns null for
// /dev/null. Git appends a tab when the path contains a space.
function parseHeaderPath(raw: string, prefix: string): string | null {
  const value = unquote(raw.replace(/\t$/, ""));
  if (value === "/dev/null") return null;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

// Fallback for chunks without ---/+++ lines (e.g. binary files). Without a
// rename, both sides of `a/<path> b/<path>` are the same path, so the split
// point is determined by length rather than by searching for " b/".
function parseGitHeader(header: string | undefined): string | null {
  if (!header) return null;
  const line = header.replace(/\r$/, "");
  const len = (line.length - 5) / 2;
  if (!Number.isInteger(len) || len <= 0) return null;
  const a = line.slice(0, 2 + len);
  const b = line.slice(2 + len + 1);
  if (!a.startsWith("a/") || !b.startsWith("b/") || a.slice(2) !== b.slice(2)) return null;
  return a.slice(2);
}

// Undoes git's C-style quoting of paths with special characters.
function unquote(value: string): string {
  if (!(value.length >= 2 && value.startsWith('"') && value.endsWith('"'))) return value;
  const bytes: number[] = [];
  const escapes: Record<string, number> = { n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11, '"': 34, "\\": 92 };
  const inner = value.slice(1, -1);
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch !== "\\") {
      bytes.push(...Buffer.from(ch, "utf8"));
      continue;
    }
    const next = inner[i + 1];
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(inner.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(escapes[next] ?? next.charCodeAt(0));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString("utf8");
}
