import type { Deletion } from "./types.js";

interface LanguagePattern {
  extensions: string[];
  patterns: RegExp[];
}

const LANGUAGES: Record<string, LanguagePattern> = {
  javascript: {
    extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
    patterns: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\w*\s*=>/,
      /^\s*(?:async\s+)?(\w+)\s*\(.*\)\s*\{/,
      /(?:export\s+)?class\s+(\w+)/,
    ],
  },
  python: {
    extensions: [".py"],
    patterns: [
      /def\s+(\w+)\s*\(/,
      /class\s+(\w+)/,
    ],
  },
  go: {
    extensions: [".go"],
    patterns: [
      /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/,
    ],
  },
  rust: {
    extensions: [".rs"],
    patterns: [
      /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
      /impl\s+(\w+)/,
    ],
  },
  java: {
    extensions: [".java", ".kt"],
    patterns: [
      /(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/,
      /class\s+(\w+)/,
    ],
  },
  ruby: {
    extensions: [".rb"],
    patterns: [
      /def\s+(\w+)/,
      /class\s+(\w+)/,
    ],
  },
  php: {
    extensions: [".php"],
    patterns: [
      /function\s+(\w+)\s*\(/,
      /class\s+(\w+)/,
    ],
  },
};

export function detectLanguage(filePath: string): string {
  const ext = "." + filePath.split(".").pop();
  for (const [lang, { extensions }] of Object.entries(LANGUAGES)) {
    if (extensions.includes(ext)) return lang;
  }
  return "unknown";
}

export function detectDeletedFunctions(
  removedLines: string[],
  filePath: string,
): Deletion[] {
  const language = detectLanguage(filePath);
  const langDef = LANGUAGES[language];
  if (!langDef) return [];

  const deletions: Deletion[] = [];
  const seen = new Set<string>();

  for (const line of removedLines) {
    for (const pattern of langDef.patterns) {
      const match = line.match(pattern);
      if (match?.[1] && !seen.has(match[1])) {
        seen.add(match[1]);
        deletions.push({
          type: "function",
          name: match[1],
          filePath,
          language,
          removedLines,
        });
      }
    }
  }

  return deletions;
}
