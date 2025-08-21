import { assertEquals, assert } from "@std/assert";
import { existsSync } from "@std/fs";
import { join } from "@std/path";
import { appendToCemetery, readCemetery } from "../src/cemetery.ts";
import type { Obituary } from "../src/types.ts";

function makeTempDir(): string {
  return Deno.makeTempDirSync({ prefix: "vernon-test-" });
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

Deno.test("appendToCemetery - creates CEMETERY.md with header when it does not exist", () => {
  const dir = makeTempDir();
  const cemeteryPath = join(dir, "CEMETERY.md");
  assertEquals(existsSync(cemeteryPath), false);

  appendToCemetery([makeObituary()], dir);

  assertEquals(existsSync(cemeteryPath), true);
  const content = Deno.readTextFileSync(cemeteryPath);
  assert(content.includes("# Code Cemetery"));
  assert(content.includes("Where deleted code rests in peace"));
});

Deno.test("appendToCemetery - writes obituary text as blockquote", () => {
  const dir = makeTempDir();
  appendToCemetery([makeObituary()], dir);

  const content = Deno.readTextFileSync(join(dir, "CEMETERY.md"));
  assert(content.includes("> Here lies testFunc(). It was a good function."));
});

Deno.test("appendToCemetery - includes function name with path as heading", () => {
  const dir = makeTempDir();
  appendToCemetery([makeObituary()], dir);

  const content = Deno.readTextFileSync(join(dir, "CEMETERY.md"));
  assert(content.includes("### testFunc() (src/test.ts)"));
});

Deno.test("appendToCemetery - uses filePath as heading for file deletions", () => {
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

  const content = Deno.readTextFileSync(join(dir, "CEMETERY.md"));
  assert(content.includes("### src/old.ts"));
});

Deno.test("appendToCemetery - includes a date heading", () => {
  const dir = makeTempDir();
  appendToCemetery([makeObituary()], dir);

  const today = new Date().toISOString().split("T")[0];
  const content = Deno.readTextFileSync(join(dir, "CEMETERY.md"));
  assert(content.includes(`## ${today}`));
});

Deno.test("appendToCemetery - appends to existing CEMETERY.md", () => {
  const dir = makeTempDir();
  const cemeteryPath = join(dir, "CEMETERY.md");
  Deno.writeTextFileSync(cemeteryPath, "# Code Cemetery\n\n## 2025-01-01\n\n### old stuff\n\n> old obit\n\n");

  appendToCemetery([makeObituary()], dir);

  const content = Deno.readTextFileSync(cemeteryPath);
  assert(content.includes("### old stuff"));
  assert(content.includes("### testFunc() (src/test.ts)"));
});

Deno.test("appendToCemetery - handles multiple obituaries", () => {
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

  const content = Deno.readTextFileSync(join(dir, "CEMETERY.md"));
  assert(content.includes("> Obit one."));
  assert(content.includes("> Obit two."));
  assert(content.includes("### anotherFunc() (src/other.ts)"));
});

Deno.test("appendToCemetery - does nothing for empty array", () => {
  const dir = makeTempDir();
  appendToCemetery([], dir);
  assertEquals(existsSync(join(dir, "CEMETERY.md")), false);
});

Deno.test("readCemetery - returns null when no cemetery exists", () => {
  const dir = makeTempDir();
  assertEquals(readCemetery(dir), null);
});

Deno.test("readCemetery - returns content when cemetery exists", () => {
  const dir = makeTempDir();
  Deno.writeTextFileSync(join(dir, "CEMETERY.md"), "# Code Cemetery\nstuff");
  const content = readCemetery(dir);
  assert(content?.includes("# Code Cemetery"));
});
