// @ts-nocheck
// Swagger/OpenAPI 规范解析相关函数
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import type { SwaggerSpec, Endpoint, Schema, SchemaProperty } from "./types.js";
import openapiTS, { astToString } from "openapi-typescript";

// 缓存生成的类型，避免重复解析
const typeCache = new Map<string, { timestamp: number; content: string }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取缓存的生成类型
 */
function getCachedTypes(projectKey: string): string | null {
  const cached = typeCache.get(projectKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }
  return null;
}

/**
 * 设置缓存的生成类型
 */
function setCachedTypes(projectKey: string, content: string): void {
  typeCache.set(projectKey, { timestamp: Date.now(), content });
}

/**
 * 使用 openapi-typescript 生成全量 TypeScript 类型
 * @param spec Swagger 规范对象
 * @param projectKey 项目唯一标识（用于缓存）
 * @returns TypeScript 类型代码
 */
export async function generateFullTypeScript(
  spec: SwaggerSpec,
  projectKey: string,
): Promise<string> {
  // 检查缓存
  const cached = getCachedTypes(projectKey);
  if (cached) {
    return cached;
  }

  try {
    // 创建临时文件来存储规范（openapi-typescript 需要文件路径或 URL）
    const tempDir = "./.temp";
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = `${tempDir}/${projectKey.replace(/[^a-z0-9]/gi, "_")}_spec.json`;
    writeFileSync(tempFile, JSON.stringify(spec));

    // 使用 openapi-typescript 生成类型
    const ast = await openapiTS(tempFile, {
      exportType: true,
      alphabetize: false,
    });

    const types = astToString(ast);
    setCachedTypes(projectKey, types);
    return types;
  } catch (e) {
    return `// Error generating TypeScript: ${e}`;
  }
}

/**
 * 从生成的类型中提取单个 Schema 类型
 * @param fullTypes 完整的 TypeScript 类型代码
 * @param schemaName Schema 名称
 * @returns 单个 Schema 的 TypeScript 定义
 */
export function extractSchemaType(
  fullTypes: string,
  schemaName: string,
): string {
  // 匹配 export interface SchemaName { ... } 或 export type SchemaName = ...
  const interfaceRegex = new RegExp(
    `(export\\s+(?:interface|type)\\s+${schemaName}\\s*[{=][\\s\\S]*?)(?=\\n(?:export\\s|\\n\\s*\\n|\\Z))`,
    "m",
  );
  const match = fullTypes.match(interfaceRegex);
  return match ? match[1] : `// Schema "${schemaName}" not found`;
}

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
 * 将 Swagger 类型转换为 TypeScript 类型
 */
function swaggerTypeToTs(type: string, format?: string): string {
  if (!type) return "any";

  switch (type) {
    case "string":
      if (format === "date-time" || format === "date") return "string";
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "any[]";
    case "object":
      return "object";
    default:
      return "any";
  }
}

/**
 * 解析单个属性，返回 TypeScript 类型字符串
 */
function parseProperty(
  propName: string,
  schema: any,
  spec: SwaggerSpec,
  requiredFields: Set<string>,
): { type: string; required: boolean } {
  const required = requiredFields.has(propName);

  // 处理 $ref 引用
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "");
    return { type: refName, required };
  }

  // 处理数组
  if (schema.type === "array" && schema.items) {
    if (schema.items.$ref) {
      const refName = schema.items.$ref.replace("#/components/schemas/", "");
      return { type: `${refName}[]`, required };
    }
    const itemType = swaggerTypeToTs(schema.items.type, schema.items.format);
    return { type: `${itemType}[]`, required };
  }

  return {
    type: swaggerTypeToTs(schema.type, schema.format),
    required,
  };
}

/**
 * 递归生成 TypeScript 类型
 */
function generateTsType(
  schema: any,
  spec: SwaggerSpec,
  visited: Set<string> = new Set(),
): string {
  if (!schema) return "any";

  // 处理 $ref 引用
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "");
    return refName;
  }

  // 处理数组
  if (schema.type === "array" && schema.items) {
    return `${generateTsType(schema.items, spec, visited)}[]`;
  }

  // 处理基础类型
  switch (schema.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([key, val]: [string, any]) => {
            const required = (schema.required || []).includes(key);
            const optional = required ? "" : "?";
            return `  ${key}${optional}: ${generateTsType(val, spec, visited)};`;
          })
          .join("\n");
        return `{\n${props}\n}`;
      }
      return "Record<string, any>";
    default:
      return "any";
  }
}

/**
 * Schema 展开结果类型
 */
