# MCP Swagger Reader

MCP工具，用于读取和解析Swagger/OpenAPI规范，帮助你快速查看项目接口信息。

## 功能

- 支持配置多个项目的Swagger地址（支持URL和本地文件）
- 获取所有API接口列表
- 获取指定接口的详细信息
- 获取数据模型/Schemas
- 搜索API接口

## 安装

```bash
cd mcp-swagger-reader
npm install
npm run build
```

## MCP配置

### Cursor/Claude Desktop配置

在 `~/.cursor/mcp.json` 或 `~/Library/Application Support/Claude/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "swagger-reader": {
      "command": "node",
      "args": ["/Users/momei/code/my_project/mcp-swagger-reader/dist/index.mjs"],
      "env": {}
    }
  }
}
```

### 环境变量预置项目

可以通过 `SWAGGER_PROJECTS` 环境变量预置项目：

```json
{
  "mcpServers": {
    "swagger-reader": {
      "command": "node",
      "args": ["/path/to/dist/index.mjs"],
      "env": {
        "SWAGGER_PROJECTS": "[{\"name\":\"my-api\",\"swaggerUrl\":\"http://example.com/swagger.json\"}]"
      }
    }
  }
}
```

支持多个项目：
```json
"SWAGGER_PROJECTS": "[{\"name\":\"api1\",\"swaggerUrl\":\"http://...\"},{\"name\":\"api2\",\"swaggerUrl\":\"http://...\"}]"
```

### 数据存储

项目配置保存在 `~/.mcp-swagger-reader/projects.json`，重启后自动加载。

## 工具列表

### add_swagger_project
添加一个项目的Swagger配置。

参数：
- `name`: 项目名称
- `swaggerUrl`: Swagger/OpenAPI JSON文件的URL地址或本地文件路径

示例：
```javascript
await add_swagger_project({
  name: "my-project",
  swaggerUrl: "https://api.example.com/v2/api-docs"
})
```

### list_swagger_projects
列出所有已配置的Swagger项目。

### get_api_endpoints
获取指定项目的所有API接口列表。

参数：
- `projectName`: 项目名称

### get_api_detail
获取指定接口的详细信息。

参数：
- `projectName`: 项目名称
- `path`: API路径，如 `/users/{id}`
- `method`: HTTP方法，如 `GET`, `POST`

### get_schemas
获取指定项目的所有数据模型/Schemas。

参数：
- `projectName`: 项目名称

### search_apis
根据关键词搜索API接口。

参数：
- `projectName`: 项目名称
- `keyword`: 搜索关键词

### reload_swagger
重新加载项目的Swagger规范。

参数：
- `projectName`: 项目名称

## 使用示例

1. 首先添加项目配置：
```javascript
await add_swagger_project({
  name: "user-service",
  swaggerUrl: "https://petstore.swagger.io/v2/swagger.json"
})
```

2. 查看所有接口：
```javascript
await get_api_endpoints({ projectName: "user-service" })
```

3. 获取某个接口详情：
```javascript
await get_api_detail({
  projectName: "user-service",
  path: "/pet/{petId}",
  method: "GET"
})
```

4. 搜索接口：
```javascript
await search_apis({
  projectName: "user-service",
  keyword: "user"
})
```
