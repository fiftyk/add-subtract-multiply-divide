# 多步骤用户输入测试场景 - 产品定制配置流程

## 测试目标

验证包含多次用户输入的复杂交互场景，确保 SSE 事件流的正确性和前端 UI 的响应准确性。

## 测试场景描述

**场景名称**: 产品定制配置流程
**场景 ID**: `plan-product-config-test`
**用户需求**: 配置一个定制产品，包括基本信息、规格选择、个性化定制、配送信息和最终确认。

## 执行步骤设计

### Step 1: 用户输入 - 基本产品信息
**类型**: `user_input`
**描述**: 收集产品类别和数量

**Schema 字段**:
- `productCategory` (select): 产品类别 [电子产品, 服装, 家具, 食品]
- `quantity` (number): 购买数量 (1-100)
- `urgency` (radio): 紧急程度 [normal, urgent, very_urgent]

**输出**: `step.1.result` = { productCategory, quantity, urgency }

---

### Step 2: 函数调用 - 计算基础价格
**类型**: `function_call`
**函数**: `calculateBasePrice`

**参数**:
```javascript
{
  category: "step.1.result.productCategory",
  quantity: "step.1.result.quantity"
}
```

**输出**: `step.2.result` = { basePrice: 1500, pricePerUnit: 500, discount: 0.1 }

---

### Step 3: 用户输入 - 规格选择
**类型**: `user_input`
**描述**: 根据产品类别选择具体规格

**Schema 字段**:
- `color` (select): 颜色 [红色, 蓝色, 黑色, 白色]
- `size` (select): 尺寸 [S, M, L, XL]
- `material` (select): 材质 [塑料, 金属, 木质, 布料]
- `warranty` (checkbox): 是否需要延保

**输出**: `step.3.result` = { color, size, material, warranty }

---

### Step 4: 函数调用 - 验证规格组合
**类型**: `function_call`
**函数**: `validateSpecCombination`

**参数**:
```javascript
{
  category: "step.1.result.productCategory",
  specs: {
    color: "step.3.result.color",
    size: "step.3.result.size",
    material: "step.3.result.material"
  }
}
```

**输出**: `step.4.result` = { valid: true, message: "规格组合有效", stockAvailable: true }

---

### Step 5: 用户输入 - 个性化定制
**类型**: `user_input`
**描述**: 添加个性化选项

**Schema 字段**:
- `customText` (text): 定制文字 (可选，最多20字符)
- `giftWrap` (checkbox): 是否需要礼品包装
- `giftCard` (textarea): 礼品卡留言 (可选，最多100字符)

**输出**: `step.5.result` = { customText, giftWrap, giftCard }

---

### Step 6: 函数调用 - 计算最终价格
**类型**: `function_call`
**函数**: `calculateFinalPrice`

**参数**:
```javascript
{
  basePrice: "step.2.result.basePrice",
  warranty: "step.3.result.warranty",
  giftWrap: "step.5.result.giftWrap",
  urgency: "step.1.result.urgency"
}
```

**输出**: `step.6.result` = { finalPrice: 1680, breakdown: {...}, savings: 120 }

---

### Step 7: 用户输入 - 配送信息
**类型**: `user_input`
**描述**: 填写配送地址和联系方式

**Schema 字段**:
- `recipientName` (text): 收件人姓名 (必填)
- `phone` (text): 联系电话 (必填，格式验证)
- `address` (textarea): 详细地址 (必填)
- `deliveryTime` (select): 配送时段 [工作日, 周末, 任意时间]

**输出**: `step.7.result` = { recipientName, phone, address, deliveryTime }

---

### Step 8: 函数调用 - 验证配送地址
**类型**: `function_call`
**函数**: `validateDeliveryAddress`

**参数**:
```javascript
{
  address: "step.7.result.address",
  phone: "step.7.result.phone"
}
```

**输出**: `step.8.result` = { valid: true, estimatedDays: 3, shippingFee: 20 }

---

### Step 9: 用户输入 - 最终确认
**类型**: `user_input`
**描述**: 确认订单信息

