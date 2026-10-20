import type { Deletion, DiffSource, Metadata } from "./types.ts";
import * as git from "./git.ts";

// The per-file git lookups metadata needs; injectable for tests.
export interface FileLookups {
  getFileCreationDate(filePath: string): string | null;
  getFileAuthor(filePath: string): string | null;
  getLastEditor(filePath: string): string | null;
  getCommitCount(filePath: string): number;
  getCauseOfDeath(filePath: string, source: DiffSource): string;
  getFileContentBeforeDeletion(filePath: string, source: DiffSource): string | null;
}

interface FileHistory {
  birthDate: string;
  author: string;
  lastEditor: string;
  commitCount: number;
  causeOfDeath: string;
}

// Returns an enricher that runs each file's git lookups once, however many
// functions were deleted from that file.
export function createEnricher(
  source: DiffSource,
  lookups: FileLookups = git,
): (deletion: Deletion) => Metadata {
  const histories = new Map<string, FileHistory>();
  const fileLines = new Map<string, number | null>();

  function history(filePath: string): FileHistory {
    let h = histories.get(filePath);
    if (!h) {
      const birthDateRaw = lookups.getFileCreationDate(filePath);
      h = {
        birthDate: birthDateRaw ? birthDateRaw.split("T")[0] : "unknown origin",
        author: lookups.getFileAuthor(filePath) ?? "unknown",
        lastEditor: lookups.getLastEditor(filePath) ?? "unknown",
        commitCount: lookups.getCommitCount(filePath),
        causeOfDeath: lookups.getCauseOfDeath(filePath, source),
      };
      histories.set(filePath, h);
    }
    return h;
  }

  function countFileLines(deletion: Deletion): number {
    if (!fileLines.has(deletion.filePath)) {
      const content = lookups.getFileContentBeforeDeletion(deletion.filePath, source);
      fileLines.set(deletion.filePath, content ? content.split("\n").length : null);
    }
    return fileLines.get(deletion.filePath) ?? deletion.removedLines.length;
  }

  return (deletion) => {
    const now = new Date().toISOString().split("T")[0];
    const linesOfCode = deletion.type === "file" ? countFileLines(deletion) : deletion.removedLines.length;
    return { ...history(deletion.filePath), deathDate: now, linesOfCode };
  };
}
