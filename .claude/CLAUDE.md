### 接口文档MCP

1. **根据接口url获取文档全量数据** 拿到全量接口数据，供后续工具拆分，减少分析消耗
2. **搜索特定关键词相关接口（描述/title/url）** 根据关键词过滤接口，快速定位相关接口；需要将全量接口数据提取拆分，较少分析的内容量，比如只保留接口的描述、标题和url等关键信息
3. **根据接口url获取接口详情** 找到接口的特定信息后，获取ulr，去映射匹配全量接口数据，拿到接口的全量信息，供后续工具分析使用
4. **生成ts接口interface** 这里需要根据详情数据接口，通过开源工具类去生成ts接口interface，供后续工具使用；需要注意接口的参数类型、返回值类型等信息的准确性；
5. **生成interface请求和响应类型** 接口的名字使用url最后一段命名，规范：`T${Filed}Params`和`T${Filed}Response`；PascalCase命名

tip: 过程中复杂的swagger数据接口，获取转换成更加适合其他tools分析的接口数据结构，减少后续工具分析的复杂度和消耗

### 测试

1. **测试生成ts类型** 对 `mock.json` 执行脚本或者工具，生成ts接口interface，保存到 `mock.ts` 文件中，验证生成的接口类型是否正确，是否符合预期的接口结构和类型定义
2. **生成的目标对照** `mock_ts_target.json` 是预期生成的接口类型结构；生成的接口需要带上一些注释信息

---

## Swagger/OpenAPI 数据结构参考

### 请求体和响应体位置

在Swagger/OpenAPI JSON中，请求体和响应体的字段位置如下：

```
paths
  └── /xxx/xxx                           ← 接口路径
        └── [get/post/put/delete]        ← HTTP方法
              ├── requestBody            ← 请求体
              │     └── content
              │           └── application/json
              │                 └── schema
              │                       ├── type: "array"
              │                       │     └── items: { $ref: "#/components/schemas/xxx" }
              │                       └── $ref: "#/components/schemas/xxx"
              │
              ├── parameters             ← GET请求的query参数
              │
              └── responses
                    └── 200              ← 响应状态码
                          └── content
                                └── */*
                                      └── schema        ← 响应体
                                            ├── type: "array"
                                            │     └── items: { $ref: "#/components/schemas/xxx" }
                                            └── $ref: "#/components/schemas/xxx"

components
  └── schemas                            ← Schema定义存放位置
        └── {SchemaName}                 ← 具体数据结构
```

### 字段对照表

| 数据          | 在JSON中的路径                                                      |
| ------------- | ------------------------------------------------------------------- |
| 请求体        | `paths.{path}.{method}.requestBody.content.application/json.schema` |
| GET query参数 | `paths.{path}.{method}.parameters`                                  |
| 响应体        | `paths.{path}.{method}.responses.{statusCode}.content.*.schema`     |
| Schema定义    | `components.schemas.{SchemaName}`                                   |

### $ref 引用

- `#/components/schemas/xxx` 表示引用 `components.schemas` 下的 `xxx` Schema
- `$ref` 指向的是Schema名称，需要去 `components.schemas` 中查找具体定义
