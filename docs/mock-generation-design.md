# Mock 函数自动生成功能 - SOLID 设计方案

## 功能概述

当 Planner 识别到缺失函数时，自动让 LLM 生成 **mock 实现代码**，保存为真实的 TypeScript 文件，并自动注册到 registry，使流程能够立即跑通（返回模拟数据），供开发者后续完善实现。

## 核心需求

1. **自动生成 mock 代码** - LLM 生成能跑通的 TypeScript 实现
2. **保存真实文件** - 生成到 `functions/generated/` 目录
3. **自动注册** - 动态加载并注册到 FunctionRegistry
4. **标记 MOCK 状态** - 执行时清楚显示这是模拟数据
5. **供开发者完善** - 生成的代码可编辑和改进（"悬赏模式"）

## SOLID 设计原则

### 1. Single Responsibility Principle (SRP) - 单一职责
每个类只负责一件事：
- `IMockCodeGenerator` - 仅生成代码
- `IMockFileWriter` - 仅写入文件
- `IMockFunctionLoader` - 仅加载和注册函数
- `IMockMetadataProvider` - 仅管理 mock 元数据
- `MockOrchestrator` - 协调整个工作流

### 2. Open/Closed Principle (OCP) - 开闭原则
**对扩展开放，对修改关闭**：
- ❌ 不修改现有 Planner、Executor、Registry 核心逻辑
- ✅ 使用 **Decorator Pattern** 扩展 Planner
- ✅ 通过依赖注入集成新功能

### 3. Liskov Substitution Principle (LSP) - 里氏替换
**Mock 函数完全替代真实函数**：
- Mock 函数使用相同的 `FunctionDefinition` 类型
- 只在 metadata 中标记 `isMock: true`
- Executor 无需知道函数是否为 mock

### 4. Interface Segregation Principle (ISP) - 接口隔离
**小而专注的接口**：
- 5 个独立接口，每个 1-3 个方法
- 客户端只依赖它们需要的接口

### 5. Dependency Inversion Principle (DIP) - 依赖倒置
**依赖抽象而非具体实现**：
- 所有类依赖接口，通过构造函数注入
- MockOrchestrator 依赖 4 个抽象接口
- 可轻松替换实现（测试/生产）

## 架构设计

### 模块结构

```
src/
├── mock/                    # 新增：Mock 功能模块
│   ├── interfaces/          # 接口定义（ISP + DIP）
│   │   ├── IMockCodeGenerator.ts
│   │   ├── IMockFileWriter.ts
│   │   ├── IMockFunctionLoader.ts
│   │   ├── IMockMetadataProvider.ts
│   │   ├── IMockOrchestrator.ts
│   │   └── ILLMClient.ts
│   ├── implementations/     # 具体实现（SRP）
│   │   ├── LLMMockCodeGenerator.ts
│   │   ├── FileSystemMockFileWriter.ts
│   │   ├── DynamicMockFunctionLoader.ts
│   │   ├── InMemoryMockMetadataProvider.ts
│   │   └── MockOrchestrator.ts
│   ├── adapters/            # 适配器
│   │   └── AnthropicLLMClient.ts
│   ├── decorators/          # 装饰器（OCP）
│   │   └── PlannerWithMockSupport.ts
│   ├── factory/
│   │   └── MockServiceFactory.ts
│   ├── types.ts             # 类型定义
│   ├── prompts.ts           # LLM prompts
│   └── index.ts
├── cli/
│   └── commands/
│       └── plan.ts          # 修改：注入 PlannerWithMockSupport
└── registry/
    └── registry.ts          # 不修改

functions/
└── generated/               # 新增：自动生成的 mock 函数
    └── .gitkeep
```

### 类关系图

