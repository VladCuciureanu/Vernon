export interface Deletion {
  type: "file" | "function";
  name: string;
  filePath: string;
  language: string;
  removedLines: string[];
}

export interface Metadata {
  birthDate: string;
  deathDate: string;
  author: string;
  lastEditor: string;
  commitCount: number;
  linesOfCode: number;
  causeOfDeath: string;
}

export interface Obituary {
  deletion: Deletion;
  metadata: Metadata;
  text: string;
  timestamp: string;
}

export interface CliOptions {
  command: "scan" | "diff" | "history" | "hook" | "mourn";
  ref?: string;
  hookAction?: "install" | "uninstall";
  mournPath?: string;
  dryRun: boolean;
  verbose: boolean;
  limit: number;
}
