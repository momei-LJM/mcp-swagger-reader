import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  extractEndpoints,
  extractSchemas,
  generateTypeScriptByEndpoint,
} from "../src/parser.js";
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

// ============================================
// 以下是为所有 tools 编写的单元测试
// ============================================

describe("tools - add_swagger_project", () => {
  it("should add a new project to projects map", () => {
    const projects = new Map<string, SwaggerProject>();

    // 模拟添加项目
    const name = "test-project";
    const swaggerUrl = "./mock.json";
    projects.set(name, { name, swaggerUrl });

    expect(projects.has("test-project")).toBe(true);
    expect(projects.get("test-project")?.swaggerUrl).toBe("./mock.json");
  });

  it("should load spec when adding project", async () => {
    const projects = new Map<string, SwaggerProject>();

    const name = "mock-project";
    const swaggerUrl = "./mock.json";
    const { loadSwaggerFromFile } = await import("../src/parser.js");
    const spec = loadSwaggerFromFile(swaggerUrl);

    projects.set(name, { name, swaggerUrl, spec });

    expect(projects.get(name)?.spec).toBeDefined();
    expect(projects.get(name)?.spec?.paths).toBeDefined();
  });
});

describe("tools - list_swagger_projects", () => {
  it("should list all configured projects", () => {
    const projects = new Map<string, SwaggerProject>();
    projects.set("project1", { name: "project1", swaggerUrl: "http://example.com/1.json" });
    projects.set("project2", { name: "project2", swaggerUrl: "http://example.com/2.json", spec: mockSpec });

    const projectList = Array.from(projects.values()).map((p) => ({
      name: p.name,
      swaggerUrl: p.swaggerUrl,
      loaded: !!p.spec,
    }));

    expect(projectList.length).toBe(2);
    expect(projectList[0].name).toBe("project1");
    expect(projectList[1].loaded).toBe(true);
  });

  it("should return empty list when no projects", () => {
    const projects = new Map<string, SwaggerProject>();

    const projectList = Array.from(projects.values()).map((p) => ({
      name: p.name,
      swaggerUrl: p.swaggerUrl,
      loaded: !!p.spec,
    }));

    expect(projectList.length).toBe(0);
  });
});

describe("tools - get_api_endpoints", () => {
  it("should get all API endpoints from project", () => {
    const project = createMockProject("test", "./mock.json");

    const endpoints = extractEndpoints(project.spec!);
    const summary = {
      total: endpoints.length,
      byMethod: endpoints.reduce((acc: Record<string, number>, ep) => {
        acc[ep.method] = (acc[ep.method] || 0) + 1;
        return acc;
      }, {}),
    };

    expect(summary.total).toBeGreaterThan(0);
    expect(summary.byMethod).toBeDefined();
  });

  it("should return endpoints with correct structure", () => {
    const project = createMockProject("test", "./mock.json");

    const endpoints = extractEndpoints(project.spec!);
    const firstEndpoint = endpoints[0];

    expect(firstEndpoint.path).toBeDefined();
    expect(firstEndpoint.method).toBeDefined();
    expect(firstEndpoint.summary).toBeDefined();
    expect(firstEndpoint.tags).toBeDefined();
  });

  it("should group endpoints by HTTP method", () => {
    const project = createMockProject("test", "./mock.json");

    const endpoints = extractEndpoints(project.spec!);
    const byMethod = endpoints.reduce((acc: Record<string, number>, ep) => {
      acc[ep.method] = (acc[ep.method] || 0) + 1;
      return acc;
    }, {});

    // 统计各方法的数量
    expect(Object.keys(byMethod).length).toBeGreaterThan(0);
  });

  // 快照测试
  it("should generate snapshot for endpoints summary", () => {
    const project = createMockProject("test", "./mock.json");
    const endpoints = extractEndpoints(project.spec!);

    const summary = {
      total: endpoints.length,
      byMethod: endpoints.reduce((acc: Record<string, number>, ep) => {
        acc[ep.method] = (acc[ep.method] || 0) + 1;
        return acc;
      }, {}),
      endpoints: endpoints.map((ep) => ({
        path: ep.path,
        method: ep.method,
        summary: ep.summary,
        tags: ep.tags,
      })),
    };

    expect(summary).toMatchSnapshot();
  });
});

describe("tools - get_api_detail", () => {
  it("should get API detail by path and method", () => {
    const project = createMockProject("test", "./mock.json");
    const endpoints = extractEndpoints(project.spec!);

    const endpoint = endpoints.find(
      (ep) =>
        ep.path === "/access/packageUnit/queryList" && ep.method === "GET",
    );

    expect(endpoint).toBeDefined();
    expect(endpoint?.path).toBe("/access/packageUnit/queryList");
    expect(endpoint?.method).toBe("GET");
  });

  it("should return undefined for non-existent endpoint", () => {
    const project = createMockProject("test", "./mock.json");
    const endpoints = extractEndpoints(project.spec!);

    const endpoint = endpoints.find(
      (ep) => ep.path === "/non/existent" && ep.method === "GET",
    );

    expect(endpoint).toBeUndefined();
  });

  it("should include request body info for POST endpoints", () => {
    const project = createMockProject("test", "./mock.json");
    const endpoints = extractEndpoints(project.spec!);

    const endpoint = endpoints.find(
      (ep) => ep.method === "POST",
    );

    expect(endpoint).toBeDefined();
    expect(endpoint?.requestBody).toBeDefined();
  });

  it("should include parameters for GET endpoints", () => {
    const project = createMockProject("test", "./mock.json");
    const endpoints = extractEndpoints(project.spec!);

    const endpoint = endpoints.find(
      (ep) => ep.path === "/access/packageUnit/queryPackageInfo" && ep.method === "GET",
    );

    expect(endpoint).toBeDefined();
    expect(endpoint?.parameters).toBeDefined();
    expect(endpoint?.parameters.length).toBeGreaterThan(0);
  });

  // 快照测试
  it("should generate snapshot for endpoint detail", () => {
    const project = createMockProject("test", "./mock.json");
    const endpoints = extractEndpoints(project.spec!);

    const endpoint = endpoints.find(
      (ep) => ep.path === "/access/packageUnit/queryList" && ep.method === "GET",
    );

    expect(endpoint).toMatchSnapshot();
  });
});

