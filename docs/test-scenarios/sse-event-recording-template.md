# SSE 事件实际记录 - 产品定制配置流程测试

**测试日期**: __________
**会话 ID**: __________
**测试人员**: __________

---

## 测试说明

1. 打开浏览器开发者工具的控制台（Console）
2. 在控制台中输入以下代码来监听和记录所有 SSE 事件：

```javascript
window.sseEvents = [];
window.sseEventSource = null;

// 保存原始 EventSource
const OriginalEventSource = window.EventSource;

// 拦截 EventSource
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
console.log('%c执行计划后，使用 copy(JSON.stringify(window.sseEvents, null, 2)) 复制所有事件记录', 'color: blue');
```

3. 访问计划详情页面并执行计划
4. 完成所有用户输入步骤
5. 执行完成后，在控制台运行：`copy(JSON.stringify(window.sseEvents, null, 2))`
6. 将复制的内容粘贴到"实际事件记录"部分

---

## 实际事件记录

**执行开始时间**: __________
**执行结束时间**: __________
**总事件数**: __________

### 事件列表（粘贴 JSON 数据）

```json
[
  // 在这里粘贴复制的事件数据
]
```

---

## 事件对比表

| 序号 | 预期事件类型 | 预期步骤 | 实际事件类型 | 实际步骤 | 耗时(ms) | 状态 | 备注 |
|------|------------|---------|------------|---------|----------|------|------|
| 1 | executionStart | - | | | | | |
| 2 | inputRequested | 1 | | | | | |
| - | **[用户操作]** | 填写基本信息并提交 | | | | | |
| 3 | inputReceived | 1 | | | | | |
| 4 | stepComplete | 1 | | | | | |
| 5 | stepComplete | 2 | | | | | |
| 6 | surfaceUpdate | 2 | | | | | |
| 7 | inputRequested | 3 | | | | | |
| - | **[用户操作]** | 选择规格并提交 | | | | | |
| 8 | inputReceived | 3 | | | | | |
| 9 | stepComplete | 3 | | | | | |
| 10 | stepComplete | 4 | | | | | |
| 11 | surfaceUpdate | 4 | | | | | |
| 12 | inputRequested | 5 | | | | | |
| - | **[用户操作]** | 填写定制信息并提交 | | | | | |
| 13 | inputReceived | 5 | | | | | |
| 14 | stepComplete | 5 | | | | | |
| 15 | stepComplete | 6 | | | | | |
| 16 | surfaceUpdate | 6 | | | | | |
| 17 | inputRequested | 7 | | | | | |
| - | **[用户操作]** | 填写配送信息并提交 | | | | | |
| 18 | inputReceived | 7 | | | | | |
| 19 | stepComplete | 7 | | | | | |
| 20 | stepComplete | 8 | | | | | |
| 21 | surfaceUpdate | 8 | | | | | |
| 22 | inputRequested | 9 | | | | | |
| - | **[用户操作]** | 最终确认并提交 | | | | | |
| 23 | inputReceived | 9 | | | | | |
| 24 | stepComplete | 9 | | | | | |
| 25 | stepComplete | 10 | | | | | |
| 26 | surfaceUpdate | 10 | | | | | |
| 27 | executionComplete | - | | | | | |

**状态说明**:
- ✅ 完全匹配
- ⚠️ 字段缺失或多余
- ❌ 事件类型错误
- ⏭️ 事件缺失
- 🔄 事件顺序错误

---

## 函数执行耗时记录

根据异步函数的延迟设置，记录实际执行时间：

| 步骤ID | 函数名 | 预期延迟 | 实际耗时 | 状态 |
|--------|--------|----------|----------|------|
| 2 | calculateBasePrice | 1-2秒 | | |
| 4 | validateSpecCombination | 0.8-1.5秒 | | |
| 6 | calculateFinalPrice | 0.5-1秒 | | |
| 8 | validateDeliveryAddress | 1-2.5秒 | | |
| 10 | generateOrder | 1.5-3秒 | | |

**总函数执行时间**: __________ 秒

