import { describe, it, expect, vi, beforeEach } from "vitest";
import { appendToCemetery, readCemetery } from "../src/cemetery.js";
import type { Obituary } from "../src/types.js";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock getRepoRoot to use a temp directory
vi.mock("../src/git.js", () => ({
  getRepoRoot: () => tempDir,
}));

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "vernon-test-"));
});

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

describe("cemetery", () => {
  describe("appendToCemetery", () => {
    it("creates CEMETERY.md with header when it does not exist", () => {
      const cemeteryPath = join(tempDir, "CEMETERY.md");
      expect(existsSync(cemeteryPath)).toBe(false);

      appendToCemetery([makeObituary()]);

      expect(existsSync(cemeteryPath)).toBe(true);
      const content = readFileSync(cemeteryPath, "utf-8");
      expect(content).toContain("# Code Cemetery");
      expect(content).toContain("Where deleted code rests in peace");
    });

    it("writes obituary text as blockquote", () => {
      appendToCemetery([makeObituary()]);

      const content = readFileSync(join(tempDir, "CEMETERY.md"), "utf-8");
      expect(content).toContain("> Here lies testFunc(). It was a good function.");
    });

    it("includes function name with path as heading", () => {
      appendToCemetery([makeObituary()]);

      const content = readFileSync(join(tempDir, "CEMETERY.md"), "utf-8");
      expect(content).toContain("### testFunc() (src/test.ts)");
    });

    it("uses filePath as heading for file deletions", () => {
      const obit = makeObituary({
        deletion: {
          type: "file",
          name: "old.ts",
          filePath: "src/old.ts",
          language: "javascript",
          removedLines: [],
        },
      });
      appendToCemetery([obit]);

      const content = readFileSync(join(tempDir, "CEMETERY.md"), "utf-8");
      expect(content).toContain("### src/old.ts");
    });

    it("includes a date heading", () => {
      appendToCemetery([makeObituary()]);

      const today = new Date().toISOString().split("T")[0];
      const content = readFileSync(join(tempDir, "CEMETERY.md"), "utf-8");
      expect(content).toContain(`## ${today}`);
    });

    it("appends to existing CEMETERY.md", () => {
      const cemeteryPath = join(tempDir, "CEMETERY.md");
      writeFileSync(cemeteryPath, "# Code Cemetery\n\n## 2025-01-01\n\n### old stuff\n\n> old obit\n\n");

      appendToCemetery([makeObituary()]);

      const content = readFileSync(cemeteryPath, "utf-8");
      expect(content).toContain("### old stuff");
      expect(content).toContain("### testFunc() (src/test.ts)");
    });

    it("handles multiple obituaries", () => {
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

      appendToCemetery([obit1, obit2]);

      const content = readFileSync(join(tempDir, "CEMETERY.md"), "utf-8");
      expect(content).toContain("> Obit one.");
      expect(content).toContain("> Obit two.");
      expect(content).toContain("### anotherFunc() (src/other.ts)");
    });

    it("does nothing for empty array", () => {
      appendToCemetery([]);
      expect(existsSync(join(tempDir, "CEMETERY.md"))).toBe(false);
    });
  });

  describe("readCemetery", () => {
    it("returns null when no cemetery exists", () => {
      expect(readCemetery()).toBeNull();
    });

    it("returns content when cemetery exists", () => {
      writeFileSync(join(tempDir, "CEMETERY.md"), "# Code Cemetery\nstuff");
      expect(readCemetery()).toContain("# Code Cemetery");
    });
  });
});
