# Mock 生成迭代机制问题分析

## 问题描述

用户执行命令：`npx fn-orchestrator plan "计算2的1/5次方" -i`

观察到的现象：
1. 第一轮生成了 `power` 函数并成功注册（函数从 8 个变成 9 个）
2. 第二轮迭代时，LLM 还是说缺少 `power` 函数
3. 尝试重新生成 `power` 函数，但代码验证失败
4. 最终计划仍然显示缺少 `power` 函数

## 根本原因分析

### 1. 第一轮生成的函数功能不完整

查看第一轮生成的 `power-1766556135956.js`：

```javascript
export const power = defineFunction({
  name: 'power',
  description: '计算任意实数的整数次幂',  // ❌ 只支持整数次幂
  parameters: [
    { name: 'base', type: 'number', description: '底数' },
    { name: 'exponent', type: 'number', description: '指数（整数）' }  // ❌ 限定为整数
  ],
  implementation: (base, exponent) => {
    if (!Number.isInteger(exponent)) {
      throw new Error('指数必须是整数');  // ❌ 拒绝分数指数
    }
    return Math.pow(base, exponent);
  }
});
```

**问题**：
- 用户需求是"计算2的1/5次方"，需要**分数指数**
- 第一轮生成的函数只支持**整数次幂**
- 代码中有显式检查，拒绝非整数指数

### 2. 迭代机制按预期工作

从日志看，迭代流程是正确的：

**第一轮**：
```
⚠️  计划不完整：缺少 1 个函数
📋 缺少的函数:
  1. power
     描述: 计算任意实数的整数次幂  ← LLM 理解错误，应该支持分数指数

✓ 已注册到 registry: power
📊 当前 registry 中共有 9 个函数
```

**第二轮**：
```
============================================================
🔄 第 2 轮迭代生成...
============================================================

⚠️  计划不完整：缺少 1 个函数
📋 缺少的函数:
  1. power
     描述: 计算任意实数的任意实数次幂，支持��数指数如2的1/5次方  ← LLM 纠正了理解

✗ 生成失败: power
   错误: Code validation failed: Failed to import generated code
   Unexpected token '}'
```

**分析**：
1. 第二轮 LLM 调用 `basePlanner.plan(userRequest)` 时，会获取 registry 中所有已注册函数
2. LLM 看到第一轮生成的 `power` 函数，描述是"计算任意实数的**整数次幂**"
3. LLM 对比用户需求"计算2的1/5次方"，发现现有 `power` 函数**不满足需求**
4. LLM 要求生成一个新的、支持分数指数的 `power` 函数
5. 第二次代码生成失败（语法错误），导致最终计划仍然不完整

### 3. 第二轮代码生成失败

第二轮生成的代码有语法错误（`Unexpected token '}'`），被代码验证机制拒绝并删除：

```
✗ 生成失败: power
   错误: Code validation failed: Failed to import generated code
   Unexpected token '}'
🗑️  已删除无效文件: /Users/liurongtao/fiftyk/add-subtract-multiply-divide-dev/functions/generated/power-1766556177890.js
```

## "第 2 轮迭代生成"是什么？

这是 `PlannerWithMockSupport` 装饰器的核心机制，位于 `src/mock/decorators/PlannerWithMockSupport.ts:33-130`。

### 工作流程

```
┌─────────────────────────────────────────────────┐
│ while (iteration < maxIterations)              │
│                                                 │
│  1. 调用 LLM 规划                               │
│  2. 如果计划完整 → 返回                         │
│  3. 如果缺少函数 → 生成 mock                    │
│  4. 注册 mock 到 registry                       │
│  5. continue（回到步骤 1）                      │
│                                                 │
│  直到：计划完整 OR mock 生成失败 OR 达到上限    │
└─────────────────────────────────────────────────┘
```

### 为什么需要迭代？

**场景 1**：依赖链问题
```
用户: "查询专利并统计数量"

第1轮: 缺少 queryPatent
      → 生成 queryPatent mock

第2轮: 缺少 count（统计数组长度）
      → 生成 count mock

第3轮: 计划完整 ✓
```

**场景 2**：函数理解迭代优化（本案例）
```
用户: "计算2的1/5次方"

第1轮: LLM 生成 power（整数次幂）
      → 功能不足，不满足需求

第2轮: LLM 发现需要分数指数支持
      → 尝试重新生成，但失败

第3轮: 如果达到，会再试一次
```

## 问题的本质

### 问题 1：LLM 第一次理解不完整

