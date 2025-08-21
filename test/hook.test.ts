import { assertEquals, assert } from "@std/assert";
import { existsSync } from "@std/fs";
import { join } from "@std/path";
import { installHook, uninstallHook } from "../src/hook.ts";

function makeTempRepo(): string {
  const dir = Deno.makeTempDirSync({ prefix: "vernon-hook-test-" });
  const hooksDir = join(dir, ".git", "hooks");
  Deno.mkdirSync(hooksDir, { recursive: true });
  return dir;
}

Deno.test("installHook - creates pre-commit hook file", () => {
  const dir = makeTempRepo();
  installHook(dir);

  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  assertEquals(existsSync(hookPath), true);

  const content = Deno.readTextFileSync(hookPath);
  assert(content.includes("#!/bin/sh"));
  assert(content.includes("# vernon hook"));
  assert(content.includes("vernon"));
});

Deno.test("installHook - appends to existing hook without overwriting", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  Deno.writeTextFileSync(hookPath, "#!/bin/sh\nnpx lint-staged\n");
  Deno.chmodSync(hookPath, 0o755);

  installHook(dir);

  const content = Deno.readTextFileSync(hookPath);
  assert(content.includes("npx lint-staged"));
  assert(content.includes("# vernon hook"));
});

Deno.test("installHook - does not duplicate when already installed", () => {
  const dir = makeTempRepo();
  installHook(dir);
  installHook(dir);

  const content = Deno.readTextFileSync(join(dir, ".git", "hooks", "pre-commit"));
  const matches = content.match(/# vernon hook/g);
  assertEquals(matches?.length, 1);
});

Deno.test("uninstallHook - removes hook file when only vernon lines present", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  installHook(dir);
  assertEquals(existsSync(hookPath), true);

  uninstallHook(dir);
  assertEquals(existsSync(hookPath), false);
});

Deno.test("uninstallHook - preserves other hook content when uninstalling", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  Deno.writeTextFileSync(
    hookPath,
    "#!/bin/sh\nnpx lint-staged\n# vernon hook\ndeno run --allow-run --allow-read --allow-write jsr:@vladcuciureanu/vernon diff\n",
  );

  uninstallHook(dir);

  const content = Deno.readTextFileSync(hookPath);
  assert(content.includes("npx lint-staged"));
  assert(!content.includes("# vernon hook"));
});

Deno.test("uninstallHook - handles missing hook file gracefully", () => {
  const dir = makeTempRepo();
  // Should not throw
  uninstallHook(dir);
});

Deno.test("uninstallHook - handles hook without vernon marker gracefully", () => {
  const dir = makeTempRepo();
  const hookPath = join(dir, ".git", "hooks", "pre-commit");
  Deno.writeTextFileSync(hookPath, "#!/bin/sh\nnpx lint-staged\n");

  uninstallHook(dir);
  const content = Deno.readTextFileSync(hookPath);
  assert(content.includes("npx lint-staged"));
});
