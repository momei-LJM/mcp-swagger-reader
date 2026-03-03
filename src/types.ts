// @ts-nocheck
// 类型定义
export interface SwaggerProject {
  name: string;
  swaggerUrl: string;
  spec?: SwaggerSpec;
  cachedTypes?: string; // 缓存的 TypeScript 类型
}

export interface SwaggerSpec {
  swagger?: string;
  openapi?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  paths?: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
  };
  definitions?: Record<string, any>;
}

export interface Endpoint {
  path: string;
  method: string;
  summary: string;
  description: string;
  operationId: string;
  tags: string[];
  parameters: EndpointParam[];
  requestBody: RequestBody | null;
  responses: Response[];
}

export interface EndpointParam {
  name: string;
  in: string;
  required: boolean;
  description: string;
  type: string;
}

export interface RequestBody {
  description: string;
  required: boolean;
  content: string[];
}

export interface Response {
  status: string;
  description: string;
}

export interface Schema {
  name: string;
  type: string;
  description: string;
  properties: SchemaProperty[];
}

export interface SchemaProperty {
  name: string;
  type: string;
  description: string;
  format: string;
}
