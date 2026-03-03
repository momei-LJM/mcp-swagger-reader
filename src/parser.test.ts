import { describe, it, expect } from "vitest";
import {
  parseSwaggerSpec,
  extractEndpoints,
  extractSchemas,
  generateTypeScriptByEndpoint,
} from "../src/parser.js";
import { readFileSync } from "fs";

const mockSpec = JSON.parse(readFileSync("./mock.json", "utf-8"));

// 测试用的 mock spec，包含复杂场景
const complexMockSpec = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/test/nested-ref": {
      get: {
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "integer" },
            description: "用户ID",
          },
        ],
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/用户详情",
                },
              },
            },
          },
        },
      },
    },
    "/test/combined": {
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/组合类型",
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/用户信息",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      用户: {
        type: "object",
        properties: {
          id: { type: "integer", description: "用户ID" },
          name: { type: "string", description: "用户名称" },
        },
        required: ["id", "name"],
      },
      用户详情: {
        type: "object",
        properties: {
          user: {
            $ref: "#/components/schemas/用户",
          },
          profile: {
            $ref: "#/components/schemas/用户Profile",
          },
        },
      },
      用户Profile: {
        type: "object",
        properties: {
          bio: { type: "string", description: "个人简介" },
          avatar: { type: "string", description: "头像URL" },
        },
      },
      基础信息: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
        },
      },
      扩展信息: {
        type: "object",
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
        },
      },
      组合类型: {
        allOf: [
          { $ref: "#/components/schemas/基础信息" },
          { $ref: "#/components/schemas/扩展信息" },
        ],
      },
      可选组合: {
        oneOf: [
          { $ref: "#/components/schemas/用户" },
          { $ref: "#/components/schemas/用户Profile" },
        ],
      },
      混合组合: {
        anyOf: [
          { $ref: "#/components/schemas/基础信息" },
          { type: "string" },
        ],
      },
      用户信息: {
        type: "object",
        properties: {
          id: { type: "integer" },
          username: { type: "string" },
          tags: {
            type: "array",
            items: {
              $ref: "#/components/schemas/标签",
            },
          },
        },
      },
      标签: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
        },
      },
    },
  },
};

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
      expect(code).toContain("TQueryPackageInfosParams");
      expect(code).toContain("packageNameEn");
      expect(code).toContain("packageCode");
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

  describe("generateTypeScriptByEndpoint - 复杂场景", () => {
    it("should handle nested $ref", () => {
      const code = generateTypeScriptByEndpoint("/test/nested-ref", "GET", complexMockSpec);
      expect(code).toContain("TNested-refParams");
      expect(code).toContain("id");
    });

    it("should handle array response with $ref items", () => {
      const code = generateTypeScriptByEndpoint("/test/combined", "POST", complexMockSpec);
      expect(code).toContain("TCombinedResponse");
    });

    it("should expand nested properties", () => {
      const code = generateTypeScriptByEndpoint("/test/nested-ref", "GET", complexMockSpec);
      // 响应应该展开用户详情中的嵌套属性
      expect(code).toContain("user");
      expect(code).toContain("profile");
    });
  });
});
