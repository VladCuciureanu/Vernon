import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Obituary } from "./types.js";
import { getRepoRoot } from "./git.js";

const HEADER = "# Code Cemetery\n\n> Where deleted code rests in peace.\n";

function getCemeteryPath(): string {
  const root = getRepoRoot() || process.cwd();
  return join(root, "CEMETERY.md");
}

export function appendToCemetery(obituaries: Obituary[]): void {
  if (obituaries.length === 0) return;

  const path = getCemeteryPath();
  let existing = "";

  if (existsSync(path)) {
    existing = readFileSync(path, "utf-8");
  } else {
    existing = HEADER;
  }

  const date = new Date().toISOString().split("T")[0];
  const dateHeading = `## ${date}\n`;

  let section = "";
  // Add date heading if not already present for today
  if (!existing.includes(dateHeading)) {
    section += `\n${dateHeading}\n`;
  }

  for (const obit of obituaries) {
    const location =
      obit.deletion.type === "function"
        ? `${obit.deletion.name}() (${obit.deletion.filePath})`
        : obit.deletion.filePath;

    section += `### ${location}\n\n`;
    section += `> ${obit.text}\n\n`;
  }

  writeFileSync(path, existing + section, "utf-8");
}

export function readCemetery(): string | null {
  const path = getCemeteryPath();
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}