type ExpandedSchema =
  | { kind: "object"; content: string }
  | { kind: "primitive"; content: string }
  | { kind: "reference"; name: string };

/**
 * 判断 Schema 是否为对象类型
 */
function isObjectSchema(schema: any): boolean {
  // 有 properties 的是对象
  if (schema.properties) return true;
  // 有 $ref 的是引用，需要递归判断
  if (schema.$ref) return false; // 让调用方处理
  // 有 allOf/oneOf/anyOf 的是组合类型，视为对象
  if (schema.allOf || schema.oneOf || schema.anyOf) return true;
  // 有 type 且不是 object 的是基础类型
  if (schema.type && schema.type !== "object") return false;
  // 默认视为对象
  return true;
}

/**
 * 将 Schema 展开为 TypeScript interface 定义
 */
function expandSchemaToInterface(
  schemaName: string,
  spec: SwaggerSpec,
  visited: Set<string> = new Set(),
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
  visited.add(schemaName);

  // 如果是基础类型，直接返回
  if (schema.type && !schema.properties && !schema.allOf && !schema.oneOf && !schema.anyOf) {
    let tsType = schema.type;
    if (tsType === "integer") tsType = "number";
    return { kind: "primitive", content: tsType };
  }

  // 处理 $ref
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "");
    return expandSchemaToInterface(refName, spec, visited);
  }

  // 处理组合类型 allOf/oneOf/anyOf
  if (schema.allOf || schema.oneOf || schema.anyOf) {
    const compositionSchemas = schema.allOf || schema.oneOf || schema.anyOf;
    const expandedTypes = compositionSchemas.map((s: any) => {
      if (s.$ref) {
        const refName = s.$ref.replace("#/components/schemas/", "");
        return expandSchemaToInterface(refName, spec, new Set(visited));
      }
      // 内联 schema 展开
      return expandInlineSchema(s, spec, visited);
    });

    const operator = schema.allOf ? " & " : " | ";
    const content = expandedTypes.map(t => {
      if (t.kind === "object") return `{ ${t.content} }`;
      if (t.kind === "reference") return t.name;
      return t.content;
    }).join(operator);

    return { kind: "primitive", content };
  }

  // 展开对象属性
  const properties = schema.properties || {};
  const requiredFields = new Set(schema.required || []);

  const propsLines = Object.entries(properties).map(([propName, propValue]: [string, any]) => {
    const required = requiredFields.has(propName);
    const optional = required ? "" : "?";
    const description = propValue.description ? ` // ${propValue.description}` : "";

    // 处理数组类型
    if (propValue.type === "array" && propValue.items) {
      if (propValue.items.$ref) {
        const itemType = propValue.items.$ref.replace("#/components/schemas/", "");
        const expanded = expandSchemaToInterface(itemType, spec, new Set(visited));
        const itemContent = expanded.kind === "object" ? `{ ${expanded.content} }` : (expanded.kind === "reference" ? expanded.name : expanded.content);
        return `  ${propName}${optional}: ${itemContent}[];${description}`;
      }
      let itemType = propValue.items.type || "any";
      if (itemType === "integer") itemType = "number";
      return `  ${propName}${optional}: ${itemType}[];${description}`;
    }

    // 处理 $ref
    if (propValue.$ref) {
      const refType = propValue.$ref.replace("#/components/schemas/", "");
      const expanded = expandSchemaToInterface(refType, spec, new Set(visited));
      const typeContent = expanded.kind === "object" ? `{ ${expanded.content} }` : (expanded.kind === "reference" ? expanded.name : expanded.content);
      return `  ${propName}${optional}: ${typeContent};${description}`;
    }

    // 基础类型
    let tsType = propValue.type || "any";
    if (tsType === "integer") {
      tsType = "number";
    }
    return `  ${propName}${optional}: ${tsType};${description}`;
  });

  return { kind: "object", content: propsLines.join("\n") };
}

/**
 * 展开内联 Schema（不引用 components.schemas 的内联定义）
 */
