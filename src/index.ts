import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { SwaggerProject } from "./types.js";
import { registerTools } from "./tools.js";

// 仅使用进程内内存存储项目，不做文件持久化
const projects: Map<string, SwaggerProject> = new Map();

// 从环境变量加载预配置项目
// 格式: JSON数组 [{"name":"project1","swaggerUrl":"http://..."}]
function loadEnvProjects() {
  const envProjects = process.env.SWAGGER_PROJECTS;
  if (!envProjects) return;
  try {
    const parsed = JSON.parse(envProjects) as {
      name: string;
      swaggerUrl: string;
    }[];
    for (const p of parsed) {
      projects.set(p.name, { name: p.name, swaggerUrl: p.swaggerUrl });
    }
    console.log(`Loaded ${parsed.length} projects from environment`);
  } catch (e) {
    console.error("Failed to parse SWAGGER_PROJECTS:", e);
  }
}
loadEnvProjects();

// 创建 MCP 服务器
const mcp = new McpServer(
  { name: "mcp-swagger-reader", version: "1.0.0" },
  {
    capabilities: { tools: {} },
  },
);

// 注册所有工具，传入保存函数
registerTools(mcp, projects);

// 启动服务器
const transport = new StdioServerTransport();
mcp.connect(transport);
