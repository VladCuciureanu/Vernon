import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDiff } from "../src/diff-parser.ts";

test("parseDiff - returns empty array for empty diff", () => {
  assert.deepEqual(parseDiff(""), []);
  assert.deepEqual(parseDiff("  \n  "), []);
});

test("parseDiff - detects a deleted file", () => {
  const diff = `diff --git a/src/utils.ts b/src/utils.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/utils.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function helper() {
-  return true;
-}
`;
  const result = parseDiff(diff);
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].type, "file");
  assert.deepEqual(result[0].name, "utils.ts");
  assert.deepEqual(result[0].filePath, "src/utils.ts");
  assert.deepEqual(result[0].language, "javascript");
  assert.deepEqual(result[0].removedLines.length, 3);
});

test("parseDiff - detects deleted functions in a modified file", () => {
  const diff = `diff --git a/src/api.ts b/src/api.ts
index abc1234..def5678 100644
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,5 +0,0 @@
-export function getUserById(id: string) {
-  return db.query(id);
-}
-
-export function deleteUser(id: string) {
`;
  const result = parseDiff(diff);
  assert.ok(result.length >= 2);
  const names = result.map((d) => d.name);
  assert.ok(names.includes("getUserById"));
  assert.ok(names.includes("deleteUser"));
  assert.ok(result.every((d) => d.type === "function"));
});

test("parseDiff - handles multiple files in one diff", () => {
  const diff = `diff --git a/src/a.ts b/src/a.ts
deleted file mode 100644
index abc..000
--- a/src/a.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-console.log("a");
diff --git a/src/b.py b/src/b.py
deleted file mode 100644
index abc..000
--- a/src/b.py
+++ /dev/null
@@ -1,1 +0,0 @@
-print("b")
`;
  const result = parseDiff(diff);
  const fileNames = result.map((d) => d.name);
  assert.ok(fileNames.includes("a.ts"));
  assert.ok(fileNames.includes("b.py"));
});

test("parseDiff - ignores files with no removals", () => {
  const diff = `diff --git a/src/new.ts b/src/new.ts
index 000..abc 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,3 @@
+export function newFunc() {
+  return 42;
+}
`;
  const result = parseDiff(diff);
  assert.deepEqual(result.length, 0);
});

test("parseDiff - does not treat --- header as a removed line", () => {
  const diff = `diff --git a/src/x.ts b/src/x.ts
index abc..def 100644
--- a/src/x.ts
+++ b/src/x.ts
@@ -1,2 +1,1 @@
-function old() {}
`;
  const result = parseDiff(diff);
  const allRemoved = result.flatMap((d) => d.removedLines);
  assert.ok(allRemoved.every((l) => !l.startsWith("-- ")));
});

test('parseDiff - handles paths containing " b/"', () => {
  const diff = `diff --git a/docs/a b/c.ts b/docs/a b/c.ts
deleted file mode 100644
index abc..000
--- a/docs/a b/c.ts\t
+++ /dev/null
@@ -1 +0,0 @@
-export const x = 1;
`;
  const result = parseDiff(diff);
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].type, "file");
  assert.deepEqual(result[0].filePath, "docs/a b/c.ts");
  assert.deepEqual(result[0].name, "c.ts");
});

test("parseDiff - 'deleted file mode' in file content does not mark the file deleted", () => {
  const diff = `diff --git a/src/notes.ts b/src/notes.ts
index abc..def 100644
--- a/src/notes.ts
+++ b/src/notes.ts
@@ -1 +1 @@
-// deleted file mode is a git header
+// renamed comment
`;
  const result = parseDiff(diff);
  assert.ok(result.every((d) => d.type !== "file"));
});

test("parseDiff - removed lines that start with -- are kept", () => {
  const diff = `diff --git a/db/schema.ts b/db/schema.ts
index abc..def 100644
--- a/db/schema.ts
+++ b/db/schema.ts
@@ -1,2 +0,0 @@
-function dropTable() {
--- comment
`;
  const result = parseDiff(diff);
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "dropTable");
  assert.deepEqual(result[0].removedLines, ["function dropTable() {", "-- comment"]);
});

test("parseDiff - unquotes paths git quoted", () => {
  const diff = `diff --git "a/src/caf\\303\\251.ts" "b/src/caf\\303\\251.ts"
deleted file mode 100644
index abc..000
--- "a/src/caf\\303\\251.ts"
+++ /dev/null
@@ -1 +0,0 @@
-export const x = 1;
`;
  const result = parseDiff(diff);
  assert.deepEqual(result[0]?.filePath, "src/café.ts");
});

test("parseDiff - deleted binary file uses the diff --git header", () => {
  const diff = `diff --git a/img/a b/logo.png b/img/a b/logo.png
deleted file mode 100644
index abc..000
Binary files a/img/a b/logo.png and /dev/null differ
`;
  const result = parseDiff(diff);
  assert.deepEqual(result[0]?.filePath, "img/a b/logo.png");
});

test("parseDiff - an edited signature is not a deleted function", () => {
  const diff = `diff --git a/src/api.ts b/src/api.ts
index abc..def 100644
--- a/src/api.ts
+++ b/src/api.ts
@@ -1 +1 @@
-export function getUser(id: string) {
+export function getUser(id: string, opts: Options) {
@@ -10,3 +10,0 @@
-export function dropUser(id: string) {
-  return db.drop(id);
-}
@@ -20 +17 @@
-const limit = 10;
+const limit = 20;
`;
  const result = parseDiff(diff);
  assert.deepEqual(
    result.map((d) => d.name),
    ["dropUser"],
  );
  assert.deepEqual(result[0].removedLines, [
    "export function dropUser(id: string) {",
    "  return db.drop(id);",
    "}",
  ]);
});
