import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { SwaggerProject } from "./types.js";
import { registerTools } from "./tools.js";

// 存储文件路径
const STORAGE_FILE = join(homedir(), ".mcp-swagger-reader", "projects.json");

/**
 * 从文件加载项目列表
 */
function loadProjects(): Map<string, SwaggerProject> {
  const projects = new Map<string, SwaggerProject>();
  try {
    if (existsSync(STORAGE_FILE)) {
      const data = readFileSync(STORAGE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      for (const [key, value] of Object.entries(parsed)) {
        projects.set(key, value as SwaggerProject);
      }
    }
  } catch (e) {
    console.error("Failed to load projects:", e);
  }
  return projects;
}

/**
 * 保存项目列表到文件（只保存 name 和 swaggerUrl，不保存 spec）
 */
function saveProjects(projects: Map<string, SwaggerProject>) {
  try {
    const data: Record<string, { name: string; swaggerUrl: string }> = {};
    for (const [key, value] of projects) {
      data[key] = { name: value.name, swaggerUrl: value.swaggerUrl };
    }
    writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save projects:", e);
  }
}

// 加载项目
const projects: Map<string, SwaggerProject> = loadProjects();

// 从环境变量加载预配置项目
// 格式: JSON数组 [{"name":"project1","swaggerUrl":"http://..."}]
function loadEnvProjects() {
  const envProjects = process.env.SWAGGER_PROJECTS;
  if (!envProjects) return;
  try {
    const parsed = JSON.parse(envProjects) as { name: string; swaggerUrl: string }[];
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
registerTools(mcp, projects, () => saveProjects(projects));

// 启动服务器
const transport = new StdioServerTransport();
mcp.connect(transport);
