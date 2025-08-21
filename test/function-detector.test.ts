import { describe, it, expect } from "vitest";
import { detectLanguage, detectDeletedFunctions } from "../src/function-detector.js";

describe("detectLanguage", () => {
  it.each([
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
  ])("detects %s as %s", (path, expected) => {
    expect(detectLanguage(path)).toBe(expected);
  });
});

describe("detectDeletedFunctions", () => {
  describe("JavaScript/TypeScript", () => {
    it("detects named function declarations", () => {
      const lines = [
        "function getUserById(id) {",
        "  return db.query(id);",
        "}",
      ];
      const result = detectDeletedFunctions(lines, "src/api.ts");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("getUserById");
      expect(result[0].type).toBe("function");
    });

    it("detects exported functions", () => {
      const lines = ["export function fetchData() {"];
      const result = detectDeletedFunctions(lines, "src/api.ts");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("fetchData");
    });

    it("detects async functions", () => {
      const lines = ["export async function loadUser() {"];
      const result = detectDeletedFunctions(lines, "src/api.ts");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("loadUser");
    });

    it("detects arrow function assignments", () => {
      const lines = ["const formatUser = (user) => {"];
      const result = detectDeletedFunctions(lines, "src/utils.ts");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("formatUser");
    });

    it("detects class declarations", () => {
      const lines = ["export class UserService {"];
      const result = detectDeletedFunctions(lines, "src/service.ts");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("UserService");
    });

    it("does not duplicate same-name detections", () => {
      const lines = [
        "function doStuff() {",
        "  // body",
        "}",
        "function doStuff() {",  // duplicate
      ];
      const result = detectDeletedFunctions(lines, "src/a.ts");
      expect(result).toHaveLength(1);
    });
  });

  describe("Python", () => {
    it("detects def statements", () => {
      const lines = ["def calculate_tax(amount):", "    return amount * 0.21"];
      const result = detectDeletedFunctions(lines, "lib/tax.py");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("calculate_tax");
    });

    it("detects class declarations", () => {
      const lines = ["class TaxCalculator:", "    pass"];
      const result = detectDeletedFunctions(lines, "lib/tax.py");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("TaxCalculator");
    });
  });

  describe("Go", () => {
    it("detects plain functions", () => {
      const lines = ["func HandleRequest(w http.ResponseWriter, r *http.Request) {"];
      const result = detectDeletedFunctions(lines, "handlers/api.go");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("HandleRequest");
    });

    it("detects methods with receivers", () => {
      const lines = ["func (s *Server) Start() error {"];
      const result = detectDeletedFunctions(lines, "server.go");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Start");
    });
  });

  describe("Rust", () => {
    it("detects fn declarations", () => {
      const lines = ["fn process_data(input: &str) -> Result<()> {"];
      const result = detectDeletedFunctions(lines, "src/lib.rs");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("process_data");
    });

    it("detects pub async fn", () => {
      const lines = ["pub async fn fetch_user(id: u64) -> User {"];
      const result = detectDeletedFunctions(lines, "src/api.rs");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("fetch_user");
    });

    it("detects impl blocks", () => {
      const lines = ["impl Database {"];
      const result = detectDeletedFunctions(lines, "src/db.rs");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Database");
    });
  });

  describe("Java", () => {
    it("detects public methods", () => {
      const lines = ["public String getUserName(int id) {"];
      const result = detectDeletedFunctions(lines, "src/User.java");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("getUserName");
    });

    it("detects class declarations", () => {
      const lines = ["class UserRepository {"];
      const result = detectDeletedFunctions(lines, "src/UserRepository.java");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("UserRepository");
    });
  });

  describe("Ruby", () => {
    it("detects def methods", () => {
      const lines = ["def calculate_total"];
      const result = detectDeletedFunctions(lines, "app/models/order.rb");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("calculate_total");
    });
  });

  describe("PHP", () => {
    it("detects function declarations", () => {
      const lines = ["function getConnection() {"];
      const result = detectDeletedFunctions(lines, "src/db.php");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("getConnection");
    });
  });

  it("returns empty for unknown languages", () => {
    const lines = ["some random text"];
    const result = detectDeletedFunctions(lines, "data.csv");
    expect(result).toHaveLength(0);
  });
});