**Schema 字段**:
- `confirmed` (checkbox): 我已确认所有信息无误 (必填)
- `paymentMethod` (radio): 支付方式 [支付宝, 微信支付, 信用卡]
- `remarks` (textarea): 备注信息 (可选)

**输出**: `step.9.result` = { confirmed, paymentMethod, remarks }

---

### Step 10: 函数调用 - 生成订单
**类型**: `function_call`
**函数**: `generateOrder`

**参数**:
```javascript
{
  productInfo: {
    category: "step.1.result.productCategory",
    quantity: "step.1.result.quantity",
    specs: "step.3.result"
  },
  customization: "step.5.result",
  delivery: "step.7.result",
  payment: {
    finalPrice: "step.6.result.finalPrice",
    shippingFee: "step.8.result.shippingFee",
    method: "step.9.result.paymentMethod"
  }
}
```

**输出**: `step.10.result` = { orderId: "ORD-20260112-001", status: "confirmed", totalAmount: 1700 }

---

## 预期 SSE 事件流序列

### 阶段 1: 执行开始 + 第一次用户输入

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 1 | `executionStart` | - | `sessionId`, `timestamp` | 显示"执行开始"状态 |
| 2 | `inputRequested` | 1 | `stepId: 1`, `surfaceId: "form-{sessionId}"`, `schema` (包含 productCategory, quantity, urgency 字段) | 渲染表单：产品类别下拉框、数量输入框、紧急程度单选按钮 |

**用户操作**: 填写表单并提交（productCategory: "电子产品", quantity: 5, urgency: "normal"）

---

### 阶段 2: 收到输入 + 执行 Step 1-2

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 3 | `inputReceived` | 1 | `stepId: 1`, `status: "accepted"`, `timestamp` | 表单禁用，显示"已提交"状态 |
| 4 | `stepComplete` | 1 | `stepId: 1`, `stepType: "user_input"`, `success: true`, `result: { productCategory, quantity, urgency }` | 显示步骤 1 完成标记 |
| 5 | `stepComplete` | 2 | `stepId: 2`, `stepType: "function_call"`, `success: true`, `result: { basePrice: 2500, pricePerUnit: 500, discount: 0 }` | 显示步骤 2 完成标记 |
| 6 | `surfaceUpdate` | 2 | `surfaceId: "result-{sessionId}-2"`, `components: [Card]` (显示价格信息) | 渲染价格卡片：基础价格 ¥2500 |

---

### 阶段 3: 第二次用户输入

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 7 | `inputRequested` | 3 | `stepId: 3`, `surfaceId: "user-input-3"`, `schema` (color, size, material, warranty) | 渲染规格选择表单 |

**用户操作**: 选择规格（color: "黑色", size: "M", material: "金属", warranty: true）

---

### 阶段 4: 收到输入 + 执行 Step 3-4

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 8 | `inputReceived` | 3 | `stepId: 3`, `status: "accepted"` | 表单禁用 |
| 9 | `stepComplete` | 3 | `stepId: 3`, `success: true`, `result: { color, size, material, warranty }` | 显示步骤 3 完成 |
| 10 | `stepComplete` | 4 | `stepId: 4`, `success: true`, `result: { valid: true, message: "规格组合有效", stockAvailable: true }` | 显示步骤 4 完成 |
| 11 | `surfaceUpdate` | 4 | `components: [Card]` (验证结果) | 渲染验证卡片：✓ 规格组合有效 |

---

### 阶段 5: 第三次用户输入

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 12 | `inputRequested` | 5 | `stepId: 5`, `schema` (customText, giftWrap, giftCard) | 渲染个性化定制表单 |

**用户操作**: 填写定制信息（customText: "生日快乐", giftWrap: true, giftCard: "祝你生日快乐！"）

---

