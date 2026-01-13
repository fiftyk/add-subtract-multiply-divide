# A2UI v0.8 数据交换流程

## 概述

本文档描述基于 A2UI v0.8 规范的执行计划期间数据交换预期流程。以专利研究计划为例，详细说明 Server ↔ Client 之间的消息格式和时序。

## A2UI v0.8 核心概念

### 消息类型

**Server → Client:**
| 消息类型 | 用途 |
|----------|------|
| `beginRendering` | 初始化渲染表面 |
| `surfaceUpdate` | 更新组件 |
| `dataModelUpdate` | 更新数据模型 |
| `deleteSurface` | 删除表面 |

**Client → Server:**
| 消息类型 | 用途 |
|----------|------|
| `userAction` | 用户操作事件 |
| `error` | 错误报告 |

### BoundValue 类型

```typescript
type BoundValue =
  | { literalString: string }
  | { literalNumber: number }
  | { literalBoolean: boolean }
  | { literalArray: unknown[] }
  | { path: string };  // 数据模型路径引用
```

### 组件结构

```typescript
interface A2UIComponent {
  id: string;           // 唯一标识
  weight?: number;      // 布局权重（Row/Column）
  component: {
    [ComponentType]: ComponentProps  // Exactly one component type
  };
}
```

---

## 执行流程时序图

```
┌──────────┐     ┌─────────────────┐     ┌──────────┐
│  Client  │     │  A2UIService    │     │ Executor │
└────┬─────┘     └────────┬────────┘     └────┬─────┘
     │                    │                    │
     │  1. 连接建立                               │
     │───────────────────▶│                    │
     │                    │                    │
     │                    │  2. beginRendering │
     │◀───────────────────│  (surfaceId, root) │
     │                    │                    │
     │                    │  3. surfaceUpdate  │
     │◀───────────────────│  (components)      │
     │                    │                    │
     │  4. 用户交互                              │
     │───────────────────▶│                    │
     │   userAction       │                    │
     │   (action.name,    │                    │
     │    context, etc.)  │                    │
     │                    │                    │
     │                    │  5. 解析输入        │
     │                    │  6. 继续执行        │
     │                    │                    │
     │                    │  7. dataModelUpdate│
     │◀───────────────────│  (新数据)          │
     │                    │                    │
     │                    │  8. deleteSurface  │
     │◀───────────────────│                    │
     │                    │                    │
```

---

## 专利研究计划 - 详细数据流

### Step 1: 用户输入 (关键词 + 查询数量)

#### 1.1 发送 UI 定义

```json
{
  "action": "beginRendering",
  "surfaceId": "step1-input",
  "root": "input-form"
}
```

```json
{
  "action": "surfaceUpdate",
  "surfaceId": "step1-input",
  "components": [
    {
      "id": "input-title",
      "component": {
        "Text": {
          "text": { "literalString": "请输入专利搜索参数" },
          "usageHint": { "literalString": "h3" }
        }
      }
    },
    {
      "id": "keyword-field",
      "component": {
        "TextField": {
          "label": { "literalString": "技术关键词" },
          "text": { "path": "/step1/input/keyword" },
          "textFieldType": { "literalString": "shortText" }
        }
      }
    },
    {
      "id": "rows-field",
      "component": {
        "TextField": {
          "label": { "literalString": "查询数量" },
          "text": { "path": "/step1/input/rows" },
          "textFieldType": { "literalString": "number" }
        }
      }
    },
    {
      "id": "input-form",
      "component": {
        "Column": {
          "distribution": { "literalString": "start" },
          "children": { "explicitList": ["input-title", "keyword-field", "rows-field"] }
        }
      }
    }
  ]
}
```

#### 1.2 请求用户输入

```json
{
  "action": "inputRequested",
  "surfaceId": "step1-input",
  "componentId": "keyword-field",
  "requestId": "req-001"
}
```

#### 1.3 用户提交操作

```json
{
  "action": "userAction",
  "name": "submit",
  "surfaceId": "step1-input",
  "sourceComponentId": "input-form",
  "timestamp": "2026-01-13T10:05:00.000Z",
  "context": {
    "keyword": "机器学习",
    "rows": "10"
  }
}
```

#### 1.4 执行器接收输入

```typescript
// Executor 解析 userAction.context
const values = {
  keyword: "机器学习",  // 从 context.keyword 获取
  rows: 10              // 从 context.rows 获取（类型转换）
};
```

---

### Step 2: 搜索专利 (函数调用)

#### 2.1 执行函数

```typescript
// Executor 内部
const params = {
  query: "机器学习",        // 解析 step.1.result.keyword
  rows: 10                  // 解析 step.1.result.rows
};

const result = await functionProvider.execute("mcp:patent-api:search_patents", params);
// result = { query_response: { docs: [...] } }
```

#### 2.2 发送结果 UI

```json
{
  "action": "beginRendering",
  "surfaceId": "step2-result",
  "root": "result-table"
}
```

```json
{
  "action": "surfaceUpdate",
  "surfaceId": "step2-result",
  "components": [
    {
      "id": "table-header",
      "component": {
        "Text": {
          "text": { "literalString": "搜索结果（共 10 个专利）" },
          "usageHint": { "literalString": "body" }
        }
      }
    },
    {
      "id": "result-table",
      "component": {
        "List": {
          "children": { "path": "/step2/result/query_response/docs" },
          "direction": { "literalString": "vertical" }
        }
      }
    }
  ]
}
```

#### 2.3 客户端渲染 (两种模式)

**模式 A: Client 渲染 (CLI/Web)**
- Client 收到 `children: { path: "/step2/result/query_response/docs" }`
- Client 请求数据：`dataModelUpdate` 消息