**原因**：
- LLM 在第一次规划时，可能简化了理解（"次方" → "整数次幂"）
- 没有充分考虑用户需求中的"1/5"是分数指数

**影响**：
- 生成的函数功能受限
- 需要第二轮迭代纠正

### 问题 2：重复生成同名函数

**当前行为**：
- 第一轮生成 `power-1766556135956.js`（整数次幂）
- 第二轮生成 `power-1766556177890.js`（分数指数，但失败了）
- 两个文件会导出同名的 `power` 函数

**潜在问题**：
- 如果第二轮成功，会有两个 `power` 函数文件
- 后加载的会覆盖先加载的
- 用户可能不知道哪个是最新的
- 第一个文件成为"僵尸文件"（存在但不被使用）

### 问题 3：第二轮代码生成质量下降

**可能原因**：
- 第二轮 prompt 更复杂（"支持分数指数"）
- LLM 生成的代码更长、更复杂
- 更容易出现语法错误

**证据**：
- 第一轮生成成功（简单的 Math.pow + 整数检查）
- 第二轮失败（可能尝试实现复杂的分数指数逻辑）

## 改进建议

### 方案 1：改进 Prompt，提高首次生成质量

**优点**：
- 从源头解决问题
- 减少迭代次数

**实施**：
```typescript
// 在 prompt 中强调分数指数支持
const enhancedPrompt = `
用户需求: ${userRequest}

注意：
- 如果需求涉及"次方"、"指数"、"幂运算"，请考虑分数指数的情况
- 使用 Math.pow() 可以天然支持分数指数
- 不要添加 Number.isInteger() 检查限制指数类型
`;
```

### 方案 2：检测同名函数，避免重复生成

**优点**：
- 避免"僵尸文件"
- 提升用户体验

**实施**：
```typescript
// 在 MockOrchestrator.generateAndRegisterMocks() 中
async generateAndRegisterMocks(missingFunctions: FunctionSpec[]) {
  for (const spec of missingFunctions) {
    // 检查是否已存在同名函数
    const existing = this.registry.get(spec.name);
    if (existing) {
      this.logger.warn(`函数 ${spec.name} 已存在，跳过生成`);
      this.logger.info(`  现有描述: ${existing.description}`);
      this.logger.info(`  需求描述: ${spec.description}`);

      // 如果需求描述明显不同，提示用户
      if (spec.description !== existing.description) {
        this.logger.warn(`  ⚠️  现有函数可能不满足需求，请手动检查`);
      }
      continue;
    }

    // ... 正常生成流程
  }
}
```

### 方案 3：允许函数"升级"

**优点**：
- 支持函数功能演进
- 自动清理旧版本

**实施**：
```typescript
// 检测到同名函数时
if (existing && spec.description !== existing.description) {
  this.logger.info(`检测到函数 ${spec.name} 需要升级`);
  this.logger.info(`  旧版本: ${existing.description}`);
  this.logger.info(`  新版本: ${spec.description}`);

  // 删除旧文件
  const oldFile = findGeneratedFile(spec.name);
  if (oldFile) {
    fs.unlinkSync(oldFile);
    this.logger.info(`  已删除旧文件: ${oldFile}`);
  }

  // 从 registry 移除旧函数
  this.registry.unregister(spec.name);

  // 生成新版本
  // ...
}
```

### 方案 4：改进代码生成的健壮性

**优点**：
- 降低第二轮生成失败率

**实施**：
```typescript
// 在 prompt 中提供更多约束
const codeGenerationPrompt = `
重要约束：
1. 只使用 JavaScript 标准库
2. 不使用复杂的算法实现（优先使用 Math.* 函数）
3. 保持代码简洁（< 20 行）
4. 分数指数：直接使用 Math.pow(base, exponent)，无需特殊处理
`;
```

## 结论

1. **迭代机制是合理的**：支持依赖链和理解优化
2. **第一轮理解不完整**是核心问题：LLM 误判为"整数次幂"
3. **同名函数重复生成**需要处理：避免僵尸文件和用户困惑
4. **第二轮代码质量**需要改进：可能因 prompt 复杂度上升

## 建议的优先级

| 优先级 | 方案 | 预期效果 |
|--------|------|----------|
| P0 | 方案 2：检测同名函数 | 立即避免重复生成和僵尸文件 |
| P1 | 方案 1：改进 Prompt | 提高首次生成质量，减少迭代 |
| P2 | 方案 4：改进代码生成健壮性 | 降低失败率 |
| P3 | 方案 3：函数升级机制 | 支持长期演进，但更复杂 |
