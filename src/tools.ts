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
} from "./parser.js";

async function ensureProjectSpecLoaded(
  projectName: string,
  project?: SwaggerProject,
): Promise<{ project?: SwaggerProject; error?: string }> {
  if (!project) {
    return {
      error: `项目 "${projectName}" 未找到，请先使用 add_swagger_project 添加`,
    };
  }

  if (project.spec) {
    return { project };
  }

  try {
    const spec =
      project.swaggerUrl.startsWith("http://") ||
      project.swaggerUrl.startsWith("https://")
        ? await loadSwaggerFromUrl(project.swaggerUrl)
        : loadSwaggerFromFile(project.swaggerUrl);
    return { project: { ...project, spec } };
  } catch (e) {
    return { error: `加载Swagger规范失败: ${e}` };
  }
}

export function registerTools(
  mcp: McpServer,
  projects: Map<string, SwaggerProject>,
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
      const baseProject: SwaggerProject = { name, swaggerUrl };
      const { project } = await ensureProjectSpecLoaded(name, baseProject);
      projects.set(name, project || baseProject);

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
      const currentProject = projects.get(projectName);
      const { project, error } = await ensureProjectSpecLoaded(
        projectName,
        currentProject,
      );
      if (!project) {
        return {
          content: [{ type: "text", text: error || "加载失败" }],
        };
      }
      if (project !== currentProject) {
        projects.set(projectName, project);
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
      const currentProject = projects.get(projectName);
      const { project, error } = await ensureProjectSpecLoaded(
        projectName,
        currentProject,
      );
      if (!project) {
        return {
          content: [{ type: "text", text: error || "加载失败" }],
        };
      }
      if (project !== currentProject) {
        projects.set(projectName, project);
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
      const currentProject = projects.get(projectName);
      const { project, error } = await ensureProjectSpecLoaded(
        projectName,
        currentProject,
      );
      if (!project) {
        return {
          content: [{ type: "text", text: error || "加载失败" }],
        };
      }
      if (project !== currentProject) {
        projects.set(projectName, project);
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
        keyword: z.string().describe("搜索关键词，会在路径、摘要、描述中搜索"),
      }),
    },
    async ({
      projectName,
      keyword,
    }: {
      projectName: string;
      keyword: string;
    }) => {
      const currentProject = projects.get(projectName);
      const { project, error } = await ensureProjectSpecLoaded(
        projectName,
        currentProject,
      );
      if (!project) {
        return {
          content: [{ type: "text", text: error || "加载失败" }],
        };
      }
      if (project !== currentProject) {
        projects.set(projectName, project);
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
      description:
        "根据 API 接口路径和方法生成 TypeScript 类型（请求参数、Body、响应），作为模型输入，可以进一步调整并输出",
      inputSchema: z.object({
        projectName: z.string().describe("项目名称"),
        path: z.string().describe("API路径，如 /access/packageUnit/queryList"),
        method: z.string().describe("HTTP方法，如 GET, POST, PUT, DELETE"),
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
      const currentProject = projects.get(projectName);
      const { project, error } = await ensureProjectSpecLoaded(
        projectName,
        currentProject,
      );
      if (!project) {
        return {
          content: [{ type: "text", text: error || "加载失败" }],
        };
      }
      if (project !== currentProject) {
        projects.set(projectName, project);
      }

      // 直接使用精准的单接口类型生成，避免全量类型生成导致响应过大
      const code = generateTypeScriptByEndpoint(path, method, project.spec);
      return {
        content: [{ type: "text", text: code }],
      };
    },
  );
}