### 阶段 6: 收到输入 + 执行 Step 5-6

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 13 | `inputReceived` | 5 | `stepId: 5`, `status: "accepted"` | 表单禁用 |
| 14 | `stepComplete` | 5 | `stepId: 5`, `success: true`, `result: { customText, giftWrap, giftCard }` | 显示步骤 5 完成 |
| 15 | `stepComplete` | 6 | `stepId: 6`, `success: true`, `result: { finalPrice: 2720, breakdown: {...}, savings: 0 }` | 显示步骤 6 完成 |
| 16 | `surfaceUpdate` | 6 | `components: [Card]` (最终价格) | 渲染价格明细卡片 |

---

### 阶段 7: 第四次用户输入

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 17 | `inputRequested` | 7 | `stepId: 7`, `schema` (recipientName, phone, address, deliveryTime) | 渲染配送信息表单 |

**用户操作**: 填写配送信息（recipientName: "张三", phone: "13800138000", address: "北京市朝阳区...", deliveryTime: "工作日"）

---

### 阶段 8: 收到输入 + 执行 Step 7-8

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 18 | `inputReceived` | 7 | `stepId: 7`, `status: "accepted"` | 表单禁用 |
| 19 | `stepComplete` | 7 | `stepId: 7`, `success: true`, `result: { recipientName, phone, address, deliveryTime }` | 显示步骤 7 完成 |
| 20 | `stepComplete` | 8 | `stepId: 8`, `success: true`, `result: { valid: true, estimatedDays: 3, shippingFee: 20 }` | 显示步骤 8 完成 |
| 21 | `surfaceUpdate` | 8 | `components: [Card]` (配送信息) | 渲染配送卡片：预计 3 天送达，运费 ¥20 |

---

### 阶段 9: 第五次用户输入

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 22 | `inputRequested` | 9 | `stepId: 9`, `schema` (confirmed, paymentMethod, remarks) | 渲染最终确认表单 |

**用户操作**: 确认订单（confirmed: true, paymentMethod: "支付宝", remarks: "请尽快发货"）

---

### 阶段 10: 收到输入 + 执行 Step 9-10 + 完成

| 序号 | 事件类型 | 步骤 | 关键数据字段 | 前端响应 |
|------|---------|------|------------|----------|
| 23 | `inputReceived` | 9 | `stepId: 9`, `status: "accepted"` | 表单禁用 |
| 24 | `stepComplete` | 9 | `stepId: 9`, `success: true`, `result: { confirmed, paymentMethod, remarks }` | 显示步骤 9 完成 |
| 25 | `stepComplete` | 10 | `stepId: 10`, `success: true`, `result: { orderId, status: "confirmed", totalAmount: 2740 }` | 显示步骤 10 完成 |
| 26 | `surfaceUpdate` | 10 | `components: [Card]` (订单信息) | 渲染订单卡片：订单号 ORD-xxx，总金额 ¥2740 |
| 27 | `executionComplete` | - | `sessionId`, `success: true`, `result: { ... }` | 显示"执行完成"状态，所有步骤标记为完成 |

---

## 关键验证点

### 1. 事件顺序验证
- ✅ `executionStart` 必须是第一个事件
- ✅ 每个 `inputRequested` 必须在对应的 `inputReceived` 之前
- ✅ `inputReceived` 后立即跟随该步骤的 `stepComplete`
- ✅ 函数调用步骤的 `stepComplete` 后紧跟 `surfaceUpdate`（如果有结果展示）
- ✅ `executionComplete` 必须是最后一个事件

### 2. 数据完整性验证
- ✅ `inputRequested` 包含完整的 `schema` 定义
- ✅ `stepComplete` 包含 `success`、`stepId`、`stepType` 和 `result` 字段
- ✅ `surfaceUpdate` 包含 `surfaceId` 和 `components` 数组
- ✅ 引用字段（如 `step.1.result.productCategory`）能正确解析

### 3. 状态一致性验证
- ✅ 会话状态在等待输入时为 `waiting_input`
- ✅ 会话状态在执行过程中为 `executing`
- ✅ 会话状态在完成后为 `completed`
- ✅ `pendingInput` 字段在等待输入时正确设置

