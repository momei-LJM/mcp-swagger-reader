// @ts-nocheck
// Swagger/OpenAPI 规范解析相关函数
import { readFileSync } from "fs";
import type { SwaggerSpec, Endpoint, Schema } from "./types.js";

// 每个接口的类型缓存（懒加载生成）
// key: "projectKey:method:path" -> value: generated TypeScript code
const endpointTypeCache = new Map<
  string,
  { timestamp: number; params: string; response: string }
>();
const ENDPOINT_CACHE_TTL = 10 * 60 * 1000; // 10分钟

/**
 * 从缓存获取指定接口的类型，如果缓存中没有则实时生成并缓存
 * @param projectKey 项目唯一标识
 * @param path 接口路径
 * @param method HTTP 方法
 * @param spec Swagger 规范对象（用于生成）
 * @returns Params 和 Response 类型代码
 */
export function getCachedEndpointTypes(
  projectKey: string,
  path: string,
  method: string,
  spec: SwaggerSpec,
): { params: string; response: string } {
  const cacheKey = `${projectKey}:${method.toUpperCase()}:${path}`;
  const cached = endpointTypeCache.get(cacheKey);
  const now = Date.now();

  // 命中缓存且未过期
  if (cached && now - cached.timestamp < ENDPOINT_CACHE_TTL) {
    return { params: cached.params, response: cached.response };
  }

  // 缓存不存在或已过期，生成并缓存（懒加载）
  const code = generateTypeScriptByEndpoint(path, method, spec);

  const paramsMatch = code.match(
    /export\s+(?:interface\s+T\w+Params|type\s+T\w+Params\s*=)[\s\S]*?(?=\n\/\/ ==========|$)/,
  );
  const responseMatch = code.match(
    /export\s+(?:interface\s+T\w+Response|type\s+T\w+Response\s*=)[\s\S]*$/,
  );

  const newCache = {
    timestamp: now,
    params: paramsMatch ? paramsMatch[0] : "",
    response: responseMatch ? responseMatch[0] : "",
  };

  endpointTypeCache.set(cacheKey, newCache);

  return { params: newCache.params, response: newCache.response };
}

/**
 * 解析 Swagger/OpenAPI JSON 内容

/**
 * 解析 Swagger/OpenAPI JSON 内容
 * @param content JSON 字符串
 * @returns 解析后的 Swagger 规范对象
 */
export function parseSwaggerSpec(content: string): SwaggerSpec {
  return JSON.parse(content);
}

/**
 * 从 URL 加载 Swagger/OpenAPI 规范
 * @param url 规范文件的 URL 地址
 * @returns 解析后的 Swagger 规范对象
 */
export async function loadSwaggerFromUrl(url: string): Promise<SwaggerSpec> {
  return fetch(url).then((res) => res.json());
}

/**
 * 从本地文件加载 Swagger/OpenAPI 规范
 * @param filePath 规范文件的本地路径
 * @returns 解析后的 Swagger 规范对象
 */
export function loadSwaggerFromFile(filePath: string): SwaggerSpec {
  const content = readFileSync(filePath, "utf-8");
  return parseSwaggerSpec(content);
}

/**
 * 从 Swagger 规范中提取所有 API 端点
 * @param spec Swagger 规范对象
 * @returns 端点数组
 */
export function extractEndpoints(spec: SwaggerSpec): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const paths = spec.paths || {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, details] of Object.entries(
      methods as Record<string, any>,
    )) {
      if (
        ["get", "post", "put", "delete", "patch", "options", "head"].includes(
          method,
        )
      ) {
        const endpoint: Endpoint = {
          path,
          method: method.toUpperCase(),
          summary: details.summary || "",
          description: details.description || "",
          operationId: details.operationId || "",
          tags: details.tags || [],
          parameters: (details.parameters || []).map((param: any) => ({
            name: param.name,
            in: param.in,
            required: param.required || false,
            description: param.description || "",
            type: param.schema?.type || param.type || "",
          })),
          requestBody: details.requestBody
            ? {
                description: details.requestBody.description || "",
                required: details.requestBody.required || false,
                content: Object.keys(details.requestBody.content || {}),
              }
            : null,
          responses: Object.keys(details.responses || {}).map(
            (status: string) => ({
              status,
              description: details.responses[status].description || "",
            }),
          ),
        };
        endpoints.push(endpoint);
      }
    }
  }

  return endpoints;
}

/**
 * 从 Swagger 规范中提取所有 Schema 定义
 * @param spec Swagger 规范对象
 * @returns Schema 数组
 */