function expandInlineSchema(
  schema: any,
  spec: SwaggerSpec,
  visited: Set<string>,
): ExpandedSchema {
  if (!schema) {
    return { kind: "primitive", content: "any" };
  }

  // 处理 $ref
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "");
    return expandSchemaToInterface(refName, spec, visited);
  }

  // 基础类型
  if (schema.type && !schema.properties && !schema.allOf && !schema.oneOf && !schema.anyOf) {
    let tsType = schema.type;
    if (tsType === "integer") tsType = "number";
    return { kind: "primitive", content: tsType };
  }

  // 处理组合类型
  if (schema.allOf || schema.oneOf || schema.anyOf) {
    const compositionSchemas = schema.allOf || schema.oneOf || schema.anyOf;
    const expandedTypes = compositionSchemas.map((s: any) => expandInlineSchema(s, spec, visited));
    const operator = schema.allOf ? " & " : " | ";
    const content = expandedTypes.map(t => {
      if (t.kind === "object") return `{ ${t.content} }`;
      if (t.kind === "reference") return t.name;
      return t.content;
    }).join(operator);
    return { kind: "primitive", content };
  }

  // 对象属性
  const properties = schema.properties || {};
  const requiredFields = new Set(schema.required || []);

  const propsLines = Object.entries(properties).map(([propName, propValue]: [string, any]) => {
    const required = requiredFields.has(propName);
    const optional = required ? "" : "?";
    const description = propValue.description ? ` // ${propValue.description}` : "";

    if (propValue.type === "array" && propValue.items) {
      if (propValue.items.$ref) {
        const itemType = propValue.items.$ref.replace("#/components/schemas/", "");
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
  });

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
      const expanded = expandSchemaToInterface(refName, spec);
      if (expanded.kind === "object") {
        results.push(`export interface T${name}Params {\n${expanded.content}\n}`);
      } else {
        results.push(`export type T${name}Params = ${expanded.kind === "reference" ? expanded.name : expanded.content};`);
      }
      results.push("");
    } else if (bodySchema.type === "array" && bodySchema.items?.$ref) {
      const itemRef = bodySchema.items.$ref.replace(
        "#/components/schemas/",
        "",
      );
      const expanded = expandSchemaToInterface(itemRef, spec);
      if (expanded.kind === "object") {
        results.push(`export interface T${name}Params {\n${expanded.content}\n}`);
      } else {
        const itemType = expanded.kind === "reference" ? expanded.name : expanded.content;
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
      const expanded = expandSchemaToInterface(refName, spec);
      if (expanded.kind === "object") {
        results.push(`export interface T${name}Response {\n${expanded.content}\n}`);
      } else {
        results.push(`export type T${name}Response = ${expanded.kind === "reference" ? expanded.name : expanded.content};`);
      }
    } else if (respSchema.type === "array" && respSchema.items?.$ref) {
      const itemRef = respSchema.items.$ref.replace(
        "#/components/schemas/",
        "",
      );
      const expanded = expandSchemaToInterface(itemRef, spec);
      if (expanded.kind === "object") {
        results.push(`export interface T${name}Response {\n${expanded.content}\n}`);
      } else {
        const itemType = expanded.kind === "reference" ? expanded.name : expanded.content;
        results.push(`export type T${name}Response = ${itemType}[];`);
      }
    } else if (respSchema.type) {
      results.push(`export type T${name}Response = ${respSchema.type};`);
    }
  }

  return results.join("\n") || `// 无需生成的类型`;
}

/**
 * 生成 TypeScript interface 定义（使用 openapi-typescript）
 * @param schemaName Schema 名称
 * @param spec Swagger 规范对象
 * @param projectKey 项目唯一标识
 * @returns TypeScript interface 代码
 */
export async function generateTypeScriptInterface(
  schemaName: string,
  spec: SwaggerSpec,
  projectKey: string = "default",
): Promise<string> {
  try {
    // 使用 openapi-typescript 生成全量类型
    const fullTypes = await generateFullTypeScript(spec, projectKey);
    if (fullTypes.startsWith("// Error")) {
      return fullTypes;
    }

    // 提取单个 Schema 类型
    return extractSchemaType(fullTypes, schemaName);
  } catch (e) {
    return `// Error generating TypeScript: ${e}`;
  }
}

/**
 * 批量生成多个 TypeScript interface
 * @param schemaNames Schema 名称数组
 * @param spec Swagger 规范对象
 * @param projectKey 项目唯一标识
 * @returns TypeScript 代码
 */
export async function generateTypeScriptInterfaces(
  schemaNames: string[],
  spec: SwaggerSpec,
  projectKey: string = "default",
): Promise<string> {
  // 使用 openapi-typescript 生成全量类型
  const fullTypes = await generateFullTypeScript(spec, projectKey);
  if (fullTypes.startsWith("// Error")) {
    return fullTypes;
  }

  // 提取需要的 Schema 类型
  const results: string[] = [];
  for (const name of schemaNames) {
    const code = extractSchemaType(fullTypes, name);
    if (!code.includes("not found")) {
      results.push(code);
      results.push("");
    }
  }

  return results.join("\n").trim();
}