### 4. UI 响应验证
- ✅ 表单根据 `schema` 正确渲染所有字段类型
- ✅ 必填/可选字段标记正确
- ✅ 验证规则生效（长度、格式等）
- ✅ 提交后表单禁用，显示加载状态
- ✅ 结果卡片正确展示函数返回数据

---

## 测试数据准备

### 测试用例 1: 正常流程（5次完整输入）

**Step 1 输入**:
```json
{
  "productCategory": "电子产品",
  "quantity": 5,
  "urgency": "normal"
}
```

**Step 3 输入**:
```json
{
  "color": "黑色",
  "size": "M",
  "material": "金属",
  "warranty": true
}
```

**Step 5 输入**:
```json
{
  "customText": "生日快乐",
  "giftWrap": true,
  "giftCard": "祝你生日快乐！"
}
```

**Step 7 输入**:
```json
{
  "recipientName": "张三",
  "phone": "13800138000",
  "address": "北京市朝阳区xxx街道xxx号",
  "deliveryTime": "工作日"
}
```

**Step 9 输入**:
```json
{
  "confirmed": true,
  "paymentMethod": "支付宝",
  "remarks": "请尽快发货"
}
```

---

## 错误场景测试

### 场景 1: 规格验证失败（Step 4 失败）
- 输入不兼容的规格组合
- 预期 `stepComplete(step 4)` 中 `success: false`
- 应该收到错误提示，但继续执行后续步骤

### 场景 2: 地址验证失败（Step 8 失败）
- 输入无效的配送地址
- 预期 `stepComplete(step 8)` 中 `success: false`
- 应该提示用户重新输入（如果实现了重试逻辑）

### 场景 3: 中途取消
- 在任意用户输入步骤取消执行
- 会话状态应变为 `cancelled`
- 不应该继续触发后续事件

---

## 执行方式

### 1. 创建计划文件
```bash
# 将计划 JSON 保存到 .data/plans/plan-product-config-test.json
```

### 2. 通过 API 执行
```bash
# 启动 web-server
cd web-server && npm run dev

# 创建会话并执行
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"planId": "plan-product-config-test"}'

# 监听 SSE 流
curl -N http://localhost:3000/api/sessions/{sessionId}/stream
```

### 3. 通过浏览器执行
- 访问 http://localhost:5174/plans
- 选择 "产品定制配置流程" 计划
- 点击 "Execute Plan" 按钮
- **在浏览器控制台记录所有 SSE 事件**

---

## 实际 vs 预期对比模板

| 序号 | 预期事件类型 | 预期步骤 | 实际事件类型 | 实际步骤 | 差异 | 问题描述 |
|------|------------|---------|------------|---------|------|---------|
| 1 | executionStart | - | executionStart | - | ✅ | - |
| 2 | inputRequested | 1 | inputRequested | 1 | ✅ | - |
| ... | ... | ... | ... | ... | ... | ... |

**差异代码**:
- ✅ 完全匹配
- ⚠️ 字段缺失或多余
- ❌ 事件类型错误
- ⏭️ 事件缺失
- 🔄 事件顺序错误

---

## 预期执行时间

- **总步骤数**: 10 步（5 次用户输入，5 次函数调用）
- **预期事件数**: 27 个 SSE 事件
- **预期用户交互次数**: 5 次表单提交
- **预期总耗时**: 约 2-3 分钟（取决于用户填写速度）

---

## 成功标准

1. ✅ 所有 27 个预期事件按正确顺序触发
2. ✅ 每个事件包含所有必需的数据字段
3. ✅ 前端 UI 正确响应每个事件
4. ✅ 5 次用户输入全部成功提交并得到响应
5. ✅ 最终订单成功生成，显示正确的订单号和总金额
6. ✅ 会话状态正确转换（pending → executing → waiting_input → executing → ... → completed）
7. ✅ 无遗漏、重复或错误顺序的事件

---

## 后续扩展

- 添加更多字段类型测试（日期范围、文件上传等）
- 测试表单验证失败场景
- 测试网络中断恢复场景
- 测试多个会话并发执行
