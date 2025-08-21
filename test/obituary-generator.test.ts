import { describe, it, expect } from "vitest";
import { generateObituary } from "../src/obituary-generator.js";
import type { Deletion, Metadata } from "../src/types.js";

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

describe("generateObituary", () => {
  it("returns an Obituary with all required fields", () => {
    const result = generateObituary(mockDeletion, mockMetadata);
    expect(result.deletion).toBe(mockDeletion);
    expect(result.metadata).toBe(mockMetadata);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
    expect(typeof result.timestamp).toBe("string");
  });

  it("includes the function name with () for function deletions", () => {
    const result = generateObituary(mockDeletion, mockMetadata);
    expect(result.text).toContain("getUserById()");
  });

  it("includes the file name without () for file deletions", () => {
    const result = generateObituary(mockFileDeletion, mockMetadata);
    expect(result.text).toContain("utils.ts");
    expect(result.text).not.toContain("utils.ts()");
  });

  it("interpolates metadata values into the text", () => {
    // Run multiple times to increase chance of hitting templates with each var
    const texts: string[] = [];
    for (let i = 0; i < 50; i++) {
      texts.push(generateObituary(mockDeletion, mockMetadata).text);
    }
    const combined = texts.join(" ");

    // These should appear in at least some of the generated texts
    expect(combined).toContain("2022-03-15");
    expect(combined).toContain("2026-03-24");
    expect(combined).toContain("refactor: move to new query layer");
  });

  it("does not contain uninterpolated {placeholders}", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateObituary(mockDeletion, mockMetadata);
      expect(result.text).not.toMatch(/\{(name|birthDate|deathDate|author|lastEditor|commitCount|linesOfCode|commitMessage)\}/);
    }
  });

  it("produces varied output (randomness check)", () => {
    const uniqueTexts = new Set<string>();
    for (let i = 0; i < 30; i++) {
      uniqueTexts.add(generateObituary(mockDeletion, mockMetadata).text);
    }
    // With 24k+ combinations, 30 runs should produce at least several unique texts
    expect(uniqueTexts.size).toBeGreaterThan(5);
  });

  it("returns a valid ISO timestamp", () => {
    const result = generateObituary(mockDeletion, mockMetadata);
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