export function extractSchemas(spec: SwaggerSpec): Schema[] {
  const schemas: Schema[] = [];
  const components = spec.components || spec.definitions || {};
  const schemasObj = components.schemas || components;

  for (const [name, schema] of Object.entries(schemasObj)) {
    const s = schema as any;
    schemas.push({
      name,
      type: s.type || "object",
      description: s.description || "",
      properties: Object.entries(s.properties || {}).map(
        ([propName, propValue]: [string, any]): SchemaProperty => ({
          name: propName,
          type: propValue.type || "",
          description: propValue.description || "",
          format: propValue.format || "",
        }),
      ),
    });
  }

  return schemas;
}

/**
 * Schema 展开结果类型
 */
type ExpandedSchema =
  | { kind: "object"; content: string }
  | { kind: "primitive"; content: string }
  | { kind: "reference"; name: string };

/**
 * 将 Schema 展开为 TypeScript interface 定义
 * @param maxDepth 最大递归深度，超过后使用引用名称
 * @param deferredSchemas 收集超出深度的被引用 schema 名称，后续单独输出
 */
function expandSchemaToInterface(
  schemaName: string,
  spec: SwaggerSpec,
  visited: Set<string> = new Set(),
  maxDepth: number = 5,
  deferredSchemas?: Set<string>,
): ExpandedSchema {
  const components = spec.components || {};
  const schemas = components.schemas || {};
  const schema = schemas[schemaName];

  if (!schema) {
    return { kind: "reference", name: schemaName };
  }

  // 防止循环引用
  if (visited.has(schemaName)) {
    return { kind: "reference", name: schemaName };
  }

  // 超过深度限制，使用引用名称并收集到 deferred 列表
  if (maxDepth <= 0) {
    if (deferredSchemas) {
      deferredSchemas.add(schemaName);
    }
    return { kind: "reference", name: schemaName };
  }

  visited.add(schemaName);

  // 如果是基础类型，直接返回
  if (
    schema.type &&
    !schema.properties &&
    !schema.allOf &&
    !schema.oneOf &&
    !schema.anyOf
  ) {
    let tsType = schema.type;
    if (tsType === "integer") tsType = "number";
    return { kind: "primitive", content: tsType };
  }

  // 处理 $ref
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "");
    return expandSchemaToInterface(
      refName,
      spec,
      visited,
      maxDepth - 1,
      deferredSchemas,
    );
  }

  // 处理组合类型 allOf/oneOf/anyOf
  if (schema.allOf || schema.oneOf || schema.anyOf) {
    const compositionSchemas = schema.allOf || schema.oneOf || schema.anyOf;
    const expandedTypes = compositionSchemas.map((s: any) => {
      if (s.$ref) {
        const refName = s.$ref.replace("#/components/schemas/", "");
        return expandSchemaToInterface(
          refName,
          spec,
          new Set(visited),
          maxDepth - 1,
          deferredSchemas,
        );
      }
      // 内联 schema 展开
      return expandInlineSchema(
        s,
        spec,
        visited,
        maxDepth - 1,
        deferredSchemas,
      );
    });

    const operator = schema.allOf ? " & " : " | ";
    const content = expandedTypes
      .map((t) => {
        if (t.kind === "object") return `{ ${t.content} }`;
        if (t.kind === "reference") return t.name;
        return t.content;
      })
      .join(operator);

    return { kind: "primitive", content };
  }

  // 展开对象属性
  const properties = schema.properties || {};
  const requiredFields = new Set(schema.required || []);

  const propsLines = Object.entries(properties).map(
    ([propName, propValue]: [string, any]) => {
      const required = requiredFields.has(propName);
      const optional = required ? "" : "?";
      const description = propValue.description
        ? ` // ${propValue.description}`
        : "";

      // 处理数组类型
      if (propValue.type === "array" && propValue.items) {
        if (propValue.items.$ref) {
          const itemType = propValue.items.$ref.replace(
            "#/components/schemas/",
            "",
          );
          const expanded = expandSchemaToInterface(
            itemType,
            spec,
            new Set(visited),
            maxDepth - 1,
            deferredSchemas,
          );
          const itemContent =
            expanded.kind === "object"
              ? `{ ${expanded.content} }`
              : expanded.kind === "reference"
                ? expanded.name
                : expanded.content;
          return `  ${propName}${optional}: ${itemContent}[];${description}`;
        }
        let itemType = propValue.items.type || "any";
        if (itemType === "integer") itemType = "number";
        return `  ${propName}${optional}: ${itemType}[];${description}`;
      }

      // 处理 $ref
      if (propValue.$ref) {
        const refType = propValue.$ref.replace("#/components/schemas/", "");
        const expanded = expandSchemaToInterface(
          refType,
          spec,
          new Set(visited),
          maxDepth - 1,
          deferredSchemas,
        );
        const typeContent =
          expanded.kind === "object"
            ? `{ ${expanded.content} }`
            : expanded.kind === "reference"
              ? expanded.name
              : expanded.content;
        return `  ${propName}${optional}: ${typeContent};${description}`;
      }

      // 基础类型
      let tsType = propValue.type || "any";
      if (tsType === "integer") {
        tsType = "number";
      }
      return `  ${propName}${optional}: ${tsType};${description}`;
    },
  );

  return { kind: "object", content: propsLines.join("\n") };
}

