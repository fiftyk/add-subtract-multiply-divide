# Web API 使用指南

本文档介绍如何使用 Web API 来规划和执行计划。

## 目录

- [快速开始](#快速开始)
- [API 端点](#api-端点)
- [认证](#认证)
- [使用示例](#使用示例)
- [错误处理](#错误处理)

## 快速开始

### 启动服务器

```bash
# 使用默认端口（3000）
RUN_MODE=web node dist/src/web/server.js

# 使用自定义端口
PORT=3002 RUN_MODE=web node dist/src/web/server.js

# 指定自定义函数目录
FUNCTIONS_DIR=./my-functions PORT=3002 RUN_MODE=web node dist/src/web/server.js
```

服务器启动后会显示：
```
Local functions loaded {"count":4,"functions":"add, divide, multiply, subtract"}
Web API server started {"port":3002}
API endpoints available {
  "plans": "http://localhost:3002/api/plans",
  "execute": "http://localhost:3002/api/execute",
  "functions": "http://localhost:3002/api/functions",
  "interactive": "http://localhost:3002/api/interactive",
  "websocket": "ws://localhost:3001"
}
```

### 验证服务器状态

```bash
curl http://localhost:3002/health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2026-01-04T05:00:00.000Z"
}
```

## API 端点

### Plans API

#### 1. 创建计划

**请求**
```http
POST /api/plans
Content-Type: application/json

{
  "request": "计算 (8 + 12) * 3",
  "options": {
    "enableAutoComplete": false,
    "maxRetries": 3
  }
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "id": "plan-37e99e36",
    "userRequest": "计算 (8 + 12) * 3",
    "steps": [
      {
        "stepId": 1,
        "type": "function_call",
        "functionName": "add",
        "description": "计算 8 + 12",
        "parameters": {
          "a": { "type": "literal", "value": 8 },
          "b": { "type": "literal", "value": 12 }
        }
      },
      {
        "stepId": 2,
        "type": "function_call",
        "functionName": "multiply",
        "description": "结果乘以 3",
        "parameters": {
          "a": { "type": "reference", "value": "step.1.result" },
          "b": { "type": "literal", "value": 3 }
        },
        "dependsOn": [1]
      }
    ],
    "createdAt": "2026-01-04T05:00:00.000Z",
    "status": "executable"
  }
}
```

#### 2. 获取所有计划

**请求**
```http
GET /api/plans
```

**响应**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan-37e99e36",
      "userRequest": "计算 (8 + 12) * 3",
      "status": "executable",
      "steps": [...],
      "createdAt": "2026-01-04T05:00:00.000Z"
    }
  ]
}
```

#### 3. 获取单个计划

**请求**
```http
GET /api/plans/:planId
```

**响应**
```json
{
  "success": true,
  "data": {
    "id": "plan-37e99e36",
    "userRequest": "计算 (8 + 12) * 3",
    "steps": [...],
    "status": "executable",
    "createdAt": "2026-01-04T05:00:00.000Z"
  }
}
```

#### 4. 删除计划

**请求**
```http
DELETE /api/plans/:planId
```

**响应**
```json
{
  "success": true,
  "message": "Plan deleted"
}
```

#### 5. 改进计划

**请求**
```http
POST /api/plans/:planId/refine
Content-Type: application/json

{
  "instruction": "添加结果四舍五入到整数"
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "plan": {...},
    "version": 2
  }
}
```

#### 6. 获取计划历史版本

**请求**
```http
GET /api/plans/:planId/history
```

**响应**
```json
{
  "success": true,
  "data": [
    {
      "version": 1,
      "plan": {...},
      "createdAt": "2026-01-04T05:00:00.000Z"
    },
    {
      "version": 2,
      "plan": {...},
      "createdAt": "2026-01-04T05:01:00.000Z"
    }
  ]
}
```

### Execute API

#### 1. 执行计划

**请求**
```http
POST /api/execute/:planId
```

**响应**
```json
{
  "success": true,
  "data": {
    "planId": "plan-37e99e36",
    "finalResult": 60,
    "steps": [
      {
        "stepId": 1,
        "type": "function_call",
        "functionName": "add",
        "parameters": { "a": 8, "b": 12 },
        "result": 20,
        "success": true,
        "executedAt": "2026-01-04T05:00:00.000Z"
      },
      {
        "stepId": 2,
        "type": "function_call",
        "functionName": "multiply",
        "parameters": { "a": 20, "b": 3 },
        "result": 60,
        "success": true,
        "executedAt": "2026-01-04T05:00:00.100Z"
      }
    ],
    "startedAt": "2026-01-04T05:00:00.000Z",
    "completedAt": "2026-01-04T05:00:00.200Z"
  }
}
```

#### 2. 获取执行结果

**请求**
```http
GET /api/execute/:execId
```

**响应**
```json
{
  "success": true,
  "data": {
    "planId": "plan-37e99e36",
    "finalResult": 60,
    "steps": [...],
    "success": true,
    "startedAt": "2026-01-04T05:00:00.000Z",
    "completedAt": "2026-01-04T05:00:00.200Z"
  }
}
```

#### 3. 列出所有执行记录

**请求**
```http
GET /api/execute
```

**响应**
```json
{
  "success": true,
  "data": [
    {
      "planId": "plan-37e99e36",
      "finalResult": 60,
      "success": true,
      "startedAt": "2026-01-04T05:00:00.000Z",
      "completedAt": "2026-01-04T05:00:00.200Z"
    }
  ]
}
```

### Functions API

#### 获取可用函数列表

**请求**
```http
GET /api/functions
```

**响应**
```json
{
  "success": true,
  "data": [
    {
      "id": "add",
      "name": "add",
      "description": "将两个数字相加",
      "scenario": "当需要计算两个数的和时使用",
      "parameters": [
        {
          "name": "a",
          "type": "number",
          "description": "第一个加数",
          "required": true
        },
        {
          "name": "b",
          "type": "number",
          "description": "第二个加数",
          "required": true
        }
      ],
      "returns": {
        "type": "number",
        "description": "两数之和"
      },
      "type": "local",
      "source": "local"
    }
  ]
}
```

### Interactive API

交互式会话 API 用于需要用户输入的场景。

#### 1. 创建会话

**请求**
```http
POST /api/interactive/sessions
Content-Type: application/json

{
  "request": "查询某公司的专利",
  "planId": "plan-xxx"  // 可选：直接使用已有计划
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "id": "session-abc123",
    "planId": "plan-xxx",
    "status": "pending",
    "steps": [...],
    "createdAt": "2026-01-04T05:00:00.000Z"
  }
}
```

#### 2. 确认执行

**请求**
```http
POST /api/interactive/sessions/:sessionId/confirm
Content-Type: application/json

