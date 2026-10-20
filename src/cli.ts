import { parseArgs } from "node:util";
import { appendToCemetery, readCemetery } from "./cemetery.ts";
import { parseDiff } from "./diff-parser.ts";
import { GitError, getCommitDiff, getStagedDiff, isInsideGitRepo } from "./git.ts";
import { installHook, uninstallHook } from "./hook.ts";
import { createEnricher } from "./metadata.ts";
import { generateObituary } from "./obituary-generator.ts";
import type { CliOptions, Deletion, DiffSource } from "./types.ts";

const COMMANDS = ["scan", "diff", "history", "hook", "mourn"] as const;

const OPTIONS = {
  ref: { type: "string" },
  "dry-run": { type: "boolean" },
  verbose: { type: "boolean" },
  limit: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

const SHORT_USAGE = "Usage: vernon [scan|diff|history|hook|mourn] [options]; see vernon --help";

class UsageError extends Error {}

function isCommand(arg: string): arg is CliOptions["command"] {
  return (COMMANDS as readonly string[]).includes(arg);
}

function strictParse(args: readonly string[]) {
  try {
    return parseArgs({ args: [...args], options: OPTIONS, strict: true, allowPositionals: true });
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
    // node:util's messages run on with advice about `--`; keep the first sentence.
    const message = err.message.split(/\.\s|\n/)[0];
    throw new UsageError(message.charAt(0).toLowerCase() + message.slice(1));
  }
}

// The options each command accepts, besides --help.
const COMMAND_OPTIONS: Record<CliOptions["command"], readonly (keyof typeof OPTIONS)[]> = {
  scan: ["ref", "dry-run", "verbose", "limit"],
  diff: ["dry-run", "verbose", "limit"],
  mourn: ["ref", "dry-run", "verbose"],
  history: [],
  hook: [],
};

// Throws UsageError for unknown commands or options, missing option values or
// arguments, options the command doesn't take, and a --limit that is not a
// positive integer.
function parseCliArgs(args: readonly string[]): CliOptions | "help" {
  const { values, positionals } = strictParse(args);
  if (values.help) return "help";

  const [command = "scan", ...rest] = positionals;
  if (!isCommand(command)) throw new UsageError(`unknown command '${command}'`);

  for (const name of Object.keys(values) as (keyof typeof OPTIONS)[]) {
    if (!COMMAND_OPTIONS[command].includes(name)) {
      throw new UsageError(`--${name} does not apply to ${command}`);
    }
  }

  let hookAction: CliOptions["hookAction"];
  let mournPath: string | undefined;
  if (command === "hook") {
    const action = rest.shift();
    if (action === undefined) throw new UsageError("hook needs an action: install or uninstall");
    if (action !== "install" && action !== "uninstall") {
      throw new UsageError(`unknown hook action '${action}'`);
    }
    hookAction = action;
  } else if (command === "mourn") {
    mournPath = rest.shift();
    if (mournPath === undefined) throw new UsageError("mourn needs a <path>");
  }
  if (rest.length > 0) throw new UsageError(`unexpected argument '${rest[0]}'`);

  let limit = 20;
  if (values.limit !== undefined) {
    if (!/^[1-9]\d*$/.test(values.limit)) {
      throw new UsageError(`--limit must be a positive integer, got '${values.limit}'`);
    }
    limit = Number(values.limit);
  }

  return {
    command,
    ref: values.ref,
    hookAction,
    mournPath,
    dryRun: values["dry-run"] ?? false,
    verbose: values.verbose ?? false,
    limit,
  };
}

function printUsage(): void {
  console.log(`
Vernon — Generate obituaries for deleted code

Commands:
  scan [--ref <ref>]       Scan latest commit for deletions (default)
  diff                     Scan staged changes (pre-commit mode)
  history                  Show the cemetery
  hook install|uninstall   Manage pre-commit hook
  mourn <path> [--ref <ref>]
                           Only mourn deletions in <path> from the latest
                           commit (or --ref)

Options (an option a command doesn't take is an error):
  --dry-run                Print obituaries without writing to CEMETERY.md
                           (scan, diff, mourn)
  --verbose                Show detection details (scan, diff, mourn)
  --limit N                Max obituaries to generate, a positive integer
                           (default: 20; scan, diff)
  -h, --help               Show this help

Exit status: 0 on success, 1 on a git error or outside a git repository,
2 on a usage error.
`);
}

function fail(message: string, exitCode: number): void {
  console.error(`vernon: ${message}`);
  process.exitCode = exitCode;
}

export function run(args: readonly string[]): void {
  let opts: ReturnType<typeof parseCliArgs>;
  try {
    opts = parseCliArgs(args);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    fail(err.message, 2);
    console.error(SHORT_USAGE);
    return;
  }

  if (opts === "help") {
    printUsage();
    return;
  }

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
    else uninstallHook();
    return;
  }

  if (!isInsideGitRepo()) {
    fail("not inside a git repository", 1);
    return;
  }

  let rawDiff: string;

  try {
    rawDiff = opts.command === "diff" ? getStagedDiff() : getCommitDiff(opts.ref);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    fail(err.message, 1);
    return;
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
  const source: DiffSource =
    opts.command === "diff" ? { kind: "staged" } : { kind: "commits", ref: opts.ref };
  const enrich = createEnricher(source);
  const obituaries = deletions.map((d) => {
    if (opts.verbose) {
      console.log(`  [${d.type}] ${d.name} (${d.filePath})`);
    }
    const metadata = enrich(d);
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
    console.log(
      `Written ${obituaries.length} obituar${obituaries.length === 1 ? "y" : "ies"} to CEMETERY.md`,
    );
  }
}