```
┌─────────────────────────────────┐
│   PlannerWithMockSupport        │  (Decorator - OCP)
│   装饰现有 Planner                 │
├─────────────────────────────────┤
│ - basePlanner: Planner          │  ← 组合，不修改
│ - mockOrchestrator: IMockOrch.. │
├─────────────────────────────────┤
│ + plan(userRequest)             │  ← 扩展功能
└──────────┬──────────────────────┘
           │ 委托给
           ▼
    ┌──────────────┐
    │   Planner    │  (不修改)
    └──────────────┘

┌─────────────────────────────────┐
│     MockOrchestrator            │  (Facade - 协调者)
├─────────────────────────────────┤
│ - codeGenerator: IMockCodeGen.. │  ← 依赖抽象 (DIP)
│ - fileWriter: IMockFileWriter   │
│ - functionLoader: IMockFunc...  │
│ - metadataProvider: IMockMeta.. │
├─────────────────────────────────┤
│ + generateAndRegisterMocks()    │
└──┬────────┬────────┬────────┬──┘
   │        │        │        │
   ▼        ▼        ▼        ▼
┌────┐  ┌────┐  ┌────┐  ┌────┐
│ IG │  │ IW │  │ IL │  │ IM │  (接口 - ISP)
└────┘  └────┘  └────┘  └────┘
   │        │        │        │
   ▼        ▼        ▼        ▼
┌────┐  ┌────┐  ┌────┐  ┌────┐
│ LG │  │ FW │  │ DL │  │ MP │  (实现 - SRP)
└────┘  └────┘  └────┘  └────┘
```

### 执行流程

```
用户: "查找专利CN121174231A的发明人"
    ↓
CLI: planCommand()
    ↓
PlannerWithMockSupport.plan()
    │
    ├─→ 1. basePlanner.plan(request)
    │      └─→ 识别缺失: queryPatent, extractInventor
    │
    ├─→ 2. mockOrchestrator.generateAndRegisterMocks()
    │      ├─→ codeGenerator.generate(spec)        [LLM 生成代码]
    │      ├─→ fileWriter.write(code, filename)    [保存文件]
    │      ├─→ functionLoader.load(filepath)       [动态加载]
    │      └─→ metadataProvider.markAsMock()       [标记状态]
    │
    └─→ 3. basePlanner.plan(request)  [重新规划，现在函数可用]
           └─→ 返回可执行计划（标记 usesMocks: true）
```

## 核心接口定义

### 1. IMockCodeGenerator
```typescript
interface IMockCodeGenerator {
  generate(spec: MockFunctionSpec): Promise<string>;
}
```

### 2. IMockFileWriter
```typescript
interface IMockFileWriter {
  write(code: string, fileName: string): Promise<string>;
  ensureDirectory(path: string): Promise<void>;
}
```

### 3. IMockFunctionLoader
```typescript
interface IMockFunctionLoader {
  load(filePath: string): Promise<FunctionDefinition[]>;
  register(registry: FunctionRegistry, functions: FunctionDefinition[]): void;
}
```

### 4. IMockMetadataProvider
```typescript
interface IMockMetadataProvider {
  markAsMock(functionName: string, metadata: MockMetadata): void;
  isMock(functionName: string): boolean;
  getMetadata(functionName: string): MockMetadata | undefined;
}
```

### 5. IMockOrchestrator (Facade)
```typescript
interface IMockOrchestrator {
  generateAndRegisterMocks(
    missingFunctions: MissingFunction[]
  ): Promise<MockGenerationResult>;
}
```

## 数据类型

```typescript
interface MockFunctionSpec {
  name: string;
  description: string;
  parameters: Array<{name: string; type: string; description: string}>;
  returns: {type: string; description: string};
}

interface MockMetadata {
  functionName: string;
  filePath: string;
  generatedAt: string;
  isMock: true;
}

interface MockGenerationResult {
  success: boolean;
  generatedFunctions: MockMetadata[];
  errors?: Array<{functionName: string; error: string}>;
}

// 扩展现有类型
interface ExecutionPlan {
  // ... 现有字段
  metadata?: {
    usesMocks?: boolean;
    mockFunctions?: string[];
  };
}
```

## 关键实现要点

### 1. LLMMockCodeGenerator - 代码生成器