**模式 B: Server 预渲染 (Web SSE)**
- Server 预先解析路径，获取数据
- Server 发送已渲染的组件

---

### Step 3: 选择专利 (MultipleChoice)

#### 3.1 发送 UI 定义

```json
{
  "action": "surfaceUpdate",
  "surfaceId": "step3-select",
  "components": [
    {
      "id": "select-help",
      "component": {
        "Text": {
          "text": { "literalString": "从以下搜索结果中选择要查看详情的专利（最多5个）：" },
          "usageHint": { "literalString": "body" }
        }
      }
    },
    {
      "id": "patent-select",
      "component": {
        "MultipleChoice": {
          "label": { "literalString": "选择专利" },
          "selections": { "path": "/step3/input/patentIds" },
          "options": { "path": "/step2/result/query_response/docs" },
          "optionLabel": "PN_STR",
          "optionValue": "_id",
          "maxAllowedSelections": { "literalNumber": 5 }
        }
      }
    },
    {
      "id": "select-form",
      "component": {
        "Column": {
          "children": { "explicitList": ["select-help", "patent-select"] }
        }
      }
    }
  ]
}
```

#### 3.2 用户选择操作

```json
{
  "action": "userAction",
  "name": "select",
  "surfaceId": "step3-select",
  "sourceComponentId": "patent-select",
  "timestamp": "2026-01-13T10:06:00.000Z",
  "context": {
    "patentIds": ["CN123456A", "CN789012A", "CN345678A"]
  }
}
```

---

### Step 4: 获取专利详情 (函数调用 + 结果展示)

#### 4.1 执行函数

```typescript
const params = {
  patent_ids: ["CN123456A", "CN789012A", "CN345678A"]
};

const result = await functionProvider.execute("mcp:patent-api:get_patent_details", params);
// result = [{ title: "...", inventor: "...", ... }, ...]
```

#### 4.2 发送结果 UI

```json
{
  "action": "surfaceUpdate",
  "surfaceId": "step4-result",
  "components": [
    {
      "id": "details-title",
      "component": {
        "Text": {
          "text": { "literalString": "专利详情" },
          "usageHint": { "literalString": "h3" }
        }
      }
    },
    {
      "id": "details-list",
      "component": {
        "List": {
          "children": { "path": "/step4/result" }
        }
      }
    }
  ]
}
```

---

## 数据模型更新流程

### 场景：动态选项加载

当 MultipleChoice.options 使用 path 引用时：

```
1. Server 发送 UI 定义（options.path = "/step2/result/docs"）
2. Client 发现 path 引用，发起数据请求:
   {
     "action": "dataRequest",
     "surfaceId": "step3-select",
     "path": "/step2/result/docs"
   }
3. Server 返回数据:
   {
     "action": "dataModelUpdate",
     "surfaceId": "step3-select",
     "path": "/step2/result/docs",
     "valueArray": [
       { "_id": "1", "PN_STR": "CN123", "title": "..." },
       { "_id": "2", "PN_STR": "CN456", "title": "..." }
     ]
   }
4. Client 渲染选项列表
```

---

## 错误处理流程

```json
{
  "action": "error",
  "surfaceId": "step1-input",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "查询数量必须为正整数",
    "componentId": "rows-field"
  }
}
```

---

## 验证清单

### 组件渲染验证

- [ ] beginRendering 消息包含 surfaceId 和 root
- [ ] surfaceUpdate 消息包含扁平 components 数组
- [ ] 每个组件有唯一 id
- [ ] 组件类型包裹在 component 对象中

### BoundValue 验证

- [ ] 静态文本使用 `literalString`
- [ ] 数字使用 `literalNumber`
- [ ] 布尔值使用 `literalBoolean`
- [ ] 动态数据使用 `path`
- [ ] 数组使用 `literalArray` 或 path 引用

### 用户交互验证

- [ ] userAction 包含 name, surfaceId, sourceComponentId, timestamp
- [ ] context 包含解析后的键值对
- [ ] 输入值类型正确转换

### 数据路径验证

- [ ] path 格式正确（以 `/` 开头）
- [ ] path 引用存在于当前上下文
- [ ] 路径解析失败时有回退行为

---

## 实现要求对照

| 需求 | 实现位置 | 验证方式 |
|------|----------|----------|
| BoundValue 解析 | A2UIService, Renderers | 单元测试 |
| surfaceUpdate 消息 | A2UIRenderer | 集成测试 |
| userAction 处理 | Executor, CLIRenderer | E2E 测试 |
| path 解析 | ExecutionContext | 单元测试 |
| MultipleChoice 渲染 | CLIRenderer, WebRenderer | UI 测试 |
| Table/List 组件 | Renderers | 组件测试 |

---

## 附录：完整消息示例

### 完整 surfaceUpdate 消息

```json
{
  "action": "surfaceUpdate",
  "surfaceId": "step1-input",
  "components": [
    {
      "id": "title",
      "component": {
        "Text": {
          "text": { "literalString": "标题" },
          "usageHint": { "literalString": "h3" }
        }
      }
    },
    {
      "id": "form",
      "weight": 1,
      "component": {
        "Column": {
          "distribution": { "literalString": "start" },
          "children": { "explicitList": ["title"] }
        }
      }
    }
  ]
}
```

### 完整 userAction 消息

```json
{
  "action": "userAction",
  "name": "submit",
  "surfaceId": "step1-input",
  "sourceComponentId": "form",
  "timestamp": "2026-01-13T10:05:00.000Z",
  "context": {
    "keyword": "搜索词",
    "rows": "20"
  }
}
```
