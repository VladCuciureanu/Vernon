import type { CliOptions, Deletion } from "./types.ts";
import { isInsideGitRepo, getStagedDiff, getCommitDiff } from "./git.ts";
import { parseDiff } from "./diff-parser.ts";
import { enrichDeletion } from "./metadata.ts";
import { generateObituary } from "./obituary-generator.ts";
import { appendToCemetery, readCemetery } from "./cemetery.ts";
import { installHook, uninstallHook } from "./hook.ts";

function parseArgs(args: readonly string[]): CliOptions {
  const opts: CliOptions = {
    command: "scan",
    dryRun: false,
    verbose: false,
    limit: 20,
  };

  let i = 0;
  const command = args[0];

  if (command === "scan" || command === "diff" || command === "history" || command === "hook" || command === "mourn") {
    opts.command = command;
    i = 1;
  }

  while (i < args.length) {
    const arg = args[i];
    if (arg === "--ref" && args[i + 1]) {
      opts.ref = args[++i];
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--verbose") {
      opts.verbose = true;
    } else if (arg === "--limit" && args[i + 1]) {
      opts.limit = parseInt(args[++i], 10);
    } else if (opts.command === "hook" && (arg === "install" || arg === "uninstall")) {
      opts.hookAction = arg;
    } else if (opts.command === "mourn") {
      opts.mournPath = arg;
    }
    i++;
  }

  return opts;
}

function printUsage(): void {
  console.log(`
Vernon — Generate obituaries for deleted code

Commands:
  scan [--ref <ref>]       Scan latest commit for deletions (default)
  diff                     Scan staged changes (pre-commit mode)
  history                  Show the cemetery
  hook install|uninstall   Manage pre-commit hook
  mourn <path>             Write obituary for a file

Options:
  --dry-run                Print obituaries without writing to CEMETERY.md
  --verbose                Show detection details
  --limit N                Max obituaries to generate (default: 20)
`);
}

export function run(args: readonly string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const opts = parseArgs(args);

  if (opts.command === "history") {
    const content = readCemetery();
    if (content) {
      console.log(content);
    } else {
      console.log("No cemetery found. The codebase is immortal... for now.");
    }
    return;
  }

  if (opts.command === "hook") {
    if (opts.hookAction === "install") installHook();
    else if (opts.hookAction === "uninstall") uninstallHook();
    else console.log("Usage: vernon hook install|uninstall");
    return;
  }

  if (!isInsideGitRepo()) {
    console.error("Not inside a git repository.");
    Deno.exit(1);
  }

  let rawDiff: string;

  if (opts.command === "diff") {
    rawDiff = getStagedDiff();
  } else if (opts.command === "mourn" && opts.mournPath) {
    rawDiff = getCommitDiff(opts.ref);
  } else {
    rawDiff = getCommitDiff(opts.ref);
  }

  if (!rawDiff) {
    if (opts.verbose) console.log("No deletions detected.");
    return;
  }

  const deletions = parseDiff(rawDiff);

  if (opts.command === "mourn" && opts.mournPath) {
    const filtered = deletions.filter((d) => d.filePath === opts.mournPath);
    if (filtered.length === 0) {
      console.log(`No deletions found for ${opts.mournPath}`);
      return;
    }
    processObituaries(filtered, opts);
    return;
  }

  if (deletions.length === 0) {
    if (opts.verbose) console.log("No deletions detected.");
    return;
  }

  const limited = deletions.slice(0, opts.limit);
  if (opts.verbose && deletions.length > opts.limit) {
    console.log(`Found ${deletions.length} deletions, showing first ${opts.limit}.`);
  }

  processObituaries(limited, opts);
}

function processObituaries(deletions: Deletion[], opts: CliOptions): void {
  const obituaries = deletions.map((d) => {
    if (opts.verbose) {
      console.log(`  [${d.type}] ${d.name} (${d.filePath})`);
    }
    const metadata = enrichDeletion(d);
    return generateObituary(d, metadata);
  });

  if (obituaries.length === 0) return;

  console.log("");
  for (const obit of obituaries) {
    const icon = obit.deletion.type === "file" ? "\u{1F4C1}" : "\u26B0\uFE0F";
    console.log(`${icon}  ${obit.text}`);
    console.log("");
  }

  if (!opts.dryRun) {
    appendToCemetery(obituaries);
    console.log(`Written ${obituaries.length} obituar${obituaries.length === 1 ? "y" : "ies"} to CEMETERY.md`);
  }
}
