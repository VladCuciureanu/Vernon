import { assertEquals, assert, assertNotEquals } from "@std/assert";
import { generateObituary } from "../src/obituary-generator.ts";
import type { Deletion, Metadata } from "../src/types.ts";

const mockDeletion: Deletion = {
  type: "function",
  name: "getUserById",
  filePath: "src/api.ts",
  language: "javascript",
  removedLines: ["function getUserById() {", "  return db.query();", "}"],
};

const mockFileDeletion: Deletion = {
  type: "file",
  name: "utils.ts",
  filePath: "src/utils.ts",
  language: "javascript",
  removedLines: ["export const x = 1;"],
};

const mockMetadata: Metadata = {
  birthDate: "2022-03-15",
  deathDate: "2026-03-24",
  author: "Jane",
  lastEditor: "John",
  commitCount: 47,
  linesOfCode: 12,
  causeOfDeath: "refactor: move to new query layer",
};

Deno.test("returns an Obituary with all required fields", () => {
  const result = generateObituary(mockDeletion, mockMetadata);
  assertEquals(result.deletion, mockDeletion);
  assertEquals(result.metadata, mockMetadata);
  assertEquals(typeof result.text, "string");
  assert(result.text.length > 0);
  assertEquals(typeof result.timestamp, "string");
});

Deno.test("includes the function name with () for function deletions", () => {
  const result = generateObituary(mockDeletion, mockMetadata);
  assert(result.text.includes("getUserById()"));
});

Deno.test("includes the file name without () for file deletions", () => {
  const result = generateObituary(mockFileDeletion, mockMetadata);
  assert(result.text.includes("utils.ts"));
  assert(!result.text.includes("utils.ts()"));
});

Deno.test("interpolates metadata values into the text", () => {
  const texts: string[] = [];
  for (let i = 0; i < 50; i++) {
    texts.push(generateObituary(mockDeletion, mockMetadata).text);
  }
  const combined = texts.join(" ");

  assert(combined.includes("2022-03-15"));
  assert(combined.includes("2026-03-24"));
  assert(combined.includes("refactor: move to new query layer"));
});

Deno.test("does not contain uninterpolated placeholders", () => {
  for (let i = 0; i < 20; i++) {
    const result = generateObituary(mockDeletion, mockMetadata);
    assertEquals(
      result.text.match(/\{(name|birthDate|deathDate|author|lastEditor|commitCount|linesOfCode|commitMessage)\}/),
      null,
    );
  }
});

Deno.test("produces varied output (randomness check)", () => {
  const uniqueTexts = new Set<string>();
  for (let i = 0; i < 30; i++) {
    uniqueTexts.add(generateObituary(mockDeletion, mockMetadata).text);
  }
  assert(uniqueTexts.size > 5);
});

Deno.test("returns a valid ISO timestamp", () => {
  const result = generateObituary(mockDeletion, mockMetadata);
  assertEquals(new Date(result.timestamp).toISOString(), result.timestamp);
});
