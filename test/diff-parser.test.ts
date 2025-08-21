import { describe, it, expect } from "vitest";
import { parseDiff } from "../src/diff-parser.js";

describe("parseDiff", () => {
  it("returns empty array for empty diff", () => {
    expect(parseDiff("")).toEqual([]);
    expect(parseDiff("  \n  ")).toEqual([]);
  });

  it("detects a deleted file", () => {
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
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("file");
    expect(result[0].name).toBe("utils.ts");
    expect(result[0].filePath).toBe("src/utils.ts");
    expect(result[0].language).toBe("javascript");
    expect(result[0].removedLines).toHaveLength(3);
  });

  it("detects deleted functions in a modified file", () => {
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
    expect(result.length).toBeGreaterThanOrEqual(2);
    const names = result.map((d) => d.name);
    expect(names).toContain("getUserById");
    expect(names).toContain("deleteUser");
    expect(result.every((d) => d.type === "function")).toBe(true);
  });

  it("handles multiple files in one diff", () => {
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
    expect(fileNames).toContain("a.ts");
    expect(fileNames).toContain("b.py");
  });

  it("ignores files with no removals", () => {
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
    expect(result).toHaveLength(0);
  });

  it("does not treat --- header as a removed line", () => {
    const diff = `diff --git a/src/x.ts b/src/x.ts
index abc..def 100644
--- a/src/x.ts
+++ b/src/x.ts
@@ -1,2 +1,1 @@
-function old() {}
`;
    const result = parseDiff(diff);
    // Should find the function, and removedLines should not include the "--- a/src/x.ts" line
    const allRemoved = result.flatMap((d) => d.removedLines);
    expect(allRemoved.every((l) => !l.startsWith("-- "))).toBe(true);
  });
});