{
  "confirmed": true
}
```

**响应**
```json
{
  "success": true,
  "message": "Execution started"
}
```

#### 3. 提交用户输入

**请求**
```http
POST /api/interactive/sessions/:sessionId/inputs/:stepId
Content-Type: application/json

{
  "companyName": "华为",
  "year": 2023
}
```

**响应**
```json
{
  "success": true,
  "message": "Input submitted"
}
```

#### 4. 获取待处理的输入请求

**请求**
```http
GET /api/interactive/sessions/:sessionId/inputs
```

**响应**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "session-abc123",
      "stepId": 1,
      "schema": {
        "version": "1.0",
        "fields": [
          {
            "id": "companyName",
            "type": "text",
            "label": "公司名称",
            "required": true
          }
        ]
      },
      "requestedAt": "2026-01-04T05:00:00.000Z"
    }
  ]
}
```

## 认证

### API 认证

目前 API 端点不需要认证。如需启用认证，可以通过环境变量配置：

```bash
API_AUTH_TOKEN=your-secret-token RUN_MODE=web node dist/src/web/server.js
```

### WebSocket 认证

WebSocket 连接支持 Token 认证：

```bash
# 启用 WebSocket 认证
WS_AUTH_TOKEN=your-websocket-token RUN_MODE=web node dist/src/web/server.js
```

连接方式：

**方式 1：URL 查询参数**
```javascript
const ws = new WebSocket('ws://localhost:3001?token=your-websocket-token');
```

**方式 2：消息认证**
```javascript
const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-websocket-token'
  }));
};
```

## 使用示例

### 完整的规划和执行流程

```bash
# 1. 创建计划
PLAN_ID=$(curl -s -X POST 'http://localhost:3002/api/plans' \
  -H 'Content-Type: application/json' \
  -d '{"request": "计算 (8 + 12) * 3"}' | jq -r '.data.id')

echo "Created plan: $PLAN_ID"

# 2. 查看计划详情
curl -s "http://localhost:3002/api/plans/$PLAN_ID" | jq '.data.steps'

# 3. 执行计划
RESULT=$(curl -s -X POST "http://localhost:3002/api/execute/$PLAN_ID" | jq '.data.finalResult')

echo "Execution result: $RESULT"

# 4. 查看函数列表
curl -s 'http://localhost:3002/api/functions' | jq '[.data[] | {name: .name, type: .source}]'
```

### 使用 JavaScript/TypeScript

```typescript
// 创建计划
async function createPlan(request: string) {
  const response = await fetch('http://localhost:3002/api/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request })
  });
  const data = await response.json();
  return data.data.id;
}

// 执行计划
async function executePlan(planId: string) {
  const response = await fetch(`http://localhost:3002/api/execute/${planId}`, {
    method: 'POST'
  });
  const data = await response.json();
  return data.data.finalResult;
}

