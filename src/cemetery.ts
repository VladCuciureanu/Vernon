import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getRepoRoot } from "./git.ts";
import type { Obituary } from "./types.ts";

const HEADER = "# Code Cemetery\n\n> Where deleted code rests in peace.\n";

function getCemeteryPath(repoRoot = getRepoRoot()): string {
  return join(repoRoot, "CEMETERY.md");
}

export function appendToCemetery(obituaries: Obituary[], repoRoot?: string): void {
  if (obituaries.length === 0) return;

  const path = getCemeteryPath(repoRoot);
  let existing = "";

  if (existsSync(path)) {
    existing = readFileSync(path, "utf8");
  } else {
    existing = HEADER;
  }

  const date = new Date().toISOString().split("T")[0];
  const dateHeading = `## ${date}\n`;

  let section = "";
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

  writeFileSync(path, existing + section);
}

export function readCemetery(repoRoot?: string): string | null {
  const path = getCemeteryPath(repoRoot);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}
