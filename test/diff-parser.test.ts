import { assertEquals, assert } from "@std/assert";
import { parseDiff } from "../src/diff-parser.ts";

Deno.test("parseDiff - returns empty array for empty diff", () => {
  assertEquals(parseDiff(""), []);
  assertEquals(parseDiff("  \n  "), []);
});

Deno.test("parseDiff - detects a deleted file", () => {
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
  assertEquals(result.length, 1);
  assertEquals(result[0].type, "file");
  assertEquals(result[0].name, "utils.ts");
  assertEquals(result[0].filePath, "src/utils.ts");
  assertEquals(result[0].language, "javascript");
  assertEquals(result[0].removedLines.length, 3);
});

Deno.test("parseDiff - detects deleted functions in a modified file", () => {
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
  assert(result.length >= 2);
  const names = result.map((d) => d.name);
  assert(names.includes("getUserById"));
  assert(names.includes("deleteUser"));
  assert(result.every((d) => d.type === "function"));
});

Deno.test("parseDiff - handles multiple files in one diff", () => {
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
  assert(fileNames.includes("a.ts"));
  assert(fileNames.includes("b.py"));
});

Deno.test("parseDiff - ignores files with no removals", () => {
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
  assertEquals(result.length, 0);
});

Deno.test("parseDiff - does not treat --- header as a removed line", () => {
  const diff = `diff --git a/src/x.ts b/src/x.ts
index abc..def 100644
--- a/src/x.ts
+++ b/src/x.ts
@@ -1,2 +1,1 @@
-function old() {}
`;
  const result = parseDiff(diff);
  const allRemoved = result.flatMap((d) => d.removedLines);
  assert(allRemoved.every((l) => !l.startsWith("-- ")));
});
