# 多步骤用户输入测试系统 - 快速开始

## 📋 概述

本测试系统用于验证复杂多步骤用户输入场景下的 SSE 事件流正确性，包含：
- **测试计划**: `plan-product-config-test` （10步骤，5次用户输入）
- **5个异步mock函数**: 模拟真实API调用延迟
- **预期SSE事件文档**: 27个预期事件的完整序列
- **实际事件记录模板**: 用于对比验证

---

## 🚀 快速启动

### 1. 启动服务

```bash
# 启动后端服务
cd web-server && npm run dev
# ✅ 函数已注册: [ProductConfig] Registered 5 test functions

# 启动前端服务
cd web-ui && npm run dev
# 访问: http://localhost:5174
```

### 2. 访问测试计划

1. 打开浏览器: http://localhost:5174/plans
2. 找到计划: **"产品定制配置流程"** (plan-product-config-test)
3. 点击进入计划详情页

### 3. 安装 SSE 监听器

在浏览器控制台（F12）中粘贴以下代码：

```javascript
window.sseEvents = [];
window.sseEventSource = null;

const OriginalEventSource = window.EventSource;

window.EventSource = function(url, config) {
  console.log('%c[SSE Monitor] 开始监听 SSE 连接', 'color: blue; font-weight: bold', url);
  window.sseEventSource = new OriginalEventSource(url, config);

  window.sseEventSource.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    const eventNumber = window.sseEvents.length + 1;

    window.sseEvents.push({
      序号: eventNumber,
      时间戳: new Date().toISOString(),
      事件类型: data.type,
      步骤ID: data.stepId || '-',
      原始数据: data
    });

    console.log(`%c[SSE Event #${eventNumber}] ${data.type}`, 'color: green; font-weight: bold', data);
  });

  window.sseEventSource.addEventListener('error', (error) => {
    console.error('%c[SSE Monitor] 连接错误', 'color: red; font-weight: bold', error);
  });

  return window.sseEventSource;
};

