import type { Deletion } from "./types.ts";
import { detectLanguage, detectDeletedFunctions } from "./function-detector.ts";

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
      deletions.push({
        type: "file",
        name: file.filePath.split("/").pop() || file.filePath,
        filePath: file.filePath,
        language: detectLanguage(file.filePath),
        removedLines: file.removedLines,
      });
    } else if (file.removedLines.length > 0) {
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

    const headerMatch = lines[0]?.match(/a\/(.+?) b\//);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];

    const isDeleted = chunk.includes("deleted file mode");

    const removedLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("-") && !line.startsWith("---")) {
        removedLines.push(line.slice(1));
      }
    }

    files.push({ filePath, isDeleted, removedLines });
  }

  return files;
}
