// @ts-nocheck
// 工具函数定义
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwaggerProject } from "./types.js";
import {
  loadSwaggerFromUrl,
  loadSwaggerFromFile,
  extractEndpoints,
  extractSchemas,
  generateTypeScriptByEndpoint,
  generateFullTypeScript,
  extractSchemaType,
} from "./parser.js";

export function registerTools(
  mcp: McpServer,
  projects: Map<string, SwaggerProject>,
  saveProjects?: () => void,
) {
  // 工具：添加项目Swagger配置
  mcp.registerTool(
    "add_swagger_project",
    {
      description: "添加一个项目的Swagger/OpenAPI配置",
      inputSchema: z.object({
        name: z.string().describe("项目名称"),
        swaggerUrl: z
          .string()
          .describe("Swagger/OpenAPI JSON文件的URL地址或本地文件路径"),
      }),
    },
    async ({ name, swaggerUrl }: { name: string; swaggerUrl: string }) => {
      projects.set(name, { name, swaggerUrl });

      // 尝试预加载规范
      try {
        const spec =
          swaggerUrl.startsWith("http://") || swaggerUrl.startsWith("https://")
            ? await loadSwaggerFromUrl(swaggerUrl)
            : loadSwaggerFromFile(swaggerUrl);
        projects.get(name)!.spec = spec;
      } catch (e) {
        // 忽略加载错误，用户可以稍后重试
      }

      // 保存到文件
      saveProjects?.();

      return {
        content: [
          {
            type: "text",
            text: `已添加项目: ${name}, Swagger地址: ${swaggerUrl}`,
          },
        ],
      };
    },
  );

  // 工具：列出所有已配置的项目
  mcp.registerTool(
    "list_swagger_projects",
    {
      description: "列出所有已配置的Swagger项目",
      inputSchema: z.object({}),
    },
    async () => {
      const projectList = Array.from(projects.values()).map((p) => ({
        name: p.name,
        swaggerUrl: p.swaggerUrl,
        loaded: !!p.spec,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(projectList, null, 2) }],
      };
    },
  );

  // 工具：获取所有接口列表
  mcp.registerTool(
    "get_api_endpoints",
    {
      description: "获取指定项目的所有API接口列表",
      inputSchema: z.object({
        projectName: z.string().describe("项目名称"),
      }),
    },
    async ({ projectName }: { projectName: string }) => {
      const project = projects.get(projectName);
      if (!project) {
        return {
          content: [
            {
              type: "text",
              text: `项目 "${projectName}" 未找到，请先使用 add_swagger_project 添加`,
            },
          ],
        };
      }

      // 如果还没加载spec，尝试加载
      if (!project.spec) {
        try {
          project.spec =
            project.swaggerUrl.startsWith("http://") ||
            project.swaggerUrl.startsWith("https://")
              ? await loadSwaggerFromUrl(project.swaggerUrl)
              : loadSwaggerFromFile(project.swaggerUrl);
        } catch (e) {
          return {
            content: [{ type: "text", text: `加载Swagger规范失败: ${e}` }],
          };
        }
      }

      const endpoints = extractEndpoints(project.spec);
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
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  // 工具：获取接口详情
  mcp.registerTool(
    "get_api_detail",
    {
      description: "获取指定接口的详细信息",
      inputSchema: z.object({
        projectName: z.string().describe("项目名称"),
        path: z.string().describe("API路径，如 /users/{id}"),
        method: z.string().describe("HTTP方法，如 GET, POST"),
      }),
    },
    async ({
      projectName,
      path,
      method,
    }: {
      projectName: string;
      path: string;
      method: string;
    }) => {
      const project = projects.get(projectName);
      if (!project || !project.spec) {
        return {
          content: [
            { type: "text", text: `项目 "${projectName}" 未找到或未加载` },
          ],
        };
      }

      const endpoints = extractEndpoints(project.spec);
      const endpoint = endpoints.find(
        (ep) =>
          ep.path === path && ep.method.toLowerCase() === method.toLowerCase(),
      );

      if (!endpoint) {
        return {
          content: [{ type: "text", text: `未找到接口: ${method} ${path}` }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(endpoint, null, 2) }],
      };
    },
  );

  // 工具：获取所有数据模型/Schemas
  mcp.registerTool(
    "get_schemas",
    {
      description: "获取指定项目的所有数据模型/Schemas",
      inputSchema: z.object({
        projectName: z.string().describe("项目名称"),
      }),
    },
    async ({ projectName }: { projectName: string }) => {
      const project = projects.get(projectName);
      if (!project || !project.spec) {
        return {
          content: [
            { type: "text", text: `项目 "${projectName}" 未找到或未加载` },
          ],
        };
      }
      const schemas = extractSchemas(project.spec);
      return {
        content: [{ type: "text", text: JSON.stringify(schemas, null, 2) }],
      };
    },
  );

  // 工具：搜索接口
  mcp.registerTool(
    "search_apis",
    {
      description: "根据关键词搜索API接口",
      inputSchema: z.object({
        projectName: z.string().describe("项目名称"),
        keyword: z
          .string()
          .describe("搜索关键词，会在路径、摘要、描述中搜索"),
      }),
    },
    async ({
      projectName,
      keyword,
    }: {
      projectName: string;
      keyword: string;
    }) => {
      const project = projects.get(projectName);
      if (!project || !project.spec) {
        return {
          content: [
            { type: "text", text: `项目 "${projectName}" 未找到或未加载` },
          ],
        };
      }

      const endpoints = extractEndpoints(project.spec);
      const keywordLower = keyword.toLowerCase();
      const matched = endpoints.filter(
        (ep) =>
          ep.path.toLowerCase().includes(keywordLower) ||
          ep.summary.toLowerCase().includes(keywordLower) ||
          ep.description.toLowerCase().includes(keywordLower) ||
          ep.operationId.toLowerCase().includes(keywordLower),
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: matched.length,
                results: matched.map((ep) => ({
                  path: ep.path,
                  method: ep.method,
                  summary: ep.summary,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // 工具：重新加载项目规范
  mcp.registerTool(
    "reload_swagger",
    {
      description: "重新加载项目的Swagger规范",
      inputSchema: z.object({
        projectName: z.string().describe("项目名称"),
      }),
    },
    async ({ projectName }: { projectName: string }) => {
      const project = projects.get(projectName);
      if (!project) {
        return {
          content: [{ type: "text", text: `项目 "${projectName}" 未找到` }],
        };
      }

      try {
        project.spec =
          project.swaggerUrl.startsWith("http://") ||
          project.swaggerUrl.startsWith("https://")
            ? await loadSwaggerFromUrl(project.swaggerUrl)
            : loadSwaggerFromFile(project.swaggerUrl);
        // 保存到文件
        saveProjects?.();
        return {
          content: [
            {
              type: "text",
              text: `项目 "${projectName}" 已重新加载，共 ${Object.keys(project.spec.paths || {}).length} 个路径`,
            },
          ],
        };
      } catch (e) {
        return { content: [{ type: "text", text: `重新加载失败: ${e}` }] };
      }
    },
  );

  // 工具：根据接口路径和方法生成 TypeScript 类型
  mcp.registerTool(
    "generate_ts_by_endpoint",
    {
      description: "根据 API 接口路径和方法生成 TypeScript 类型（请求参数、Body、响应）",
      inputSchema: z.object({
        projectName: z.string().describe("项目名称"),
        path: z.string().describe("API路径，如 /access/packageUnit/queryList"),
        method: z.string().describe("HTTP方法，如 GET, POST, PUT, DELETE"),
      }),
    },
    async ({ projectName, path, method }: { projectName: string; path: string; method: string }) => {
      const project = projects.get(projectName);
      if (!project || !project.spec) {
        return {
          content: [
            { type: "text", text: `项目 "${projectName}" 未找到或未加载` },
          ],
        };
      }

      // 使用 openapi-typescript 生成全量类型
      const fullTypes = await generateFullTypeScript(project.spec, projectName);

      // 从全量类型中提取接口相关的类型
      const endpoints = extractEndpoints(project.spec);
      const endpoint = endpoints.find(
        (ep) => ep.path === path && ep.method.toLowerCase() === method.toLowerCase(),
      );

      if (!endpoint) {
        return {
          content: [{ type: "text", text: `未找到接口: ${method} ${path}` }],
        };
      }

      // 提取相关 Schema 类型
      const results: string[] = [];
      const components = project.spec.components || {};
      const schemas = components.schemas || {};

      // 收集请求和响应中引用的 Schema
      const usedSchemas = new Set<string>();

      // 从 requestBody 收集
      if (endpoint.requestBody) {
        const bodyContent = endpoint.requestBody.content?.["application/json"];
        if (bodyContent?.schema?.$ref) {
          usedSchemas.add(bodyContent.schema.$ref.replace("#/components/schemas/", ""));
        }
      }

      // 从 responses 收集
      for (const resp of endpoint.responses) {
        // 这里可以进一步解析响应中的 schema
      }

      // 收集 parameters 中的引用
      for (const param of endpoint.parameters) {
        // 参数类型通常比较简单，不一定需要提取复杂类型
      }

      // 生成代码：先输出接口信息，然后输出相关类型
      const pathName = path.split("/").filter(Boolean).pop() || "unknown";
      const name = pathName.charAt(0).toUpperCase() + pathName.slice(1);

      results.push(`// 接口: ${method} ${path}`);
      results.push(`// ${endpoint.summary || endpoint.description || ""}`);
      results.push("");

      // 尝试从全量类型中提取
      if (fullTypes.startsWith("// Error")) {
        // 如果 openapi-typescript 失败，回退到旧方法
        const code = generateTypeScriptByEndpoint(path, method, project.spec);
        return {
          content: [{ type: "text", text: code }],
        };
      }

      // 从全量类型中提取需要的部分
      const extracted = extractSchemaType(fullTypes, name);
      if (extracted && !extracted.includes("not found")) {
        results.push(extracted);
      } else {
        // 如果没找到专门的类型，尝试找 Request/Response 相关的
        results.push(`// 类型定义请参考项目全量类型`);
      }

      return {
        content: [{ type: "text", text: results.join("\n") || fullTypes.slice(0, 5000) }],
      };
    },
  );

  // 工具：根据 Schema 名称生成 TypeScript interface（使用 openapi-typescript）
  mcp.registerTool(
    "generate_ts_interfaces",
    {
      description: "根据 Schema 名称生成 TypeScript interface 定义",
      inputSchema: z.object({
        projectName: z.string().describe("项目名称"),
        schemaName: z.string().describe("Schema 名称，如 包装单位"),
      }),
    },
    async ({ projectName, schemaName }: { projectName: string; schemaName: string }) => {
      const project = projects.get(projectName);
      if (!project || !project.spec) {
        return {
          content: [
            { type: "text", text: `项目 "${projectName}" 未找到或未加载` },
          ],
        };
      }

      try {
        // 使用 openapi-typescript 生成全量类型
        const fullTypes = await generateFullTypeScript(project.spec, projectName);

        if (fullTypes.startsWith("// Error")) {
          return { content: [{ type: "text", text: fullTypes }] };
        }

        // 提取指定的 Schema 类型
        const typeCode = extractSchemaType(fullTypes, schemaName);

        if (typeCode.includes("not found")) {
          return {
            content: [
              {
                type: "text",
                text: `未找到 Schema: "${schemaName}"\n\n可用的 Schemas:\n${Object.keys(project.spec.components?.schemas || {}).join(", ")}`,
              },
            ],
          };
        }

        return { content: [{ type: "text", text: typeCode }] };
      } catch (e) {
        return { content: [{ type: "text", text: `生成类型失败: ${e}` }] };
      }
    },
  );
}