// 使用示例
async function main() {
  const planId = await createPlan('计算 (8 + 12) * 3');
  console.log('Plan created:', planId);

  const result = await executePlan(planId);
  console.log('Result:', result); // 60
}
```

### 使用 Python

```python
import requests
import json

BASE_URL = 'http://localhost:3002'

# 创建计划
def create_plan(request: str) -> str:
    response = requests.post(
        f'{BASE_URL}/api/plans',
        headers={'Content-Type': 'application/json'},
        json={'request': request}
    )
    data = response.json()
    return data['data']['id']

# 执行计划
def execute_plan(plan_id: str):
    response = requests.post(f'{BASE_URL}/api/execute/{plan_id}')
    data = response.json()
    return data['data']['finalResult']

# 使用示例
if __name__ == '__main__':
    plan_id = create_plan('计算 (8 + 12) * 3')
    print(f'Plan created: {plan_id}')

    result = execute_plan(plan_id)
    print(f'Result: {result}')  # 60
```

## 错误处理

### 错误响应格式

所有错误响应都遵循统一格式：

```json
{
  "success": false,
  "error": "错误消息",
  "details": {}  // 可选：详细错误信息
}
```

### 常见错误

#### 1. 验证错误 (400)

```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "Request is required",
      "path": ["request"]
    }
  ]
}
```

#### 2. 资源未找到 (404)

```json
{
  "success": false,
  "error": "Plan not found"
}
```

#### 3. 执行失败 (200，但 success=false)

```json
{
  "success": false,
  "data": {
    "planId": "plan-xxx",
    "steps": [
      {
        "stepId": 1,
        "success": false,
        "error": "Function \"add\" execution failed: Function not found: add"
      }
    ]
  },
  "error": "步骤 1 执行失败: ..."
}
```

#### 4. 速率限制 (429)

```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

**限制说明**：
- 每个 IP 每 15 分钟最多 100 个请求
- 仅应用于 `/api/` 路由

#### 5. 服务器错误 (500)

```json
{
  "success": false,
  "error": "Internal server error"
}
```

## 环境变量配置

```bash
# 服务器配置
PORT=3002                          # API 服务器端口（默认：3000）
WS_PORT=3001                       # WebSocket 端口（默认：3001）
RUN_MODE=web                       # 运行模式（必需）

# 函数配置
FUNCTIONS_DIR=./dist/functions     # 本地函数目录（默认：./dist/functions）

# 认证配置
WS_AUTH_TOKEN=your-token           # WebSocket 认证 Token（可选）

# CORS 配置
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# 日志配置
LOG_LEVEL=info                     # 日志级别：debug, info, warn, error

# LLM 配置
ANTHROPIC_API_KEY=sk-ant-xxx       # Anthropic API Key
LLM_MODEL=claude-sonnet-4-20250514 # 使用的模型
```

## 调试

### 查看所有路由

```bash
curl http://localhost:3002/debug/routes
```

### 查看日志

服务器日志会输出到 stdout，包括：
- 函数加载信息
- 请求处理日志
- 错误信息

启用详细日志：
```bash
LOG_LEVEL=debug RUN_MODE=web node dist/src/web/server.js
```

## 最佳实践

1. **错误处理**：始终检查响应中的 `success` 字段
2. **速率限制**：注意 API 调用频率，避免触发速率限制
3. **超时设置**：执行复杂计划时设置合理的超时时间
4. **日志记录**：在生产环境使用 `LOG_LEVEL=warn` 或 `error`
5. **安全性**：生产环境启用认证和 HTTPS
6. **WebSocket**：长时间运行的任务建议使用 WebSocket 获取实时更新

## 故障排查

### 问题：函数未找到

**症状**：
```json
{
  "error": "Function \"add\" execution failed: Function not found: add"
}
```

**解决方案**：
1. 检查 `FUNCTIONS_DIR` 环境变量是否正确
2. 验证函数目录中有编译后的 `.js` 文件
3. 检查服务器启动日志中的 "Local functions loaded" 信息

### 问题：WebSocket 连接失败

**症状**：WebSocket 连接被拒绝

**解决方案**：
1. 检查 WebSocket 端口是否被占用
2. 如果启用了认证，确保提供正确的 Token
3. 查看服务器日志中的 WebSocket 错误信息

### 问题：CORS 错误

**症状**：浏览器控制台显示 CORS 错误

**解决方案**：
```bash
ALLOWED_ORIGINS=http://your-frontend-domain:port RUN_MODE=web node dist/src/web/server.js
```

## 更多信息

- [项目文档](../README.md)
- [CLI 使用指南](./quickstart.md)
- [配置说明](./configuration.md)
- [函数补全设计](./function-completion-design.md)
