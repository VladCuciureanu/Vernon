import type { Deletion } from "./types.js";
import { detectLanguage, detectDeletedFunctions } from "./function-detector.js";

interface DiffFile {
  filePath: string;
  isDeleted: boolean;
  removedLines: string[];
}

export function parseDiff(rawDiff: string): Deletion[] {
  if (!rawDiff.trim()) return [];

  const files = splitIntoFiles(rawDiff);
  const deletions: Deletion[] = [];

  for (const file of files) {
    if (file.isDeleted) {
      // Whole file deleted
      deletions.push({
        type: "file",
        name: file.filePath.split("/").pop() || file.filePath,
        filePath: file.filePath,
        language: detectLanguage(file.filePath),
        removedLines: file.removedLines,
      });
    } else if (file.removedLines.length > 0) {
      // Partial deletion — look for function removals
      const funcDeletions = detectDeletedFunctions(file.removedLines, file.filePath);
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

    // Extract file path from "a/path b/path"
    const headerMatch = lines[0]?.match(/a\/(.+?) b\//);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];

    const isDeleted = chunk.includes("deleted file mode");

    // Collect removed lines (lines starting with - but not ---)
    const removedLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("-") && !line.startsWith("---")) {
        removedLines.push(line.slice(1)); // strip the leading -
      }
    }

    files.push({ filePath, isDeleted, removedLines });
  }

  return files;
}