```typescript
export class LLMMockCodeGenerator implements IMockCodeGenerator {
  constructor(private llmClient: ILLMClient) {}

  async generate(spec: MockFunctionSpec): Promise<string> {
    const prompt = this.buildPrompt(spec);
    const rawCode = await this.llmClient.generateCode(prompt);
    return this.formatCode(rawCode, spec);
  }

  private formatCode(code: string, spec: MockFunctionSpec): string {
    // 格式化并添加 mock 标记注释
    return `
// 🤖 AUTO-GENERATED MOCK FUNCTION
// TODO: Replace with real implementation
// Generated at: ${new Date().toISOString()}

${code}
    `.trim();
  }
}
```

### 2. MockOrchestrator - 协调器

```typescript
export class MockOrchestrator implements IMockOrchestrator {
  constructor(
    private codeGenerator: IMockCodeGenerator,
    private fileWriter: IMockFileWriter,
    private functionLoader: IMockFunctionLoader,
    private metadataProvider: IMockMetadataProvider
  ) {}

  async generateAndRegisterMocks(
    missingFunctions: MissingFunction[]
  ): Promise<MockGenerationResult> {
    const results: MockMetadata[] = [];

    for (const missing of missingFunctions) {
      // 1. 生成代码
      const code = await this.codeGenerator.generate({...missing});

      // 2. 写入文件
      const filePath = await this.fileWriter.write(
        code,
        `${missing.name}-${Date.now()}.ts`
      );

      // 3. 动态加载
      const functions = await this.functionLoader.load(filePath);

      // 4. 注册并标记
      this.functionLoader.register(registry, functions);
      const metadata = {...};
      this.metadataProvider.markAsMock(missing.name, metadata);
      results.push(metadata);
    }

    return {success: true, generatedFunctions: results};
  }
}
```

### 3. PlannerWithMockSupport - 装饰器

```typescript
export class PlannerWithMockSupport {
  constructor(
    private basePlanner: Planner,
    private mockOrchestrator: IMockOrchestrator,
    private registry: FunctionRegistry
  ) {}

  async plan(userRequest: string): Promise<PlanResult> {
    // 1. 尝试原始规划
    let result = await this.basePlanner.plan(userRequest);

    // 2. 如果有缺失函数，生成 mock
    if (result.plan?.status === 'incomplete' &&
        result.plan.missingFunctions?.length) {

      console.log('🔧 Generating mock implementations...');

      const mockResult = await this.mockOrchestrator.generateAndRegisterMocks(
        result.plan.missingFunctions
      );

      if (mockResult.success) {
        console.log(`✅ Generated ${mockResult.generatedFunctions.length} mocks`);

        // 3. 重新规划（现在函数可用了）
        result = await this.basePlanner.plan(userRequest);

        // 4. 标记使用了 mock
        if (result.plan) {
          result.plan.metadata = {
            usesMocks: true,
            mockFunctions: mockResult.generatedFunctions.map(m => m.functionName)
          };
        }
      }
    }

    return result;
  }
}
```

### 4. CLI 集成 - 最小化修改

```typescript
// src/cli/commands/plan.ts
export async function planCommand(request: string, options: PlanOptions) {
  // ... 现有设置 ...

  const registry = new FunctionRegistry();
  await loadFunctions(registry, options.functions);

  // 🆕 创建 mock 服务（使用工厂模式）
  const mockOrchestrator = MockServiceFactory.create({
    llmClient: new AnthropicLLMClient(apiKey, baseURL),
    outputDir: path.join(process.cwd(), 'functions/generated'),
    registry
  });

  // 🆕 使用装饰器包装 Planner（OCP - 不修改 Planner）
  const basePlanner = new Planner(registry, apiKey);
  const planner = new PlannerWithMockSupport(
    basePlanner,
    mockOrchestrator,
    registry
  );

  // 其余代码不变
  const result = await planner.plan(request);
  // ...
}
```

## 实现步骤（TDD 方式）

### Phase 1: 接口定义（无风险）
1. 创建 `/src/mock/interfaces/` 目录
2. 定义所有接口（IMockCodeGenerator, IMockFileWriter, etc.）
3. 定义类型（`types.ts`）
4. **测试**: 类型检查通过

