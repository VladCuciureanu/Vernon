import assert from "node:assert/strict";
import { test } from "node:test";
import { createEnricher, type FileLookups } from "../src/metadata.ts";
import type { Deletion } from "../src/types.ts";

function countingLookups(): { lookups: FileLookups; calls: string[] } {
  const calls: string[] = [];
  const lookups: FileLookups = {
    getFileCreationDate: (p) => (calls.push(`created ${p}`), "2022-03-15T10:00:00+00:00"),
    getFileAuthor: (p) => (calls.push(`author ${p}`), "Jane"),
    getLastEditor: (p) => (calls.push(`editor ${p}`), "John"),
    getCommitCount: (p) => (calls.push(`count ${p}`), 4),
    getCauseOfDeath: (p) => (calls.push(`cause ${p}`), "cleanup"),
    getFileContentBeforeDeletion: (p) => (calls.push(`content ${p}`), "a\nb\nc"),
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

  assert.deepEqual(calls.filter((c) => c.endsWith("src/x.ts")).length, 5);
  assert.deepEqual(calls.filter((c) => c.endsWith("src/y.ts")).length, 5);
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
