import { describe, it, expect } from "vitest";
import {
  parseSwaggerSpec,
  extractEndpoints,
  extractSchemas,
  generateTypeScriptByEndpoint,
} from "../src/parser.js";
import { readFileSync } from "fs";

const mockSpec = JSON.parse(readFileSync("./mock.json", "utf-8"));

describe("parser", () => {
  describe("extractEndpoints", () => {
    it("should extract all endpoints from swagger spec", () => {
      const endpoints = extractEndpoints(mockSpec);
      expect(endpoints.length).toBeGreaterThan(0);
    });

    it("should extract endpoint method and path", () => {
      const endpoints = extractEndpoints(mockSpec);
      const first = endpoints[0];
      expect(first.method).toMatch(/^(GET|POST|PUT|DELETE|PATCH)$/i);
      expect(first.path).toBeTruthy();
      expect(typeof first.path).toBe("string");
    });

    it("should include summary and description", () => {
      const endpoints = extractEndpoints(mockSpec);
      const postEndpoint = endpoints.find((ep) => ep.method === "POST");
      expect(postEndpoint).toBeDefined();
    });
  });

  describe("extractSchemas", () => {
    it("should extract all schemas from swagger spec", () => {
      const schemas = extractSchemas(mockSpec);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it("should include schema properties", () => {
      const schemas = extractSchemas(mockSpec);
      const schema = schemas.find((s) => s.name === "包装单位");
      expect(schema).toBeDefined();
      expect(schema?.properties.length).toBeGreaterThan(0);
    });
  });

  describe("generateTypeScriptByEndpoint", () => {
    it("should generate TypeScript for GET endpoint with query params", () => {
      const code = generateTypeScriptByEndpoint("/access/packageUnit/queryList", "GET", mockSpec);
      expect(code).toContain("TQueryListParams");
      expect(code).toContain("disabled");
    });

    it("should generate TypeScript for POST endpoint with request body", () => {
      const code = generateTypeScriptByEndpoint("/access/packageUnit/queryPackageInfos", "POST", mockSpec);
      expect(code).toContain("TQueryPackageInfosReq");
      expect(code).toContain("PackageUnitRequest");
    });

    it("should generate TypeScript for response", () => {
      const code = generateTypeScriptByEndpoint("/access/packageUnit/queryList", "GET", mockSpec);
      // GET 接口有 query 参数，所以会生成 Params
      expect(code).toContain("TQueryListParams");
    });

    it("should return error for non-existent endpoint", () => {
      const code = generateTypeScriptByEndpoint("/non/existent", "GET", mockSpec);
      expect(code).toContain("未找到");
    });

    // snapshots for all 5 endpoints
    it("should generate snapshot for POST /access/packageUnit/queryPackageInfos", () => {
      const code = generateTypeScriptByEndpoint("/access/packageUnit/queryPackageInfos", "POST", mockSpec);
      expect(code).toMatchSnapshot();
    });

    it("should generate snapshot for GET /access/packageUnit/queryPackageInfo", () => {
      const code = generateTypeScriptByEndpoint("/access/packageUnit/queryPackageInfo", "GET", mockSpec);
      expect(code).toMatchSnapshot();
    });

    it("should generate snapshot for GET /access/packageUnit/queryList", () => {
      const code = generateTypeScriptByEndpoint("/access/packageUnit/queryList", "GET", mockSpec);
      expect(code).toMatchSnapshot();
    });

    it("should generate snapshot for PUT /access/resource/update/roleResource", () => {
      const code = generateTypeScriptByEndpoint("/access/resource/update/roleResource", "PUT", mockSpec);
      expect(code).toMatchSnapshot();
    });

    it("should generate snapshot for POST /access/port/validPortDisableStatus", () => {
      const code = generateTypeScriptByEndpoint("/access/port/validPortDisableStatus", "POST", mockSpec);
      expect(code).toMatchSnapshot();
    });
  });
});