### Phase 2: 核心实现（隔离测试）
5. **先写测试**: `src/mock/__tests__/LLMMockCodeGenerator.test.ts`
6. **实现**: `LLMMockCodeGenerator.ts`
7. **先写测试**: `src/mock/__tests__/MockOrchestrator.test.ts`
8. **实现**: `MockOrchestrator.ts`
9. **实现**: `FileSystemMockFileWriter.ts`, `DynamicMockFunctionLoader.ts`
10. **测试**: 所有单元测试通过

### Phase 3: 装饰器（低风险）
11. **先写测试**: `src/mock/__tests__/PlannerWithMockSupport.test.ts`
12. **实现**: `PlannerWithMockSupport.ts`
13. **测试**: 装饰器测试通过

### Phase 4: CLI 集成（可控）
14. **实现**: `MockServiceFactory.ts`
15. **修改**: `src/cli/commands/plan.ts`（注入装饰器）
16. **测试**: 手动端到端测试

### Phase 5: 完善与文档
17. 添加 prompts（`src/mock/prompts.ts`）
18. 更新 README 文档
19. 添加端到端测试
20. 生成的 mock 文件加入 `.gitignore`

## 示例输出

### 用户体验

```bash
$ npx fn-orchestrator plan "查找专利CN121174231A的发明人"

📝 正在分析需求...
⚠️ 识别到 2 个缺失的函数

🔧 正在生成 mock 实现...
  ├─ queryPatent... ✅
  └─ extractInventor... ✅

✅ 已生成 2 个 mock 函数
📁 保存位置: functions/generated/

📋 执行计划 #plan-abc123:
用户需求: 查找专利CN121174231A的发明人
状态: ✅ 可执行 (⚠️ 使用了 MOCK 数据)

步骤:
  Step 1: queryPatent(patentNumber="CN121174231A") 🤖 MOCK
    → 查询专利信息
  Step 2: extractInventor(patentData=${step.1.result}) 🤖 MOCK
    → 提取发明人

⚠️ 注意: 此计划使用了模拟数据，结果仅供测试
💡 提示: 编辑 functions/generated/ 中的文件来实现真实逻辑

执行命令: npx fn-orchestrator execute plan-abc123
```

### 生成的代码示例

```typescript
// functions/generated/queryPatent-1234567890.ts

// 🤖 AUTO-GENERATED MOCK FUNCTION
// TODO: Replace with real patent API implementation
// Generated at: 2024-01-15T10:30:00.000Z

import { defineFunction } from '../../src/registry/index.js';

export const queryPatent = defineFunction({
  name: 'queryPatent',
  description: '查询专利详细信息',
  scenario: '通过专利号查询专利的详细信息',
  parameters: [
    { name: 'patentNumber', type: 'string', description: '专利号' }
  ],
  returns: { type: 'object', description: '专利详细信息对象' },
  implementation: (patentNumber: string) => {
    // ⚠️ MOCK IMPLEMENTATION - 返回模拟数据
    // TODO: 调用真实的专利查询 API
    return {
      patentNumber,
      title: '一种基于人工智能的数据处理方法',
      inventors: ['张三', '李四', '王五'],
      applicant: 'XX科技有限公司',
      applicationDate: '2023-01-15',
      publicationDate: '2024-01-15',
      status: 'granted',
      abstract: '本发明涉及...',
      // ⚠️ 以上均为模拟数据，请替换为真实实现
    };
  },
  metadata: {
    isMock: true,
    generatedAt: '2024-01-15T10:30:00.000Z',
    sourceFile: 'functions/generated/queryPatent-1234567890.ts'
  }
});
```

## 测试策略

### 单元测试（每个类独立测试）

```typescript
describe('LLMMockCodeGenerator', () => {
  it('should generate valid TypeScript code', async () => {
    const mockLLM: ILLMClient = {
      generateCode: vi.fn().mockResolvedValue('export const add = ...')
    };
    const generator = new LLMMockCodeGenerator(mockLLM);

    const code = await generator.generate(mockSpec);

    expect(code).toContain('export const');
    expect(code).toContain('defineFunction');
    expect(code).toContain('🤖 AUTO-GENERATED');
  });
});

describe('MockOrchestrator', () => {
  it('should orchestrate full workflow', async () => {
    // 使用 mock 依赖测试协调逻辑
  });
});
```

