import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLanguage, detectDeletedFunctions } from "../src/function-detector.ts";

// detectLanguage
const languageCases: [string, string][] = [
  ["src/app.ts", "javascript"],
  ["src/app.js", "javascript"],
  ["src/app.tsx", "javascript"],
  ["src/app.jsx", "javascript"],
  ["src/app.mjs", "javascript"],
  ["src/app.cjs", "javascript"],
  ["lib/module.py", "python"],
  ["cmd/main.go", "go"],
  ["src/lib.rs", "rust"],
  ["src/Main.java", "java"],
  ["src/Main.kt", "java"],
  ["app/model.rb", "ruby"],
  ["src/index.php", "php"],
  ["data.csv", "unknown"],
  ["README.md", "unknown"],
];

for (const [path, expected] of languageCases) {
  test(`detectLanguage - ${path} → ${expected}`, () => {
    assert.deepEqual(detectLanguage(path), expected);
  });
}

// JavaScript/TypeScript
test("JS/TS - detects named function declarations", () => {
  const lines = ["function getUserById(id) {", "  return db.query(id);", "}"];
  const result = detectDeletedFunctions(lines, "src/api.ts");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "getUserById");
  assert.deepEqual(result[0].type, "function");
});

test("JS/TS - detects exported functions", () => {
  const result = detectDeletedFunctions(["export function fetchData() {"], "src/api.ts");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "fetchData");
});

test("JS/TS - detects async functions", () => {
  const result = detectDeletedFunctions(["export async function loadUser() {"], "src/api.ts");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "loadUser");
});

test("JS/TS - detects arrow function assignments", () => {
  const result = detectDeletedFunctions(["const formatUser = (user) => {"], "src/utils.ts");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "formatUser");
});

test("JS/TS - detects class declarations", () => {
  const result = detectDeletedFunctions(["export class UserService {"], "src/service.ts");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "UserService");
});

test("JS/TS - does not duplicate same-name detections", () => {
  const lines = ["function doStuff() {", "  // body", "}", "function doStuff() {"];
  const result = detectDeletedFunctions(lines, "src/a.ts");
  assert.deepEqual(result.length, 1);
});

// Python
test("Python - detects def statements", () => {
  const result = detectDeletedFunctions(["def calculate_tax(amount):", "    return amount * 0.21"], "lib/tax.py");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "calculate_tax");
});

test("Python - detects class declarations", () => {
  const result = detectDeletedFunctions(["class TaxCalculator:", "    pass"], "lib/tax.py");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "TaxCalculator");
});

// Go
test("Go - detects plain functions", () => {
  const result = detectDeletedFunctions(["func HandleRequest(w http.ResponseWriter, r *http.Request) {"], "handlers/api.go");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "HandleRequest");
});

test("Go - detects methods with receivers", () => {
  const result = detectDeletedFunctions(["func (s *Server) Start() error {"], "server.go");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "Start");
});

// Rust
test("Rust - detects fn declarations", () => {
  const result = detectDeletedFunctions(["fn process_data(input: &str) -> Result<()> {"], "src/lib.rs");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "process_data");
});

test("Rust - detects pub async fn", () => {
  const result = detectDeletedFunctions(["pub async fn fetch_user(id: u64) -> User {"], "src/api.rs");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "fetch_user");
});

test("Rust - detects impl blocks", () => {
  const result = detectDeletedFunctions(["impl Database {"], "src/db.rs");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "Database");
});

// Java
test("Java - detects public methods", () => {
  const result = detectDeletedFunctions(["public String getUserName(int id) {"], "src/User.java");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "getUserName");
});

test("Java - detects class declarations", () => {
  const result = detectDeletedFunctions(["class UserRepository {"], "src/UserRepository.java");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "UserRepository");
});

// Ruby
test("Ruby - detects def methods", () => {
  const result = detectDeletedFunctions(["def calculate_total"], "app/models/order.rb");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "calculate_total");
});

// PHP
test("PHP - detects function declarations", () => {
  const result = detectDeletedFunctions(["function getConnection() {"], "src/db.php");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].name, "getConnection");
});

// Unknown
test("returns empty for unknown languages", () => {
  const result = detectDeletedFunctions(["some random text"], "data.csv");
  assert.deepEqual(result.length, 0);
});

// Control-flow keywords
test("JS/TS - does not detect control-flow statements as functions", () => {
  const lines = [
    "if (x) {",
    "for (let i = 0; i < n; i++) {",
    "while (running) {",
    "switch (kind) {",
    "catch (err) {",
    "  } catch (err) {",
    "with (obj) {",
  ];
  const result = detectDeletedFunctions(lines, "src/a.ts");
  assert.deepEqual(result.length, 0);
});

test("JS/TS - still detects real functions alongside control flow", () => {
  const lines = [
    "function handle(req) {",
    "  if (req.ok) {",
    "    for (const x of req.items) {",
    "  render(props) {",
  ];
  const result = detectDeletedFunctions(lines, "src/a.ts");
  assert.deepEqual(result.map((d) => d.name), ["handle", "render"]);
});

// Edited vs deleted
test("does not report a function whose signature was edited but still exists", () => {
  const removed = ["function getUser(id) {", "function dropUser(id) {"];
  const added = ["function getUser(id, opts) {"];
  const result = detectDeletedFunctions(removed, "src/a.ts", { addedLines: added });
  assert.deepEqual(result.map((d) => d.name), ["dropUser"]);
});

test("a call to the function in added lines does not count as still defined", () => {
  const removed = ["function helper() {"];
  const added = ["  helper();"];
  const result = detectDeletedFunctions(removed, "src/a.ts", { addedLines: added });
  assert.deepEqual(result.map((d) => d.name), ["helper"]);
});

test("each function gets only its own removed lines", () => {
  const removed = [
    "function first() {",
    "  return 1;",
    "}",
    "function second() {",
    "  return 2;",
    "}",
    "const unrelated = 3;",
  ];
  // Two hunks: the second starts at "const unrelated".
  const result = detectDeletedFunctions(removed, "src/a.ts", { hunkStarts: [0, 6] });
  assert.deepEqual(result.map((d) => [d.name, d.removedLines]), [
    ["first", ["function first() {", "  return 1;", "}"]],
    ["second", ["function second() {", "  return 2;", "}"]],
  ]);
});
