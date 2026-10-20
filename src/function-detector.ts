import type { Deletion } from "./types.ts";

interface LanguagePattern {
  extensions: string[];
  patterns: RegExp[];
}

// Keywords that look like `name(...) {` but are control flow, not definitions.
const CONTROL_FLOW_KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "foreach",
  "while",
  "do",
  "switch",
  "case",
  "catch",
  "try",
  "finally",
  "with",
  "return",
  "throw",
  "typeof",
  "await",
  "yield",
  "elif",
  "elsif",
  "unless",
  "until",
  "synchronized",
]);

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
    patterns: [/def\s+(\w+)\s*\(/, /class\s+(\w+)/],
  },
  go: {
    extensions: [".go"],
    patterns: [/func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/],
  },
  rust: {
    extensions: [".rs"],
    patterns: [/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, /impl\s+(\w+)/],
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
    patterns: [/def\s+(\w+)/, /class\s+(\w+)/],
  },
  php: {
    extensions: [".php"],
    patterns: [/function\s+(\w+)\s*\(/, /class\s+(\w+)/],
  },
};

export function detectLanguage(filePath: string): string {
  const ext = "." + filePath.split(".").pop();
  for (const [lang, { extensions }] of Object.entries(LANGUAGES)) {
    if (extensions.includes(ext)) return lang;
  }
  return "unknown";
}

export interface DetectOptions {
  // Lines added in the same file. A signature that is removed but re-added
  // (edited, moved, reformatted) is not a deletion.
  addedLines?: string[];
  // Index into removedLines where each hunk starts; a function's removed lines
  // never extend past the end of its hunk.
  hunkStarts?: number[];
}

function matchName(line: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const name = line.match(pattern)?.[1];
    if (name && !CONTROL_FLOW_KEYWORDS.has(name)) return name;
  }
  return null;
}

export function detectDeletedFunctions(
  removedLines: string[],
  filePath: string,
  { addedLines = [], hunkStarts = [] }: DetectOptions = {},
): Deletion[] {
  const language = detectLanguage(filePath);
  const langDef = LANGUAGES[language];
  if (!langDef) return [];

  const stillDefined = new Set<string>();
  for (const line of addedLines) {
    const name = matchName(line, langDef.patterns);
    if (name) stillDefined.add(name);
  }

  // Each signature owns the removed lines up to the next signature or the end
  // of its hunk, whichever comes first.
  const signatures: { index: number; name: string }[] = [];
  removedLines.forEach((line, index) => {
    const name = matchName(line, langDef.patterns);
    if (name) signatures.push({ index, name });
  });
  const boundaries = [
    ...new Set([...hunkStarts, ...signatures.map((s) => s.index), removedLines.length]),
  ].sort((a, b) => a - b);

  const deletions: Deletion[] = [];
  const seen = new Set<string>();

  for (const { index, name } of signatures) {
    if (seen.has(name) || stillDefined.has(name)) continue;
    seen.add(name);
    const end = boundaries.find((b) => b > index) ?? removedLines.length;
    deletions.push({
      type: "function",
      name,
      filePath,
      language,
      removedLines: removedLines.slice(index, end),
    });
  }

  return deletions;
}
