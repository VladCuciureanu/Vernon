import type { Deletion, Metadata, Obituary } from "./types.ts";

const FLAVOUR = {
  openings: [
    "Here lies {name},",
    "In loving memory of {name},",
    "Rest in peace, {name}.",
    "Gone but not forgotten: {name}.",
    "We gather here to mourn {name},",
    "Dearly departed {name},",
    "{name} has left the codebase.",
    "A moment of silence for {name}.",
  ],
  lifeSummary: [
    "born {birthDate}, deleted {deathDate}.",
    "first committed on {birthDate}, mass-murdered on {deathDate}.",
    "brought to life {birthDate}, euthanized {deathDate}.",
    "created {birthDate}, removed {deathDate}. It had a good run.",
    "born into the repo on {birthDate}, deleted without warning on {deathDate}.",
    "authored on {birthDate}, killed off on {deathDate} by forces beyond its control.",
  ],
  achievements: [
    "Survived {commitCount} commits before meeting its end.",
    "Touched by {commitCount} commits and {author}'s bare hands.",
    "Served faithfully across {linesOfCode} lines of pure logic.",
    "It survived {commitCount} refactors. This one was too much.",
    "{commitCount} commits shaped it into what it was. Then deleted it.",
    "At {linesOfCode} lines, it was not the longest — but it was ours.",
    "It endured {commitCount} code reviews without complaint.",
  ],
  causeOfDeath: [
    'Cause of death: "{commitMessage}".',
    'Killed by {lastEditor}, with the commit message "{commitMessage}".',
    'Final words from the coroner: "{commitMessage}".',
    'The death certificate reads: "{commitMessage}".',
    'Its demise was sealed by: "{commitMessage}".',
    '{lastEditor} pulled the plug. Reason: "{commitMessage}".',
  ],
  epitaphs: [
    "It never threw an uncaught exception.",
    "It was deprecated long before it was deleted.",
    "No tests were broken in its removal. Suspicious.",
    "It will be imported in our hearts forever.",
    "It served its purpose. May it rest in /dev/null.",
    "Gone to the great garbage collector in the sky.",
    "It had no TODOs left. Only DONEs.",
    "May its memory be properly deallocated.",
    "It compiled on the first try. Every time.",
    "It was well-documented. No one read it.",
    "Its stack trace led here.",
    "404: Function not found. Forever.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? key);
}

export function generateObituary(deletion: Deletion, metadata: Metadata): Obituary {
  const displayName =
    deletion.type === "function"
      ? `${deletion.name}()`
      : deletion.name;

  const vars: Record<string, string> = {
    name: displayName,
    birthDate: metadata.birthDate,
    deathDate: metadata.deathDate,
    author: metadata.author,
    lastEditor: metadata.lastEditor,
    commitCount: String(metadata.commitCount),
    linesOfCode: String(metadata.linesOfCode),
    commitMessage: metadata.causeOfDeath,
  };

  const parts = [
    interpolate(pick(FLAVOUR.openings), vars),
    interpolate(pick(FLAVOUR.lifeSummary), vars),
    interpolate(pick(FLAVOUR.achievements), vars),
    interpolate(pick(FLAVOUR.causeOfDeath), vars),
    interpolate(pick(FLAVOUR.epitaphs), vars),
  ];

  return {
    deletion,
    metadata,
    text: parts.join(" "),
    timestamp: new Date().toISOString(),
  };
}