/**
 * 展开内联 Schema（不引用 components.schemas 的内联定义）
 */
function expandInlineSchema(
  schema: any,
  spec: SwaggerSpec,
  visited: Set<string>,
  maxDepth: number = 5,
  deferredSchemas?: Set<string>,
): ExpandedSchema {
  if (!schema) {
    return { kind: "primitive", content: "any" };
  }

  // 处理 $ref
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "");
    return expandSchemaToInterface(
      refName,
      spec,
      visited,
      maxDepth - 1,
      deferredSchemas,
    );
  }

  // 基础类型
  if (
    schema.type &&
    !schema.properties &&
    !schema.allOf &&
    !schema.oneOf &&
    !schema.anyOf
  ) {
    let tsType = schema.type;
    if (tsType === "integer") tsType = "number";
    return { kind: "primitive", content: tsType };
  }

  // 处理组合类型
  if (schema.allOf || schema.oneOf || schema.anyOf) {
    const compositionSchemas = schema.allOf || schema.oneOf || schema.anyOf;
    const expandedTypes = compositionSchemas.map((s: any) =>
      expandInlineSchema(s, spec, visited, maxDepth - 1, deferredSchemas),
    );
    const operator = schema.allOf ? " & " : " | ";
    const content = expandedTypes
      .map((t) => {
        if (t.kind === "object") return `{ ${t.content} }`;
        if (t.kind === "reference") return t.name;
        return t.content;
      })
      .join(operator);
    return { kind: "primitive", content };
  }

  // 对象属性
  const properties = schema.properties || {};
  const requiredFields = new Set(schema.required || []);

  const propsLines = Object.entries(properties).map(
    ([propName, propValue]: [string, any]) => {
      const required = requiredFields.has(propName);
      const optional = required ? "" : "?";
      const description = propValue.description
        ? ` // ${propValue.description}`
        : "";

      if (propValue.type === "array" && propValue.items) {
        if (propValue.items.$ref) {
          const itemType = propValue.items.$ref.replace(
            "#/components/schemas/",
            "",
          );
          return `  ${propName}${optional}: ${itemType}[];${description}`;
        }
        let itemType = propValue.items.type || "any";
        if (itemType === "integer") itemType = "number";
        return `  ${propName}${optional}: ${itemType}[];${description}`;
      }

      if (propValue.$ref) {
        const refType = propValue.$ref.replace("#/components/schemas/", "");
        return `  ${propName}${optional}: ${refType};${description}`;
      }

      let tsType = propValue.type || "any";
      if (tsType === "integer") tsType = "number";
      return `  ${propName}${optional}: ${tsType};${description}`;
    },
  );

  return { kind: "object", content: propsLines.join("\n") };
}

/**
 * 根据接口路径和方法生成 TypeScript 类型
 * @param path API 路径，如 /access/packageUnit/queryList
 * @param method HTTP 方法，如 GET, POST
 * @param spec Swagger 规范对象
 * @returns TypeScript 类型代码
 *
 * 命名规范：
 * - 请求参数: T${name}Params (GET query 参数 或 POST/PUT 请求体)
 * - 响应: T${name}Response
 * - name 取接口 url 的最后一段，如 /access/packageUnit/queryList -> queryList
 */
