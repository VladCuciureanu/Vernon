import { describe, it, expect, vi, beforeEach } from "vitest";
import { installHook, uninstallHook } from "../src/hook.js";
import { existsSync, readFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync, chmodSync } from "node:fs";

let tempDir: string;
let hooksDir: string;

vi.mock("../src/git.js", () => ({
  getRepoRoot: () => tempDir,
}));

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "vernon-hook-test-"));
  hooksDir = join(tempDir, ".git", "hooks");
  mkdirSync(hooksDir, { recursive: true });
});

describe("hook", () => {
  describe("installHook", () => {
    it("creates pre-commit hook file", () => {
      installHook();

      const hookPath = join(hooksDir, "pre-commit");
      expect(existsSync(hookPath)).toBe(true);

      const content = readFileSync(hookPath, "utf-8");
      expect(content).toContain("#!/bin/sh");
      expect(content).toContain("# vernon hook");
      expect(content).toContain("npx vernon diff");
    });

    it("appends to existing hook without overwriting", () => {
      const hookPath = join(hooksDir, "pre-commit");
      writeFileSync(hookPath, "#!/bin/sh\nnpx lint-staged\n");
      chmodSync(hookPath, 0o755);

      installHook();

      const content = readFileSync(hookPath, "utf-8");
      expect(content).toContain("npx lint-staged");
      expect(content).toContain("# vernon hook");
      expect(content).toContain("npx vernon diff");
    });

    it("does not duplicate when already installed", () => {
      installHook();
      installHook(); // second call

      const content = readFileSync(join(hooksDir, "pre-commit"), "utf-8");
      const matches = content.match(/# vernon hook/g);
      expect(matches).toHaveLength(1);
    });
  });

  describe("uninstallHook", () => {
    it("removes hook file when only vernon lines present", () => {
      installHook();
      const hookPath = join(hooksDir, "pre-commit");
      expect(existsSync(hookPath)).toBe(true);

      uninstallHook();
      expect(existsSync(hookPath)).toBe(false);
    });

    it("preserves other hook content when uninstalling", () => {
      const hookPath = join(hooksDir, "pre-commit");
      writeFileSync(hookPath, "#!/bin/sh\nnpx lint-staged\n# vernon hook\nnpx vernon diff\n");

      uninstallHook();

      const content = readFileSync(hookPath, "utf-8");
      expect(content).toContain("npx lint-staged");
      expect(content).not.toContain("# vernon hook");
      expect(content).not.toContain("npx vernon diff");
    });

    it("handles missing hook file gracefully", () => {
      // Should not throw
      expect(() => uninstallHook()).not.toThrow();
    });

    it("handles hook without vernon marker gracefully", () => {
      const hookPath = join(hooksDir, "pre-commit");
      writeFileSync(hookPath, "#!/bin/sh\nnpx lint-staged\n");

      expect(() => uninstallHook()).not.toThrow();
      const content = readFileSync(hookPath, "utf-8");
      expect(content).toContain("npx lint-staged");
    });
  });
});