### 集成测试

```typescript
describe('PlannerWithMockSupport Integration', () => {
  it('should generate and use mocks when functions missing', async () => {
    // 端到端测试完整流程
  });
});
```

## 优势总结

### SOLID 合规性
✅ **SRP**: 每个类单一职责，易测试易维护
✅ **OCP**: 装饰器模式，零修改扩展功能
✅ **LSP**: Mock 函数完全兼容真实函数
✅ **ISP**: 5 个小接口，客户端按需依赖
✅ **DIP**: 依赖抽象，可轻松替换实现

### 可测试性
- 每个模块独立测试（单元测试）
- 依赖注入支持 mock
- TDD 友好

### 可扩展性
- 可轻松替换代码生成策略（LLM → 模板）
- 可替换存储方式（本地 → S3）
- 可替换 LLM 提供商（Anthropic → OpenAI）

### 安全性
- 生成的代码在隔离目录
- 清晰标记 MOCK 状态
- 用户完全控制生成的文件

## 关键文件清单

### 新增文件（按实现顺序）

1. **接口定义**:
   - `src/mock/interfaces/IMockCodeGenerator.ts`
   - `src/mock/interfaces/IMockFileWriter.ts`
   - `src/mock/interfaces/IMockFunctionLoader.ts`
   - `src/mock/interfaces/IMockMetadataProvider.ts`
   - `src/mock/interfaces/IMockOrchestrator.ts`
   - `src/mock/interfaces/ILLMClient.ts`
   - `src/mock/types.ts`

2. **核心实现**:
   - `src/mock/implementations/LLMMockCodeGenerator.ts`
   - `src/mock/implementations/FileSystemMockFileWriter.ts`
   - `src/mock/implementations/DynamicMockFunctionLoader.ts`
   - `src/mock/implementations/InMemoryMockMetadataProvider.ts`
   - `src/mock/implementations/MockOrchestrator.ts`

3. **适配器**:
   - `src/mock/adapters/AnthropicLLMClient.ts`

4. **装饰器**:
   - `src/mock/decorators/PlannerWithMockSupport.ts`

5. **工厂**:
   - `src/mock/factory/MockServiceFactory.ts`

6. **工具**:
   - `src/mock/prompts.ts`
   - `src/mock/index.ts`

7. **测试**:
   - `src/mock/__tests__/LLMMockCodeGenerator.test.ts`
   - `src/mock/__tests__/MockOrchestrator.test.ts`
   - `src/mock/__tests__/PlannerWithMockSupport.test.ts`

### 修改文件（最小化）

1. `src/cli/commands/plan.ts` - 注入 PlannerWithMockSupport
2. `src/planner/types.ts` - 添加 metadata 字段到 ExecutionPlan
3. `.gitignore` - 添加 `functions/generated/*.ts`

### 不修改文件（OCP）

- ✅ `src/planner/planner.ts` - 保持不变
- ✅ `src/executor/executor.ts` - 保持不变
- ✅ `src/registry/registry.ts` - 保持不变

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| LLM 生成无效代码 | 添加代码验证和格式化步骤 |
| 文件写入失败 | 实现重试逻辑，记录错误日志 |
| 动态导入失败 | try-catch 包装，继续处理其他函数 |
| Mock 破坏 Executor | 使用相同类型定义（LSP 保证） |
| 破坏现有测试 | 装饰器模式确保零修改 |
| 生成文件冲突 | 使用时间戳作为文件名 |

## 成功标准

1. ✅ 用户输入包含未知函数的需求，系统自动生成 mock
2. ✅ 生成的 TypeScript 文件语法正确，可编译
3. ✅ 执行计划能够成功运行，返回模拟数据
4. ✅ 清晰显示 MOCK 标记
5. ✅ 所有现有测试继续通过
6. ✅ 新增单元测试覆盖率 > 80%
7. ✅ 生成的文件供开发者编辑和完善
