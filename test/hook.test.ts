import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installHook, uninstallHook } from "../src/hook.ts";

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "vernon-hook-test-"));
  const hooksDir = join(dir, ".git", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  return dir;
}

test("installHook - creates pre-commit hook file", () => {
  const dir = makeTempRepo();
  installHook(dir);

  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  assert.deepEqual(existsSync(hookPath), true);

  const content = readFileSync(hookPath, "utf8");
  assert.ok(content.includes("#!/bin/sh"));
  assert.ok(content.includes("# vernon hook"));
  assert.ok(content.includes("vernon"));
});

test("installHook - appends to existing hook without overwriting", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  writeFileSync(hookPath, "#!/bin/sh\nnpx lint-staged\n");
  chmodSync(hookPath, 0o755);

  installHook(dir);

  const content = readFileSync(hookPath, "utf8");
  assert.ok(content.includes("npx lint-staged"));
  assert.ok(content.includes("# vernon hook"));
});

test("installHook - does not duplicate when already installed", () => {
  const dir = makeTempRepo();
  installHook(dir);
  installHook(dir);

  const content = readFileSync(join(dir, ".git", "hooks", "pre-commit"), "utf8");
  const matches = content.match(/# vernon hook/g);
  assert.deepEqual(matches?.length, 1);
});

test("uninstallHook - removes hook file when only vernon lines present", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  installHook(dir);
  assert.deepEqual(existsSync(hookPath), true);

  uninstallHook(dir);
  assert.deepEqual(existsSync(hookPath), false);
});

test("uninstallHook - preserves other hook content when uninstalling", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  writeFileSync(
    hookPath,
    "#!/bin/sh\nnpx lint-staged\n# vernon hook\nnpx @vladcuciureanu/vernon diff\n",
  );

  uninstallHook(dir);

  const content = readFileSync(hookPath, "utf8");
  assert.ok(content.includes("npx lint-staged"));
  assert.ok(!content.includes("# vernon hook"));
});

test("uninstallHook - handles missing hook file gracefully", () => {
  const dir = makeTempRepo();
  // Should not throw
  uninstallHook(dir);
});

test("uninstallHook - handles hook without vernon marker gracefully", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  writeFileSync(hookPath, "#!/bin/sh\nnpx lint-staged\n");

  uninstallHook(dir);
  const content = readFileSync(hookPath, "utf8");
  assert.ok(content.includes("npx lint-staged"));
});
