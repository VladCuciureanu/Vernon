import type { Deletion, Metadata } from "./types.ts";
import * as git from "./git.ts";

export function enrichDeletion(deletion: Deletion): Metadata {
  const now = new Date().toISOString().split("T")[0];

  const birthDateRaw = git.getFileCreationDate(deletion.filePath);
  const birthDate = birthDateRaw ? birthDateRaw.split("T")[0] : "unknown origin";

  const author = git.getFileAuthor(deletion.filePath) ?? "unknown";
  const lastEditor = git.getLastEditor(deletion.filePath) ?? "unknown";
  const commitCount = git.getCommitCount(deletion.filePath);
  const causeOfDeath = git.getLatestCommitMessage();

  const linesOfCode =
    deletion.type === "file"
      ? countFileLines(deletion)
      : deletion.removedLines.length;

  return {
    birthDate,
    deathDate: now,
    author,
    lastEditor,
    commitCount,
    linesOfCode,
    causeOfDeath,
  };
}

function countFileLines(deletion: Deletion): number {
  const content = git.getFileContentBeforeDeletion(deletion.filePath);
  if (content) {
    return content.split("\n").length;
  }
  return deletion.removedLines.length;
}