---

## 用户输入步骤记录

记录每次用户输入的时间和内容：

### Step 1: 基本产品信息
- **开始时间**: __________
- **提交时间**: __________
- **输入内容**:
  ```json
  {
    "productCategory": "",
    "quantity": 0,
    "urgency": ""
  }
  ```

### Step 3: 产品规格
- **开始时间**: __________
- **提交时间**: __________
- **输入内容**:
  ```json
  {
    "color": "",
    "size": "",
    "material": "",
    "warranty": false
  }
  ```

### Step 5: 个性化定制
- **开始时间**: __________
- **提交时间**: __________
- **输入内容**:
  ```json
  {
    "customText": "",
    "giftWrap": false,
    "giftCard": ""
  }
  ```

### Step 7: 配送信息
- **开始时间**: __________
- **提交时间**: __________
- **输入内容**:
  ```json
  {
    "recipientName": "",
    "phone": "",
    "address": "",
    "deliveryTime": ""
  }
  ```

### Step 9: 最终确认
- **开始时间**: __________
- **提交时间**: __________
- **输入内容**:
  ```json
  {
    "confirmed": false,
    "paymentMethod": "",
    "remarks": ""
  }
  ```

---

## UI 响应检查清单

### 表单渲染
- [ ] Step 1: 产品类别下拉框正确显示4个选项
- [ ] Step 1: 数量输入框限制在1-100
- [ ] Step 1: 紧急程度单选按钮显示3个选项
- [ ] Step 3: 所有下拉框（颜色、尺寸、材质）正确渲染
- [ ] Step 3: 延保复选框正确显示
- [ ] Step 5: 定制文字输入框有20字符限制
- [ ] Step 5: 礼品卡文本域有100字符限制
- [ ] Step 7: 电话号码有格式验证
- [ ] Step 7: 地址文本域显示3行
- [ ] Step 9: 确认复选框为必填项

### 数据展示
- [ ] Step 2 结果: 价格卡片显示基础价格、单价、折扣
- [ ] Step 4 结果: 验证卡片显示规格组合状态
- [ ] Step 6 结果: 最终价格卡片显示明细
- [ ] Step 8 结果: 配送信息卡片显示预计天数和运费
- [ ] Step 10 结果: 订单卡片显示订单号和总金额

### 状态更新
- [ ] 每次提交后表单立即禁用
- [ ] 显示"已提交"或加载状态
- [ ] 函数执行期间有加载指示器
- [ ] 步骤完成后显示完成标记
- [ ] 所有步骤按顺序依次完成

### 异步延迟体现
- [ ] 函数调用明显需要等待时间（不是瞬间完成）
- [ ] 用户能感知到函数正在执行
- [ ] 加载状态在函数执行期间持续显示
- [ ] 不同函数的执行时间有差异

---

## 发现的问题

### 问题 1
- **问题描述**:
- **预期行为**:
- **实际行为**:
- **影响范围**:
- **复现步骤**:

### 问题 2
- **问题描述**:
- **预期行为**:
- **实际行为**:
- **影响范围**:
- **复现步骤**:

---

## 测试结论

### 成功指标
- [ ] 所有27个预期事件按正确顺序触发
- [ ] 每个事件包含所有必需的数据字段
- [ ] 前端UI正确响应每个事件
- [ ] 5次用户输入全部成功提交并得到响应
- [ ] 最终订单成功生成
- [ ] 会话状态正确转换
- [ ] 无遗漏、重复或错误顺序的事件
- [ ] 函数执行延迟符合预期范围

### 总体评价
- **测试结果**: [通过 / 部分通过 / 失败]
- **匹配度**: _____% (实际事件数 / 预期事件数)
- **关键问题数**: _____
- **次要问题数**: _____

### 后续行动
1.
2.
3.

---

## 附加信息

### 浏览器信息
- **浏览器**:
- **版本**:
- **操作系统**:

### 网络信息
- **前端地址**: http://localhost:5174
- **后端地址**: http://localhost:3000
- **SSE 连接状态**:

### 其他备注
