import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { extractEndpoints } from "../src/parser.js";
import type { SwaggerProject } from "../src/types.js";

// Mock 项目数据
const mockSpec = JSON.parse(readFileSync("./mock.json", "utf-8"));

const createMockProject = (name: string, swaggerUrl: string): SwaggerProject => ({
  name,
  swaggerUrl,
  spec: mockSpec,
});

describe("tools - 搜索功能", () => {
  it("should filter endpoints by keyword in path", () => {
    const endpoints = extractEndpoints(mockSpec);
    const keyword = "packageUnit";
    const matched = endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.summary.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.description.toLowerCase().includes(keyword.toLowerCase()),
    );

    expect(matched.length).toBeGreaterThan(0);
    expect(matched.some((ep) => ep.path.includes("packageUnit"))).toBe(true);
  });

  it("should filter endpoints by summary keyword", () => {
    const endpoints = extractEndpoints(mockSpec);
    const keyword = "包装单位";
    const matched = endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.summary.toLowerCase().includes(keyword.toLowerCase()),
    );

    expect(matched.length).toBeGreaterThan(0);
  });

  it("should return empty array for non-existent keyword", () => {
    const endpoints = extractEndpoints(mockSpec);
    const keyword = "NonExistentKeyword12345";
    const matched = endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.summary.toLowerCase().includes(keyword.toLowerCase()),
    );

    expect(matched.length).toBe(0);
  });
});

describe("tools - 获取接口详情", () => {
  it("should find endpoint by path and method", () => {
    const endpoints = extractEndpoints(mockSpec);
    const endpoint = endpoints.find(
      (ep) =>
        ep.path === "/access/packageUnit/queryList" && ep.method === "GET",
    );

    expect(endpoint).toBeDefined();
    expect(endpoint?.summary).toContain("包装单位");
  });

  it("should return undefined for non-existent endpoint", () => {
    const endpoints = extractEndpoints(mockSpec);
    const endpoint = endpoints.find(
      (ep) => ep.path === "/non/existent" && ep.method === "GET",
    );

    expect(endpoint).toBeUndefined();
  });
});

describe("tools - 包装单位相关接口", () => {
  it("should find all packageUnit related endpoints", () => {
    const endpoints = extractEndpoints(mockSpec);
    const packageUnitEndpoints = endpoints.filter((ep) =>
      ep.path.includes("packageUnit"),
    );

    expect(packageUnitEndpoints.length).toBe(3);

    const paths = packageUnitEndpoints.map((ep) => ep.path);
    expect(paths).toContain("/access/packageUnit/queryPackageInfos");
    expect(paths).toContain("/access/packageUnit/queryPackageInfo");
    expect(paths).toContain("/access/packageUnit/queryList");
  });

  it("should have correct methods for packageUnit endpoints", () => {
    const endpoints = extractEndpoints(mockSpec);
    const packageUnitEndpoints = endpoints.filter((ep) =>
      ep.path.includes("packageUnit"),
    );

    const methodMap = packageUnitEndpoints.reduce(
      (acc, ep) => {
        acc[ep.path] = ep.method;
        return acc;
      },
      {} as Record<string, string>,
    );

    expect(methodMap["/access/packageUnit/queryPackageInfos"]).toBe("POST");
    expect(methodMap["/access/packageUnit/queryPackageInfo"]).toBe("GET");
    expect(methodMap["/access/packageUnit/queryList"]).toBe("GET");
  });
});

describe("SwaggerProject", () => {
  it("should create project with spec loaded", () => {
    const project = createMockProject("test-project", "http://example.com/swagger.json");

    expect(project.name).toBe("test-project");
    expect(project.swaggerUrl).toBe("http://example.com/swagger.json");
    expect(project.spec).toBeDefined();
  });

  it("should extract endpoints from project spec", () => {
    const project = createMockProject("test-project", "http://example.com/swagger.json");
    const endpoints = extractEndpoints(project.spec!);

    expect(endpoints.length).toBeGreaterThan(0);
  });
});
