import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { installHook, uninstallHook } from "../src/hook.ts";

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "vernon-hook-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
  // Keep tests independent of any global core.hooksPath.
  execFileSync("git", ["config", "core.hooksPath", ".git/hooks"], { cwd: dir, stdio: "ignore" });
  mkdirSync(join(dir, ".git", "hooks"), { recursive: true });
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

test("installHook - runs the globally installed vernon bin, not npx", () => {
  const dir = makeTempRepo();
  installHook(dir);

  const content = readFileSync(join(dir, ".git", "hooks", "pre-commit"), "utf8");
  assert.ok(
    content.split("\n").includes("command -v vernon >/dev/null 2>&1 && vernon diff || true"),
  );
  assert.ok(!content.includes("npx"));
});

test("installHook - hook never blocks a commit when vernon fails", () => {
  const dir = makeTempRepo();
  installHook(dir);

  const binDir = mkdtempSync(join(tmpdir(), "vernon-bin-"));
  writeFileSync(join(binDir, "vernon"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(binDir, "vernon"), 0o755);

  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  const env = { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH}` };
  const result = spawnSync("sh", [hookPath], { cwd: dir, env });
  assert.equal(result.status, 0);
});

test("uninstallHook - removes legacy deno and npx hook lines", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  writeFileSync(
    hookPath,
    "#!/bin/sh\nnpx lint-staged\n" +
      "# vernon hook\ndeno run --allow-run --allow-read --allow-write jsr:@vladcuciureanu/vernon diff\n" +
      "# vernon hook\nnpx @vladcuciureanu/vernon diff\n" +
      "# vernon hook\nvernon diff\n",
  );

  uninstallHook(dir);

  const content = readFileSync(hookPath, "utf8");
  assert.deepEqual(content, "#!/bin/sh\nnpx lint-staged\n");
});

test("uninstallHook - keeps a user's own vernon diff line", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  writeFileSync(hookPath, "#!/bin/sh\nvernon diff\n");
  installHook(dir);

  uninstallHook(dir);

  assert.deepEqual(readFileSync(hookPath, "utf8"), "#!/bin/sh\nvernon diff\n");
});

test("installHook - honours core.hooksPath", () => {
  const dir = makeTempRepo();
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: dir, stdio: "ignore" });

  installHook(dir);

  assert.deepEqual(existsSync(join(dir, ".githooks", "pre-commit")), true);
  assert.deepEqual(existsSync(join(dir, ".git", "hooks", "pre-commit")), false);

  uninstallHook(dir);
  assert.deepEqual(existsSync(join(dir, ".githooks", "pre-commit")), false);
});

test("installHook - inserts before a trailing exit in an existing hook", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  writeFileSync(hookPath, "#!/bin/sh\nnpx lint-staged\nexit 0\n\n");

  installHook(dir);

  const content = readFileSync(hookPath, "utf8");
  assert.deepEqual(
    content,
    "#!/bin/sh\nnpx lint-staged\n# vernon hook\ncommand -v vernon >/dev/null 2>&1 && vernon diff || true\nexit 0\n",
  );

  uninstallHook(dir);
  assert.deepEqual(readFileSync(hookPath, "utf8"), "#!/bin/sh\nnpx lint-staged\nexit 0\n");
});
