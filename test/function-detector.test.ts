import { assertEquals } from "@std/assert";
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
  Deno.test(`detectLanguage - ${path} → ${expected}`, () => {
    assertEquals(detectLanguage(path), expected);
  });
}

// JavaScript/TypeScript
Deno.test("JS/TS - detects named function declarations", () => {
  const lines = ["function getUserById(id) {", "  return db.query(id);", "}"];
  const result = detectDeletedFunctions(lines, "src/api.ts");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "getUserById");
  assertEquals(result[0].type, "function");
});

Deno.test("JS/TS - detects exported functions", () => {
  const result = detectDeletedFunctions(["export function fetchData() {"], "src/api.ts");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "fetchData");
});

Deno.test("JS/TS - detects async functions", () => {
  const result = detectDeletedFunctions(["export async function loadUser() {"], "src/api.ts");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "loadUser");
});

Deno.test("JS/TS - detects arrow function assignments", () => {
  const result = detectDeletedFunctions(["const formatUser = (user) => {"], "src/utils.ts");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "formatUser");
});

Deno.test("JS/TS - detects class declarations", () => {
  const result = detectDeletedFunctions(["export class UserService {"], "src/service.ts");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "UserService");
});

Deno.test("JS/TS - does not duplicate same-name detections", () => {
  const lines = ["function doStuff() {", "  // body", "}", "function doStuff() {"];
  const result = detectDeletedFunctions(lines, "src/a.ts");
  assertEquals(result.length, 1);
});

// Python
Deno.test("Python - detects def statements", () => {
  const result = detectDeletedFunctions(["def calculate_tax(amount):", "    return amount * 0.21"], "lib/tax.py");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "calculate_tax");
});

Deno.test("Python - detects class declarations", () => {
  const result = detectDeletedFunctions(["class TaxCalculator:", "    pass"], "lib/tax.py");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "TaxCalculator");
});

// Go
Deno.test("Go - detects plain functions", () => {
  const result = detectDeletedFunctions(["func HandleRequest(w http.ResponseWriter, r *http.Request) {"], "handlers/api.go");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "HandleRequest");
});

Deno.test("Go - detects methods with receivers", () => {
  const result = detectDeletedFunctions(["func (s *Server) Start() error {"], "server.go");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "Start");
});

// Rust
Deno.test("Rust - detects fn declarations", () => {
  const result = detectDeletedFunctions(["fn process_data(input: &str) -> Result<()> {"], "src/lib.rs");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "process_data");
});

Deno.test("Rust - detects pub async fn", () => {
  const result = detectDeletedFunctions(["pub async fn fetch_user(id: u64) -> User {"], "src/api.rs");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "fetch_user");
});

Deno.test("Rust - detects impl blocks", () => {
  const result = detectDeletedFunctions(["impl Database {"], "src/db.rs");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "Database");
});

// Java
Deno.test("Java - detects public methods", () => {
  const result = detectDeletedFunctions(["public String getUserName(int id) {"], "src/User.java");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "getUserName");
});

Deno.test("Java - detects class declarations", () => {
  const result = detectDeletedFunctions(["class UserRepository {"], "src/UserRepository.java");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "UserRepository");
});

// Ruby
Deno.test("Ruby - detects def methods", () => {
  const result = detectDeletedFunctions(["def calculate_total"], "app/models/order.rb");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "calculate_total");
});

// PHP
Deno.test("PHP - detects function declarations", () => {
  const result = detectDeletedFunctions(["function getConnection() {"], "src/db.php");
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "getConnection");
});

// Unknown
Deno.test("returns empty for unknown languages", () => {
  const result = detectDeletedFunctions(["some random text"], "data.csv");
  assertEquals(result.length, 0);
});
