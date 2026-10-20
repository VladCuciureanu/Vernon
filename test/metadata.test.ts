import assert from "node:assert/strict";
import { test } from "node:test";
import { createEnricher, type FileLookups } from "../src/metadata.ts";
import type { Deletion } from "../src/types.ts";

function countingLookups(): { lookups: FileLookups; calls: string[] } {
  const calls: string[] = [];
  const record =
    <T>(label: string, value: T) =>
    (p: string): T => {
      calls.push(`${label} ${p}`);
      return value;
    };
  const lookups: FileLookups = {
    getFileOrigin: record("origin", { date: "2022-03-15T10:00:00+00:00", author: "Jane" }),
    getLastEditor: record("editor", "John"),
    getCommitCount: record("count", 4),
    getCauseOfDeath: record("cause", "cleanup"),
    getFileContentBeforeDeletion: record("content", "a\nb\nc"),
  };
  return { lookups, calls };
}

function fn(name: string, filePath: string, lines = 2): Deletion {
  return {
    type: "function",
    name,
    filePath,
    language: "javascript",
    removedLines: Array(lines).fill("x"),
  };
}

test("createEnricher - runs each file's git lookups once", () => {
  const { lookups, calls } = countingLookups();
  const enrich = createEnricher({ kind: "commits" }, lookups);

  enrich(fn("a", "src/x.ts"));
  enrich(fn("b", "src/x.ts"));
  enrich(fn("c", "src/x.ts"));
  enrich(fn("d", "src/y.ts"));

  assert.deepEqual(calls.filter((c) => c.endsWith("src/x.ts")).length, 4);
  assert.deepEqual(calls.filter((c) => c.endsWith("src/y.ts")).length, 4);
});

test("createEnricher - builds metadata from the lookups", () => {
  const { lookups } = countingLookups();
  const enrich = createEnricher({ kind: "commits" }, lookups);

  const fnMeta = enrich(fn("a", "src/x.ts", 7));
  assert.deepEqual(fnMeta.birthDate, "2022-03-15");
  assert.deepEqual(fnMeta.author, "Jane");
  assert.deepEqual(fnMeta.lastEditor, "John");
  assert.deepEqual(fnMeta.commitCount, 4);
  assert.deepEqual(fnMeta.causeOfDeath, "cleanup");
  assert.deepEqual(fnMeta.linesOfCode, 7);

  const fileMeta = enrich({ ...fn("x.ts", "src/x.ts"), type: "file" });
  assert.deepEqual(fileMeta.linesOfCode, 3);
});