describe("tools - get_schemas", () => {
  it("should get all schemas from project", () => {
    const project = createMockProject("test", "./mock.json");

    const schemas = extractSchemas(project.spec!);

    expect(schemas.length).toBeGreaterThan(0);
  });

  it("should include schema properties", () => {
    const project = createMockProject("test", "./mock.json");

    const schemas = extractSchemas(project.spec!);
    const schema = schemas.find((s) => s.name === "包装单位");

    expect(schema).toBeDefined();
    expect(schema?.properties.length).toBeGreaterThan(0);
  });

  it("should return empty array when no schemas", () => {
    const spec = { paths: {} };
    const schemas = extractSchemas(spec as any);

    expect(schemas.length).toBe(0);
  });

  // 快照测试
  it("should generate snapshot for schemas", () => {
    const project = createMockProject("test", "./mock.json");
    const schemas = extractSchemas(project.spec!);

    expect(schemas).toMatchSnapshot();
  });
});

describe("tools - search_apis", () => {
  it("should search endpoints by keyword in path", () => {
    const endpoints = extractEndpoints(mockSpec);
    const keyword = "packageUnit";

    const matched = endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.summary.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.description.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.operationId.toLowerCase().includes(keyword.toLowerCase()),
    );

    expect(matched.length).toBe(3);
  });

  it("should search endpoints by summary", () => {
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
    const keyword = "NonExistent12345";

    const matched = endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.summary.toLowerCase().includes(keyword.toLowerCase()),
    );

    expect(matched.length).toBe(0);
  });

  it("should be case insensitive when searching", () => {
    const endpoints = extractEndpoints(mockSpec);
    const keyword = "packageUnit";

    const matched = endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(keyword.toLowerCase()),
    );

    // 搜索不区分大小写，应该能找到结果
    expect(matched.length).toBe(3);
  });

  // 快照测试
  it("should generate snapshot for search results", () => {
    const endpoints = extractEndpoints(mockSpec);
    const keyword = "packageUnit";

    const matched = endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(keyword.toLowerCase()) ||
        ep.summary.toLowerCase().includes(keyword.toLowerCase()),
    );

    const result = {
      total: matched.length,
      results: matched.map((ep) => ({
        path: ep.path,
        method: ep.method,
        summary: ep.summary,
      })),
    };

    expect(result).toMatchSnapshot();
  });
});

describe("tools - generate_ts_by_endpoint", () => {
  it("should generate TypeScript for GET endpoint with query params", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/packageUnit/queryList",
      "GET",
      mockSpec,
    );

    expect(code).toContain("TQueryListParams");
    expect(code).toContain("disabled");
  });

  it("should generate TypeScript for POST endpoint with request body", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/packageUnit/queryPackageInfos",
      "POST",
      mockSpec,
    );

    expect(code).toContain("TQueryPackageInfosParams");
    expect(code).toContain("packageNameEn");
    expect(code).toContain("packageCode");
  });

  it("should generate TypeScript for response types", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/packageUnit/queryList",
      "GET",
      mockSpec,
    );

    expect(code).toContain("TQueryListResponse");
  });

  it("should return error for non-existent endpoint", () => {
    const code = generateTypeScriptByEndpoint("/non/existent", "GET", mockSpec);

    expect(code).toContain("未找到");
  });

  it("should handle PUT endpoint", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/resource/update/roleResource",
      "PUT",
      mockSpec,
    );

    expect(code).toContain("TRoleResourceParams");
  });

  // 快照测试
  it("should generate snapshot for queryList", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/packageUnit/queryList",
      "GET",
      mockSpec,
    );

    expect(code).toMatchSnapshot();
  });

  it("should generate snapshot for queryPackageInfo", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/packageUnit/queryPackageInfo",
      "GET",
      mockSpec,
    );

    expect(code).toMatchSnapshot();
  });

  it("should generate snapshot for queryPackageInfos (POST)", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/packageUnit/queryPackageInfos",
      "POST",
      mockSpec,
    );

    expect(code).toMatchSnapshot();
  });

  it("should generate snapshot for roleResource (PUT)", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/resource/update/roleResource",
      "PUT",
      mockSpec,
    );

    expect(code).toMatchSnapshot();
  });

  it("should generate snapshot for validPortDisableStatus (POST)", () => {
    const code = generateTypeScriptByEndpoint(
      "/access/port/validPortDisableStatus",
      "POST",
      mockSpec,
    );

    expect(code).toMatchSnapshot();
  });
});
