# Mock → 函数自动补全系统 重构方案

## 一、重命名映射表

### 1. 目录结构
```
src/mock/                           → src/function-completion/
├── adapters/                       → adapters/
├── decorators/                     → decorators/
├── factory/                        → factory/
├── implementations/                → implementations/
├── interfaces/                     → interfaces/
└── __tests__/                      → __tests__/
```

### 2. 核心类名映射

#### 接口 (interfaces/)
| 旧名称 | 新名称 |
|--------|--------|
| IMockOrchestrator | ICompletionOrchestrator |
| IMockCodeGenerator | IFunctionCodeGenerator |
| IMockFileWriter | IFunctionFileWriter |
| IMockFunctionLoader | IFunctionLoader |
| IMockMetadataProvider | ICompletionMetadataProvider |
| IMockCodeValidator | IFunctionCodeValidator |

#### 实现类 (implementations/)
| 旧名称 | 新名称 |
|--------|--------|
| MockOrchestrator | CompletionOrchestrator |
| LLMMockCodeGenerator | LLMFunctionCodeGenerator |
| FileSystemMockFileWriter | FileSystemFunctionFileWriter |
| DynamicMockFunctionLoader | DynamicFunctionLoader |
| InMemoryMockMetadataProvider | InMemoryCompletionMetadataProvider |
| DynamicMockCodeValidator | DynamicFunctionCodeValidator |

#### 装饰器 (decorators/)
| 旧名称 | 新名称 |
|--------|--------|
| PlannerWithMockSupport | PlannerWithAutoCompletion |

#### 工厂 (factory/)
| 旧名称 | 新名称 |
|--------|--------|
| MockServiceFactory | CompletionServiceFactory |
| MockServiceFactoryImpl | CompletionServiceFactoryImpl |

### 3. 类型定义 (types.ts)
| 旧名称 | 新名称 |
|--------|--------|
| MockFunctionSpec | FunctionCompletionSpec |
| MockMetadata | CompletionMetadata |
| MockGenerationResult | FunctionGenerationResult |

### 4. 配置项映射 (config/types.ts)
| 旧名称 | 新名称 | 说明 |
|--------|--------|------|
| mock | functionCompletion | 配置对象名 |
| autoGenerate | enabled | 是否启用自动补全 |
| maxIterations | maxRetries | 最大重试次数 |

### 5. 环境变量映射
| 旧名称 | 新名称 |
|--------|--------|
| AUTO_GENERATE_MOCK | AUTO_COMPLETE_FUNCTIONS |
| MOCK_MAX_ITERATIONS | FUNCTION_COMPLETION_MAX_RETRIES |
| MOCK_OUTPUT_DIR | FUNCTION_COMPLETION_OUTPUT_DIR |

### 6. CLI 参数映射
| 旧名称 | 新名称 |
|--------|--------|
| --auto-mock | --auto-complete |
| --mock-max-iterations | --max-retries |

## 二、核心概念变更说明

**旧概念：Mock 生成系统**
- 容易与测试框架中的 Mock 混淆
- 暗示"模拟/假的"实现

**新概念：函数自动补全系统**
- 强调"补全缺失函数"的本质
- 类似 IDE 的智能补全，但更强大
- 生成的是真实可用的函数实现

## 三、执行建议

考虑到重构范围较大（45+ 文件），建议：

1. **先提交当前代码**：`git add . && git commit -m "feat: before function-completion refactor"`
2. **分阶段重构**：
   - Phase 1: 目录和文件重命名
   - Phase 2: 类型和接口重命名
   - Phase 3: 实现类重命名
   - Phase 4: 配置和 CLI 更新
   - Phase 5: 文档更新
3. **每个 Phase 后运行测试**：确保功能正常
4. **最后统一提交**：`git commit -m "refactor: rename mock to function-completion system"`

## 四、待确认事项

- [ ] 是否需要保持向后兼容（旧的环境变量别名）？
- [ ] 是否需要数据迁移脚本？
- [ ] 配置字段名 `mock` → `functionCompletion` 还是简化为 `completion`？

---
生成时间：2025-12-29