export function generateTypeScriptByEndpoint(
  path: string,
  method: string,
  spec: SwaggerSpec,
): string {
  const paths = spec.paths || {};
  const endpoint = paths[path]?.[method.toLowerCase()];

  if (!endpoint) {
    return `// 接口未找到: ${method} ${path}`;
  }

  // 获取接口名称（url 最后一段，首字母大写）
  const pathName = path.split("/").filter(Boolean).pop() || "unknown";
  const name = pathName.charAt(0).toUpperCase() + pathName.slice(1);
  const upperMethod = method.toUpperCase();
  const results: string[] = [];
  const components = spec.components || {};
  const schemas = components.schemas || {};

  // 收集超出深度限制的被引用 schema，后续单独输出
  const deferredSchemas = new Set<string>();

  // 接口注释
  results.push(`// ========== ${path} - ${upperMethod} ==========`);

  // 1. 处理请求参数 (parameters - query/path/header)
  const parameters = endpoint.parameters || [];
  if (parameters.length > 0) {
    const queryParams = parameters.filter((p: any) => p.in === "query");
    const pathParams = parameters.filter((p: any) => p.in === "path");

    if (queryParams.length > 0 || pathParams.length > 0) {
      results.push(`export interface T${name}Params {`);
      for (const param of parameters) {
        const required = param.required ? "" : "?";
        let paramType = "string";
        if (param.schema?.type) {
          paramType =
            param.schema.type === "integer" ? "number" : param.schema.type;
        }
        results.push(
          `  ${param.name}${required}: ${paramType}; // ${param.description || ""}`,
        );
      }
      results.push("}");
      results.push("");
    }
  }

  // 2. 处理请求 Body (POST/PUT/DELETE 请求体，也作为 Params)
  const requestBody = endpoint.requestBody;
  const bodyContent =
    requestBody?.content?.["application/json"] || requestBody?.content?.["*/*"];
  if (bodyContent?.schema) {
    const bodySchema = bodyContent.schema;
    const refName = bodySchema.$ref?.replace("#/components/schemas/", "");

    if (refName && schemas[refName]) {
      const expanded = expandSchemaToInterface(
        refName,
        spec,
        new Set(),
        5,
        deferredSchemas,
      );
      if (expanded.kind === "object") {
        results.push(
          `export interface T${name}Params {\n${expanded.content}\n}`,
        );
      } else {
        results.push(
          `export type T${name}Params = ${expanded.kind === "reference" ? expanded.name : expanded.content};`,
        );
      }
      results.push("");
    } else if (bodySchema.type === "array" && bodySchema.items?.$ref) {
      const itemRef = bodySchema.items.$ref.replace(
        "#/components/schemas/",
        "",
      );
      const expanded = expandSchemaToInterface(
        itemRef,
        spec,
        new Set(),
        5,
        deferredSchemas,
      );
      if (expanded.kind === "object") {
        results.push(
          `export interface T${name}Params {\n${expanded.content}\n}`,
        );
      } else {
        const itemType =
          expanded.kind === "reference" ? expanded.name : expanded.content;
        results.push(`export type T${name}Params = ${itemType}[];`);
      }
      results.push("");
    }
  }

  // 3. 处理响应
  const responses = endpoint.responses || {};
  const successResponse = responses["200"] || responses["201"];
  const respContent =
    successResponse?.content?.["application/json"] ||
    successResponse?.content?.["*/*"];
  if (respContent?.schema) {
    const respSchema = respContent.schema;
    const refName = respSchema.$ref?.replace("#/components/schemas/", "");

    if (refName && schemas[refName]) {
      const expanded = expandSchemaToInterface(
        refName,
        spec,
        new Set(),
        3,
        deferredSchemas,
      );
      if (expanded.kind === "object") {
        results.push(
          `export interface T${name}Response {\n${expanded.content}\n}`,
        );
      } else {
        results.push(
          `export type T${name}Response = ${expanded.kind === "reference" ? expanded.name : expanded.content};`,
        );
      }
    } else if (respSchema.type === "array" && respSchema.items?.$ref) {
      const itemRef = respSchema.items.$ref.replace(
        "#/components/schemas/",
        "",
      );
      const expanded = expandSchemaToInterface(
        itemRef,
        spec,
        new Set(),
        3,
        deferredSchemas,
      );
      if (expanded.kind === "object") {
        results.push(
          `export interface T${name}Response {\n${expanded.content}\n}`,
        );
      } else {
        const itemType =
          expanded.kind === "reference" ? expanded.name : expanded.content;
        results.push(`export type T${name}Response = ${itemType}[];`);
      }
    } else if (respSchema.type) {
      results.push(`export type T${name}Response = ${respSchema.type};`);
    }
  }

  // 4. 输出超出深度限制的被引用 schema 定义
  if (deferredSchemas.size > 0) {
    results.push("");
    results.push("// ========== 引用的类型定义 ==========");
    for (const schemaName of deferredSchemas) {
      const schema = schemas[schemaName];
      if (!schema) continue;

      // 对 deferred schema 展开 1 层（不再递归）
      const expanded = expandSchemaToInterface(schemaName, spec, new Set(), 1);
      if (expanded.kind === "object") {
        results.push(
          `export interface ${schemaName} {\n${expanded.content}\n}`,
        );
      } else if (expanded.kind === "primitive") {
        results.push(`export type ${schemaName} = ${expanded.content};`);
      }
    }
  }

  return results.join("\n") || `// 无需生成的类型`;
}