console.log('%c[SSE Monitor] SSE 监听器已安装！', 'color: green; font-weight: bold');
```

### 4. 执行测试

1. 点击 **"Execute Plan"** 按钮
2. 依次完成5个用户输入步骤（参考下方测试数据）
3. 观察控制台中的 SSE 事件日志
4. 等待执行完成（约15-30秒，取决于函数延迟）

### 5. 导出事件记录

执行完成后，在控制台运行：

```javascript
copy(JSON.stringify(window.sseEvents, null, 2))
```

然后将复制的内容粘贴到 `docs/test-scenarios/sse-event-recording-template.md`

---

## 📝 测试数据（标准测试用例）

### Step 1: 基本产品信息
```json
{
  "productCategory": "电子产品",
  "quantity": 5,
  "urgency": "normal"
}
```
**预期结果**: Step 2 显示基础价格 ¥2500 (500 * 5, 10%折扣)

---

### Step 3: 产品规格
```json
{
  "color": "黑色",
  "size": "M",
  "material": "金属",
  "warranty": true
}
```
**预期结果**: Step 4 显示 "规格组合有效"

---

### Step 5: 个性化定制
```json
{
  "customText": "生日快乐",
  "giftWrap": true,
  "giftCard": "祝你生日快乐！"
}
```
**预期结果**: Step 6 显示最终价格（含延保8% + 礼品包装¥20）

---

### Step 7: 配送信息
```json
{
  "recipientName": "张三",
  "phone": "13800138000",
  "address": "北京市朝阳区建国路88号",
  "deliveryTime": "工作日"
}
```
**预期结果**: Step 8 显示预计2天送达，运费¥20

---

### Step 9: 最终确认
```json
{
  "confirmed": true,
  "paymentMethod": "支付宝",
  "remarks": "请尽快发货"
}
```
**预期结果**: Step 10 生成订单号 ORD-YYYYMMDD-XXX

---

## 📊 预期执行流程

### 时间线（约15-30秒）

```
[0s] executionStart
[0s] inputRequested (Step 1) ← 用户填写基本信息
[5s] 用户提交 → inputReceived (Step 1)
[5s] stepComplete (Step 1)
[5s] calculateBasePrice 开始执行 (1-2秒延迟)
[6-7s] stepComplete (Step 2) + surfaceUpdate
[7s] inputRequested (Step 3) ← 用户选择规格
[10s] 用户提交 → inputReceived (Step 3)
[10s] stepComplete (Step 3)
[10s] validateSpecCombination 开始执行 (0.8-1.5秒延迟)
[11-12s] stepComplete (Step 4) + surfaceUpdate
[12s] inputRequested (Step 5) ← 用户定制
[15s] 用户提交 → inputReceived (Step 5)
[15s] stepComplete (Step 5)
[15s] calculateFinalPrice 开始执行 (0.5-1秒延迟)
[16s] stepComplete (Step 6) + surfaceUpdate
[16s] inputRequested (Step 7) ← 用户填写地址
[20s] 用户提交 → inputReceived (Step 7)
[20s] stepComplete (Step 7)
[20s] validateDeliveryAddress 开始执行 (1-2.5秒延迟)
[22-23s] stepComplete (Step 8) + surfaceUpdate
[23s] inputRequested (Step 9) ← 用户最终确认
[25s] 用户提交 → inputReceived (Step 9)
[25s] stepComplete (Step 9)
[25s] generateOrder 开始执行 (1.5-3秒延迟)
[27-28s] stepComplete (Step 10) + surfaceUpdate
[28s] executionComplete
```

**总计**: 27个 SSE 事件，5次用户交互，约15-30秒完成

---

## 🎯 验证要点

### 关键检查项

1. **事件顺序**:
   - ✅ executionStart 是第一个事件
   - ✅ 每个 inputRequested 后等待用户操作
   - ✅ inputReceived 后立即跟随 stepComplete
   - ✅ 函数调用步骤的 stepComplete 后有 surfaceUpdate
   - ✅ executionComplete 是最后一个事件

2. **异步延迟**:
   - ✅ 函数执行有明显的等待时间
   - ✅ 不同函数的耗时有差异
   - ✅ 用户能感知到函数正在执行

3. **数据完整性**:
   - ✅ inputRequested 包含完整的 schema
   - ✅ stepComplete 包含 success, stepId, result
   - ✅ surfaceUpdate 包含 components 数组
   - ✅ 引用字段（step.X.result.Y）正确解析

4. **UI 响应**:
   - ✅ 表单根据 schema 正确渲染
   - ✅ 提交后表单禁用
   - ✅ 结果卡片正确展示
   - ✅ 加载状态显示

---

## 📁 文档结构

```
docs/test-scenarios/
├── multi-input-product-config-test.md    # 预期SSE事件流文档（27个事件）
├── sse-event-recording-template.md       # 实际事件记录模板
└── quickstart.md                         # 本文档
```

---

## 🔧 Mock 函数说明

| 函数名 | 延迟时间 | 模拟场景 |
|--------|---------|---------|
| calculateBasePrice | 1-2秒 | 数据库价格查询 |
| validateSpecCombination | 0.8-1.5秒 | 规格验证和库存查询 |
| calculateFinalPrice | 0.5-1秒 | 价格计算和优惠券查询 |
| validateDeliveryAddress | 1-2.5秒 | 地址验证和物流查询 |
| generateOrder | 1.5-3秒 | 订单生成和数据库写入 |

---

## ❓ 常见问题

### Q: 为什么函数执行需要这么长时间？
A: 所有函数都添加了异步延迟，模拟真实API调用、数据库查询等场景的耗时。

### Q: 如何查看函数是否注册成功？
A: 查看 web-server 启动日志，应该看到：
```
[ProductConfig] Registered 5 test functions
```

### Q: 测试过程中可以中断吗？
A: 可以刷新页面或关闭连接，但建议完成整个流程以获得完整的事件记录。

### Q: 如何重复测试？
A: 刷新页面后重新安装 SSE 监听器，然后再次执行计划。

---

## 📮 反馈

测试完成后，请对比 `sse-event-recording-template.md` 中记录的实际事件与 `multi-input-product-config-test.md` 中的预期事件，记录所有差异和问题。
