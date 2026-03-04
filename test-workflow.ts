/**
 * 测试工作流 - complex_mock.json
 *
 * 测试流程：
 * 1. 准备一些接口路径（从 complex_mock.json 中选取）
 * 2. 测试工具对接口的存在性查找
 * 3. 测试工具对详情的结果展示
 * 4. 测试工具对接口的 TS 类型生成
 */

import { readFileSync } from "fs";
import {
  extractEndpoints,
  extractSchemas,
  generateTypeScriptByEndpoint,
  loadSwaggerFromFile,
  parseSwaggerSpec,
} from "./src/parser.js";

// 加载 complex_mock.json
const complexSpec = loadSwaggerFromFile("./complex_mock.json");

// ============================================
// 步骤 1: 准备测试接口路径
// ============================================

// 从 complex_mock.json 中选取不同类型的接口进行测试
const testCases = [
  {
    path: "/manage/supplierFee/update",
    method: "PUT",
    description: "修改供应商费用 - PUT 请求，有 requestBody",
  },
  {
    path: "/manage/supplierFee/list",
    method: "GET",
    description: "供应商费用列表 - GET 请求，有 query 参数",
  },
  {
    path: "/manage/supplierFee/query/supplierCarrierFee",
    method: "POST",
    description: "查询供应商对应船司下面的费用 - POST 请求，有 requestBody",
  },
  {
    path: "/manage/supplierFee/disable/feeMeasureUnit",
    method: "PUT",
    description: "禁用供应商费用 - PUT 请求",
  },
  {
    path: "/manage/supplierBillTemplate/update",
    method: "PUT",
    description: "修改供应商账单模板 - PUT 请求",
  },
  {
    path: "/manage/formFieldRule/cacheUnderMaintenance",
    method: "GET",
    description: "查询字段规则正在维护标识 - GET 请求",
  },
];

console.log("=".repeat(60));
console.log("步骤 1: 准备测试接口路径");
console.log("=".repeat(60));
console.log(`共准备 ${testCases.length} 个测试用例:\n`);
testCases.forEach((tc, i) => {
  console.log(`${i + 1}. [${tc.method}] ${tc.path}`);
  console.log(`   描述: ${tc.description}`);
});
console.log();

// ============================================
// 步骤 2: 测试工具对接口的存在性查找
// ============================================

console.log("=".repeat(60));
console.log("步骤 2: 测试工具对接口的存在性查找");
console.log("=".repeat(60));

const endpoints = extractEndpoints(complexSpec);
console.log(`\n总共找到 ${endpoints.length} 个接口\n`);

// 测试每个接口的存在性
testCases.forEach((tc) => {
  const found = endpoints.find(
    (ep) => ep.path === tc.path && ep.method === tc.method,
  );
  if (found) {
    console.log(`✓ 找到接口: [${tc.method}] ${tc.path}`);
  } else {
    console.log(`✗ 未找到接口: [${tc.method}] ${tc.path}`);
  }
});

// 测试关键词搜索
console.log("\n--- 测试关键词搜索 ---");
const keywordTests = [
  { keyword: "supplier", expected: "包含 supplier 的接口" },
  { keyword: "port", expected: "包含 port 的接口" },
  { keyword: "包装单位", expected: "包含 包装单位 的接口" },
  { keyword: "费用", expected: "包含 费用 的接口" },
];

keywordTests.forEach(({ keyword, expected }) => {
  const matched = endpoints.filter(
    (ep) =>
      ep.path.toLowerCase().includes(keyword.toLowerCase()) ||
      ep.summary?.toLowerCase().includes(keyword.toLowerCase()) ||
      ep.description?.toLowerCase().includes(keyword.toLowerCase()),
  );
  console.log(`搜索 "${keyword}": 找到 ${matched.length} 个接口 (${expected})`);
});

console.log();

// ============================================
// 步骤 3: 测试工具对详情的结果展示
// ============================================

console.log("=".repeat(60));
console.log("步骤 3: 测试工具对详情的结果展示");
console.log("=".repeat(60));

// 选取几个典型接口展示详情
const detailTestCases = [
  testCases[0], // PUT 请求
  testCases[2], // GET 请求
  testCases[4], // POST 请求
];

detailTestCases.forEach((tc) => {
  const endpoint = endpoints.find(
    (ep) => ep.path === tc.path && ep.method === tc.method,
  );

  if (endpoint) {
    console.log(`\n--- 接口详情: [${tc.method}] ${tc.path} ---`);
    console.log(`Summary: ${endpoint.summary || "(无)"}`);
    console.log(`Description: ${endpoint.description || "(无)"}`);
    console.log(`OperationId: ${endpoint.operationId || "(无)"}`);
    console.log(`Tags: ${endpoint.tags?.join(", ") || "(无)"}`);

    // 展示参数
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      console.log("\nParameters:");
      endpoint.parameters.forEach((param: any) => {
        console.log(
          `  - ${param.name} (${param.in}): ${param.type || param.schema?.type || "any"}${param.required ? " [required]" : ""}`,
        );
        if (param.description) {
          console.log(`    Description: ${param.description}`);
        }
      });
    }

    // 展示请求体
    if (endpoint.requestBody) {
      console.log("\nRequestBody:");
      console.log(`  Required: ${endpoint.requestBody.required}`);
      console.log(`  Content Types: ${endpoint.requestBody.content?.join(", ")}`);
    }

    // 展示响应
    if (endpoint.responses && endpoint.responses.length > 0) {
      console.log("\nResponses:");
      endpoint.responses.forEach((resp: any) => {
        console.log(`  - ${resp.status}: ${resp.description}`);
      });
    }
  } else {
    console.log(`\n--- 接口未找到: [${tc.method}] ${tc.path} ---`);
  }
});

console.log();

// ============================================
// 步骤 4: 测试工具对接口的 TS 类型生成
// ============================================

console.log("=".repeat(60));
console.log("步骤 4: 测试工具对接口的 TS 类型生成");
console.log("=".repeat(60));

// 对每个测试接口生成 TS 类型
testCases.forEach((tc) => {
  console.log(`\n--- 生成 TS 类型: [${tc.method}] ${tc.path} ---`);

  const tsCode = generateTypeScriptByEndpoint(tc.path, tc.method, complexSpec);
  console.log(tsCode);
});

console.log("\n" + "=".repeat(60));
console.log("测试工作流完成!");
console.log("=".repeat(60));
