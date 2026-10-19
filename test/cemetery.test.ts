import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendToCemetery, readCemetery } from "../src/cemetery.ts";
import type { Obituary } from "../src/types.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "vernon-test-"));
}

function makeObituary(overrides: Partial<Obituary> = {}): Obituary {
  return {
    deletion: {
      type: "function",
      name: "testFunc",
      filePath: "src/test.ts",
      language: "javascript",
      removedLines: [],
    },
    metadata: {
      birthDate: "2022-01-01",
      deathDate: "2026-03-24",
      author: "Alice",
      lastEditor: "Bob",
      commitCount: 10,
      linesOfCode: 5,
      causeOfDeath: "cleanup",
    },
    text: "Here lies testFunc(). It was a good function.",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

test("appendToCemetery - creates CEMETERY.md with header when it does not exist", () => {
  const dir = makeTempDir();
  const cemeteryPath = join(dir, "CEMETERY.md");
  assert.deepEqual(existsSync(cemeteryPath), false);

  appendToCemetery([makeObituary()], dir);

  assert.deepEqual(existsSync(cemeteryPath), true);
  const content = readFileSync(cemeteryPath, "utf8");
  assert.ok(content.includes("# Code Cemetery"));
  assert.ok(content.includes("Where deleted code rests in peace"));
});

test("appendToCemetery - writes obituary text as blockquote", () => {
  const dir = makeTempDir();
  appendToCemetery([makeObituary()], dir);

  const content = readFileSync(join(dir, "CEMETERY.md"), "utf8");
  assert.ok(content.includes("> Here lies testFunc(). It was a good function."));
});

test("appendToCemetery - includes function name with path as heading", () => {
  const dir = makeTempDir();
  appendToCemetery([makeObituary()], dir);

  const content = readFileSync(join(dir, "CEMETERY.md"), "utf8");
  assert.ok(content.includes("### testFunc() (src/test.ts)"));
});

test("appendToCemetery - uses filePath as heading for file deletions", () => {
  const dir = makeTempDir();
  const obit = makeObituary({
    deletion: {
      type: "file",
      name: "old.ts",
      filePath: "src/old.ts",
      language: "javascript",
      removedLines: [],
    },
  });
  appendToCemetery([obit], dir);

  const content = readFileSync(join(dir, "CEMETERY.md"), "utf8");
  assert.ok(content.includes("### src/old.ts"));
});

test("appendToCemetery - includes a date heading", () => {
  const dir = makeTempDir();
  appendToCemetery([makeObituary()], dir);

  const today = new Date().toISOString().split("T")[0];
  const content = readFileSync(join(dir, "CEMETERY.md"), "utf8");
  assert.ok(content.includes(`## ${today}`));
});

test("appendToCemetery - appends to existing CEMETERY.md", () => {
  const dir = makeTempDir();
  const cemeteryPath = join(dir, "CEMETERY.md");
  writeFileSync(cemeteryPath, "# Code Cemetery\n\n## 2025-01-01\n\n### old stuff\n\n> old obit\n\n");

  appendToCemetery([makeObituary()], dir);

  const content = readFileSync(cemeteryPath, "utf8");
  assert.ok(content.includes("### old stuff"));
  assert.ok(content.includes("### testFunc() (src/test.ts)"));
});

test("appendToCemetery - handles multiple obituaries", () => {
  const dir = makeTempDir();
  const obit1 = makeObituary({ text: "Obit one." });
  const obit2 = makeObituary({
    deletion: {
      type: "function",
      name: "anotherFunc",
      filePath: "src/other.ts",
      language: "javascript",
      removedLines: [],
    },
    text: "Obit two.",
  });

  appendToCemetery([obit1, obit2], dir);

  const content = readFileSync(join(dir, "CEMETERY.md"), "utf8");
  assert.ok(content.includes("> Obit one."));
  assert.ok(content.includes("> Obit two."));
  assert.ok(content.includes("### anotherFunc() (src/other.ts)"));
});

test("appendToCemetery - does nothing for empty array", () => {
  const dir = makeTempDir();
  appendToCemetery([], dir);
  assert.deepEqual(existsSync(join(dir, "CEMETERY.md")), false);
});

test("readCemetery - returns null when no cemetery exists", () => {
  const dir = makeTempDir();
  assert.deepEqual(readCemetery(dir), null);
});

test("readCemetery - returns content when cemetery exists", () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, "CEMETERY.md"), "# Code Cemetery\nstuff");
  const content = readCemetery(dir);
  assert.ok(content?.includes("# Code Cemetery"));
});
