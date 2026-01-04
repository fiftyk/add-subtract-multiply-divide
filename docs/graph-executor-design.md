# 基于图的执行器实现 - LangGraph 风格

## 目标

实现一个新的基于图（Graph-based）的执行器，借鉴 LangGraph 的设计理念，支持条件分支、循环和并行执行。保持现有线性执行器不变，两者共存。

## 设计原则

- **图优先**：计划表示为有向图（DAG 或 cyclic graph）
- **状态驱动**：执行状态作为图节点间传递的数据
- **声明式**：通过图结构声明执行逻辑，而非命令式跳转
- **可扩展**：易于添加新的节点类型和边类型
- **向后兼容**：现有 ExecutorImpl 保持不变，新 GraphExecutor 独立实现

## LangGraph 核心设计理念

### 1. 状态图（StateGraph）

- **节点（Nodes）**：代表执行的操作（函数调用、用户输入等）
- **边（Edges）**：连接节点，定义执行流程
  - **普通边**：无条件连接两个节点
  - **条件边**：基于状态值选择下一个节点
- **状态（State）**：在节点间传递的数据结构

### 2. 执行模式

```
状态 → 节点1 → 更新状态 → 条件判断 → 节点2/节点3 → ...
```

### 3. 关键优势

- 并行执行：多个无依赖节点可并发运行
- 循环自然：边可以指向之前的节点
- 可视化友好：图结构易于理解和调试
- 条件分支：通过条件边实现，无需显式跳转

## 详细设计

### 1. 图结构类型定义

**新文件：** `src/executor/graph/types.ts`

```typescript
/**
 * 图节点 - 代表一个执行单元
 */
export interface GraphNode {
  id: string;  // 节点唯一ID
  type: 'function' | 'input' | 'condition' | 'start' | 'end';

  // 节点配置（根据类型不同）
  config: FunctionNodeConfig | InputNodeConfig | ConditionNodeConfig | {};
}

/**
 * 函数节点配置
 */
export interface FunctionNodeConfig {
  functionName: string;
  parameters: Record<string, ParameterValue>;
  description?: string;
}

/**
 * 用户输入节点配置
 */
export interface InputNodeConfig {
  schema: FormInputSchema;
  outputName?: string;
}

/**
 * 条件节点配置
 */
export interface ConditionNodeConfig {
  /**
   * 条件求值函数
   * 接收当前状态，返回边的标签（用于选择下一个节点）
   */
  condition: string | ConditionFunction;
}

export type ConditionFunction = (state: ExecutionState) => string;

/**
 * 图边 - 连接节点
 */
export interface GraphEdge {
  from: string;  // 源节点ID
  to: string;    // 目标节点ID
  label?: string;  // 边标签（条件边使用）
  condition?: string;  // 可选的条件表达式（简化写法）
}

/**
 * 执行图
 */
export interface ExecutionGraph {
  id: string;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  startNodeId: string;
  endNodeId: string;
}

/**
 * 执行状态 - 在节点间传递
 */
export interface ExecutionState {
  /**
   * 节点执行结果
   * key: 节点ID, value: 节点输出
   */
  nodeResults: Map<string, unknown>;

  /**
   * 节点执行状态
   * key: 节点ID, value: 成功/失败
   */
  nodeStatus: Map<string, boolean>;

  /**
   * 全局上下文（用户可访问）
   */
  context: Record<string, unknown>;

  /**
   * 错误信息
   */
  errors: Map<string, Error>;
}
```

### 2. GraphExecutor 核心实现

**新文件：** `src/executor/graph/GraphExecutor.ts`

```typescript
import type { ExecutionGraph, ExecutionState, GraphNode } from './types.js';
import type { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';

/**
 * 基于图的执行器
 */
export class GraphExecutor {
  constructor(
    private functionProvider: FunctionProvider,
    private options: GraphExecutorOptions = {}
  ) {}

  /**
   * 执行图
   */
  async execute(graph: ExecutionGraph): Promise<ExecutionState> {
    // 初始化状态
    const state: ExecutionState = {
      nodeResults: new Map(),
      nodeStatus: new Map(),
      context: {},
      errors: new Map(),
    };

    // 拓扑排序或图遍历
    const executionOrder = this.planExecution(graph);

    // 执行节点
    for (const batch of executionOrder) {
      // 并行执行同一批次的节点
      await Promise.all(
        batch.map(nodeId => this.executeNode(graph.nodes.get(nodeId)!, state))
      );
    }

    return state;
  }

  /**
   * 规划执行顺序
   * 返回批次列表，每个批次的节点可以并行执行
   */
  private planExecution(graph: ExecutionGraph): string[][] {
    // 1. 构建依赖图
    const dependencies = this.buildDependencyMap(graph);

    // 2. 拓扑排序（考虑条件边）
    const batches: string[][] = [];
    const visited = new Set<string>();
    const currentLevel = [graph.startNodeId];

    while (currentLevel.length > 0) {
      const batch: string[] = [];

      for (const nodeId of currentLevel) {
        if (!visited.has(nodeId)) {
          batch.push(nodeId);
          visited.add(nodeId);
        }
      }

      if (batch.length > 0) {
        batches.push(batch);
      }

      // 找出下一批可执行的节点
      currentLevel.length = 0;
      for (const nodeId of batch) {
        const outgoingEdges = this.getOutgoingEdges(graph, nodeId);
        for (const edge of outgoingEdges) {
          const deps = dependencies.get(edge.to) || [];
          if (deps.every(dep => visited.has(dep))) {
            currentLevel.push(edge.to);
          }
        }
      }
    }

    return batches;
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    node: GraphNode,
    state: ExecutionState
  ): Promise<void> {
    try {
      switch (node.type) {
        case 'function':
          await this.executeFunctionNode(node, state);
          break;
        case 'input':
          await this.executeInputNode(node, state);
          break;
        case 'condition':
          await this.executeConditionNode(node, state);
          break;
        case 'start':
        case 'end':
          // 标记节点，不执行
          state.nodeStatus.set(node.id, true);
          break;
      }
    } catch (error) {
      state.nodeStatus.set(node.id, false);
      state.errors.set(node.id, error as Error);
    }
  }

  /**
   * 执行函数节点
   */
  private async executeFunctionNode(
    node: GraphNode,
    state: ExecutionState
  ): Promise<void> {
    const config = node.config as FunctionNodeConfig;

    // 解析参数（从状态中）
    const resolvedParams = this.resolveParameters(config.parameters, state);

    // 调用函数
    const result = await this.functionProvider.execute(
      config.functionName,
      resolvedParams
    );

    if (result.success) {
      state.nodeResults.set(node.id, result.result);
      state.nodeStatus.set(node.id, true);
    } else {
      throw new Error(result.error || 'Function execution failed');
    }
  }

  /**
   * 解析参数引用
   * 支持引用其他节点的结果：{ type: 'nodeRef', nodeId: 'node1', path: 'result' }
   */
  private resolveParameters(
    params: Record<string, ParameterValue>,
    state: ExecutionState
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value.type === 'literal') {
        resolved[key] = value.value;
      } else if (value.type === 'nodeRef') {
        // 新引用格式：{ type: 'nodeRef', nodeId: 'xxx', path: 'result' }
        const nodeId = (value.value as any).nodeId;
        const path = (value.value as any).path || 'result';

        const nodeResult = state.nodeResults.get(nodeId);
        if (nodeResult === undefined) {
          throw new Error(`Node ${nodeId} result not found`);
        }

        // 路径访问
        resolved[key] = path === 'result'
          ? nodeResult
          : this.getNestedValue(nodeResult, path);
      }
    }

    return resolved;
  }

  /**
   * 构建依赖映射
   */
  private buildDependencyMap(graph: ExecutionGraph): Map<string, string[]> {
    const deps = new Map<string, string[]>();

    for (const edge of graph.edges) {
      if (!deps.has(edge.to)) {
        deps.set(edge.to, []);
      }
      deps.get(edge.to)!.push(edge.from);
    }

    return deps;
  }

  /**
   * 获取节点的出边
   */
  private getOutgoingEdges(graph: ExecutionGraph, nodeId: string): GraphEdge[] {
    return graph.edges.filter(edge => edge.from === nodeId);
  }

  /**
   * 执行条件节点（决定下一步走哪条边）
   */
  private async executeConditionNode(
    node: GraphNode,
    state: ExecutionState
  ): Promise<void> {
    const config = node.config as ConditionNodeConfig;

    // 求值条件
    let edgeLabel: string;
    if (typeof config.condition === 'string') {
      // 字符串条件表达式
      edgeLabel = this.evaluateConditionExpression(config.condition, state);
    } else {
      // 函数形式
      edgeLabel = config.condition(state);
    }

    // 存储条件结果（用于选择边）
    state.nodeResults.set(node.id, edgeLabel);
    state.nodeStatus.set(node.id, true);
  }

  /**
   * 求值条件表达式
   */
  private evaluateConditionExpression(
    expr: string,
    state: ExecutionState
  ): string {
    // 简单实现：支持 "node.xxx.result > 10" 格式
    // 返回 "true" 或 "false" 标签

    // TODO: 实现条件求值器（复用之前设计的 SimpleConditionEvaluator）
    return 'true';
  }

  /**
   * 获取执行器规范（供 LLM 使用）
   * LLM 可以调用此方法了解如何生成该执行器可识别的计划
   */
  getSchema(): ExecutorSchema {
    return {
      type: 'graph',
      supportedNodeTypes: [
        {
          type: 'function',
          description: '调用已注册的函数',
          configSchema: {
            functionName: {
              type: 'string',
              required: true,
              description: '函数名称',
              example: 'add'
            },
            parameters: {
              type: 'object',
              required: true,
              description: '函数参数，支持字面量和节点引用',
              example: {
                x: { type: 'literal', value: 10 },
                y: { type: 'nodeRef', nodeId: 'node1', path: 'result' }
              }
            }
          },
          examples: [
            {
              id: 'calc_sum',
              type: 'function',
              config: {
                functionName: 'add',
                parameters: {
                  x: { type: 'literal', value: 3 },
                  y: { type: 'literal', value: 5 }
                }
              }
            }
          ]
        },
        {
          type: 'input',
          description: '向用户请求输入',
          configSchema: {
            schema: {
              type: 'object',
              required: true,
              description: 'Form Input Schema 定义输入字段',
              example: {
                fields: [
                  { id: 'name', type: 'text', label: '姓名' }
                ]
              }
            }
          },
          examples: [
            {
              id: 'get_user_input',
              type: 'input',
              config: {
                schema: {
                  fields: [
                    { id: 'count', type: 'number', label: '数量' }
                  ]
                }
              }
            }
          ]
        },
        {
          type: 'condition',
          description: '基于条件选择不同的执行路径',
          configSchema: {
            condition: {
              type: 'string',
              required: true,
              description: '条件表达式或函数，返回边标签',
              example: 'node.calc_sum.result > 10'
            }
          },
          examples: [
            {
              id: 'check_result',
              type: 'condition',
              config: {
                condition: 'node.calc_sum.result > 10'
              }
            }
          ]
        }
      ],
      edgeRules: {
        allowsConditionalEdges: true,  // 支持条件边
        allowsCycles: true,             // 支持循环（回向边）
        requiresLabels: true            // 条件边需要标签
      },
      examples: [
        {
          name: '简单线性执行',
          description: '两个函数顺序执行',
          plan: {
            nodes: [
              { id: 'start', type: 'start', config: {} },
              {
                id: 'calc1',
                type: 'function',
                config: {
                  functionName: 'add',
                  parameters: {
                    x: { type: 'literal', value: 3 },
                    y: { type: 'literal', value: 5 }
                  }
                }
              },
              {
                id: 'calc2',
                type: 'function',
                config: {
                  functionName: 'multiply',
                  parameters: {
                    x: { type: 'nodeRef', nodeId: 'calc1', path: 'result' },
                    y: { type: 'literal', value: 2 }
                  }
                }
              },
              { id: 'end', type: 'end', config: {} }
            ],
            edges: [
              { from: 'start', to: 'calc1' },
              { from: 'calc1', to: 'calc2' },
              { from: 'calc2', to: 'end' }
            ]
          }
        },
        {
          name: '条件分支',
          description: '根据结果选择不同的分支',
          plan: {
            nodes: [
              { id: 'start', type: 'start', config: {} },
              {
                id: 'calc',
                type: 'function',
                config: {
                  functionName: 'getValue',
                  parameters: {}
                }
              },
              {
                id: 'check',
                type: 'condition',
                config: {
                  condition: 'node.calc.result > 10'
                }
              },
              {
                id: 'branch_a',
                type: 'function',
                config: { functionName: 'handleHighValue', parameters: {} }
              },
              {
                id: 'branch_b',
                type: 'function',
                config: { functionName: 'handleLowValue', parameters: {} }
              },
              { id: 'end', type: 'end', config: {} }
            ],
            edges: [
              { from: 'start', to: 'calc' },
              { from: 'calc', to: 'check' },
              { from: 'check', to: 'branch_a', label: 'true' },
              { from: 'check', to: 'branch_b', label: 'false' },
              { from: 'branch_a', to: 'end' },
              { from: 'branch_b', to: 'end' }
            ]
          }
        }
      ],
      constraints: {
        maxNodes: 100,
        maxEdgesPerNode: 10,
        maxParallelism: 5
      }
    };
  }
}

export interface GraphExecutorOptions {
  maxConcurrency?: number;  // 最大并发数
  enableParallel?: boolean;  // 是否启用并行执行
  timeout?: number;  // 全局超时
}
```

### 3. 计划到图的转换器

**新文件：** `src/executor/graph/PlanToGraphConverter.ts`

```typescript
import type { ExecutionPlan } from '../../planner/types.js';
import type { ExecutionGraph, GraphNode, GraphEdge } from './types.js';

/**
 * 将 ExecutionPlan 转换为 ExecutionGraph
 */
export class PlanToGraphConverter {
  convert(plan: ExecutionPlan): ExecutionGraph {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // 添加起始节点
    const startNode: GraphNode = {
      id: 'start',
      type: 'start',
      config: {},
    };
    nodes.set('start', startNode);

    // 转换步骤为节点
    let previousNodeId = 'start';

    for (const step of plan.steps) {
      const nodeId = `step_${step.stepId}`;

      if (isFunctionCallStep(step)) {
        const node: GraphNode = {
          id: nodeId,
          type: 'function',
          config: {
            functionName: step.functionName,
            parameters: step.parameters,
            description: step.description,
          },
        };
        nodes.set(nodeId, node);

        // 添加边
        edges.push({ from: previousNodeId, to: nodeId });
        previousNodeId = nodeId;

      } else if (isUserInputStep(step)) {
        const node: GraphNode = {
          id: nodeId,
          type: 'input',
          config: {
            schema: step.schema,
            outputName: step.outputName,
          },
        };
        nodes.set(nodeId, node);

        edges.push({ from: previousNodeId, to: nodeId });
        previousNodeId = nodeId;
      }
    }

    // 添加结束节点
    const endNode: GraphNode = {
      id: 'end',
      type: 'end',
      config: {},
    };
    nodes.set('end', endNode);
    edges.push({ from: previousNodeId, to: 'end' });

    return {
      id: plan.id,
      nodes,
      edges,
      startNodeId: 'start',
      endNodeId: 'end',
    };
  }

  /**
   * 将带条件步骤的计划转换为图
   * （扩展版本，支持条件分支）
   */
  convertWithConditionals(plan: ExecutionPlan): ExecutionGraph {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    nodes.set('start', { id: 'start', type: 'start', config: {} });

    for (const step of plan.steps) {
      const nodeId = `step_${step.stepId}`;

      if (isConditionalStep(step)) {
        // 条件步骤 → 条件节点
        const node: GraphNode = {
          id: nodeId,
          type: 'condition',
          config: {
            condition: step.condition,
          },
        };
        nodes.set(nodeId, node);

        // 添加条件边
        edges.push({
          from: nodeId,
          to: `step_${step.onTrue}`,
          label: 'true',
        });
        edges.push({
          from: nodeId,
          to: `step_${step.onFalse}`,
          label: 'false',
        });
      } else {
        // 普通步骤
        // ...（同上）
      }
    }

    nodes.set('end', { id: 'end', type: 'end', config: {} });

    return {
      id: plan.id,
      nodes,
      edges,
      startNodeId: 'start',
      endNodeId: 'end',
    };
  }
}
```

### 4. 图计划类型（可选 - 未来直接生成图）

**文件：** `src/planner/types.ts`（扩展）

```typescript
/**
 * 图计划 - 直接表示执行图
 * （可选：未来 LLM 可以直接生成这种格式）
 */
export interface GraphPlan {
  id: string;
  userRequest: string;
  graph: {
    nodes: Array<{
      id: string;
      type: 'function' | 'input' | 'condition';
      config: Record<string, unknown>;
    }>;
    edges: Array<{
      from: string;
      to: string;
      label?: string;
    }>;
  };
  createdAt: string;
}
```


### 5. 集成到现有系统

**文件：** `src/executor/interfaces/Executor.ts`

保持现有接口不变，新增图执行器接口：

```typescript
/**
 * 执行器规范 - 描述执行器支持的计划格式
 */
export interface ExecutorSchema {
  /**
   * 执行器类型标识
   */
  type: 'linear' | 'graph';

  /**
   * 支持的节点类型
   */
  supportedNodeTypes: NodeTypeSchema[];

  /**
   * 边的规则
   */
  edgeRules?: {
    allowsConditionalEdges: boolean;
    allowsCycles: boolean;
    requiresLabels: boolean;
  };

  /**
   * 示例计划
   */
  examples: ExecutorExample[];

  /**
   * 约束和限制
   */
  constraints?: {
    maxNodes?: number;
    maxEdgesPerNode?: number;
    maxParallelism?: number;
  };
}

/**
 * 节点类型规范
 */
export interface NodeTypeSchema {
  type: string;  // 'function' | 'input' | 'condition' | ...
  description: string;
  configSchema: Record<string, FieldSchema>;
  examples: unknown[];
}

export interface FieldSchema {
  type: 'string' | 'number' | 'object' | 'array';
  required: boolean;
  description: string;
  example?: unknown;
}

export interface ExecutorExample {
  name: string;
  description: string;
  plan: unknown;  // ExecutionPlan or ExecutionGraph
}

/**
 * 图执行器接口
 */
export interface GraphBasedExecutor {
  /**
   * 执行图
   */
  execute(graph: ExecutionGraph): Promise<ExecutionState>;

  /**
   * 获取执行器规范（供 LLM 使用）
   * LLM 可以调用此方法了解如何生成该执行器可识别的计划
   */
  getSchema(): ExecutorSchema;
}
```

**文件：** `src/container.ts`（InversifyJS 绑定）

```typescript
import { GraphExecutor } from './executor/graph/GraphExecutor.js';

// 绑定图执行器（可选）
container.bind('GraphExecutor').to(GraphExecutor);
```

**CLI 选择执行器**：

```typescript
// src/cli/commands/execute.ts
const useGraphExecutor = plan.steps.some(step => isConditionalStep(step));

if (useGraphExecutor) {
  const graphExecutor = new GraphExecutor(functionProvider);
  const converter = new PlanToGraphConverter();
  const graph = converter.convertWithConditionals(plan);
  const state = await graphExecutor.execute(graph);
} else {
  // 使用现有的 ExecutorImpl
  const executor = container.get<Executor>(Executor);
  const result = await executor.execute(plan);
}
```

## 实施步骤

### Phase 1: 图结构基础（Week 1）

1. **创建图类型定义**（1 天）
   - 新建 `src/executor/graph/types.ts`
   - 定义 `GraphNode`, `GraphEdge`, `ExecutionGraph`, `ExecutionState`

2. **实现 GraphExecutor 核心**（2 天）
   - 新建 `src/executor/graph/GraphExecutor.ts`
   - 实现图遍历和拓扑排序
   - 实现节点执行逻辑（function, input, condition）
   - 实现 `getSchema()` 方法，返回执行器规范供 LLM 使用

3. **实现 PlanToGraphConverter**（1 天）
   - 新建 `src/executor/graph/PlanToGraphConverter.ts`
   - 支持线性计划转图
   - 支持条件计划转图

4. **单元测试**（1 天）
   - 测试图遍历逻辑
   - 测试节点执行
   - 测试转换器

### Phase 2: 条件和分支支持（Week 2）

5. **扩展 ExecutionPlan 类型**（0.5 天）
   - 在 `src/planner/types.ts` 添加 `ConditionalStep`
   - 更新 `StepType` 枚举

6. **条件节点实现**（1 天）
   - 实现条件求值器（复用之前设计）
   - 在 GraphExecutor 中实现条件节点执行

7. **条件边选择逻辑**（1 天）
   - 根据条件结果选择出边
   - 支持多分支（不限于 true/false）

8. **集成测试**（1.5 天）
   - E2E 测试：条件分支场景
   - E2E 测试：异常处理场景

### Phase 3: LLM 集成和优化（Week 3）

9. **更新 Planner Prompt**（1 天）
   - 添加条件步骤示例
   - 教导 LLM 何时使用条件节点

10. **CLI 集成**（1 天）
    - 在 execute 命令中自动选择执行器
    - 添加 `--executor=graph` 选项（可选）

11. **并行执行优化**（1.5 天）
    - 实现批次并行执行
    - 添加并发控制选项

12. **文档和示例**（0.5 天）
    - 更新 CLAUDE.md
    - 添加图执行器使用示例

### Phase 4: 高级特性（Week 4 - 可选）

13. **循环支持**
    - 检测循环并添加迭代限制
    - 支持循环计数器

14. **可视化工具**
    - 生成执行图的 Mermaid 图表
    - 执行跟踪可视化

15. **性能优化**
    - 优化大型图的执行
    - 添加缓存机制

## 向后兼容性

### 1. 现有 ExecutorImpl 保持不变

- ✅ 不修改任何现有执行器代码
- ✅ 现有测试无需修改
- ✅ 现有线性计划正常执行

### 2. 渐进式采用

- 用户可以继续使用 ExecutorImpl
- 只有包含条件步骤的计划才使用 GraphExecutor
- 或者用户通过 CLI 选项手动选择

### 3. 迁移路径

```
Phase 1: 两个执行器共存（ExecutorImpl + GraphExecutor）
↓
Phase 2: GraphExecutor 成为默认（向后兼容线性计划）
↓
Phase 3: (可选) 弃用 ExecutorImpl
```

## 优势对比

### GraphExecutor vs ExecutorImpl（条件跳转方案）

| 特性 | GraphExecutor | ExecutorImpl + 跳转 |
|------|---------------|---------------------|
| **架构清晰度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **实现复杂度** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **并行执行** | ✅ 原生支持 | ❌ 需大量改造 |
| **循环支持** | ✅ 自然支持 | ⚠️ 需检测回跳 |
| **可视化** | ✅ 天然图结构 | ⚠️ 需重构为图 |
| **向后兼容** | ✅ 完全独立 | ⚠️ 修改现有代码 |
| **LLM 生成** | ✅ 声明式 | ⚠️ 命令式跳转 |
| **调试友好** | ✅ 状态清晰 | ⚠️ 跳转难追踪 |

## 关键文件清单

### 新建文件

1. `src/executor/graph/types.ts` - 图结构类型定义
2. `src/executor/graph/GraphExecutor.ts` - 图执行器核心
3. `src/executor/graph/PlanToGraphConverter.ts` - 计划转图转换器
4. `src/executor/graph/__tests__/GraphExecutor.test.ts` - 单元测试
5. `src/executor/graph/__tests__/PlanToGraphConverter.test.ts` - 转换器测试
6. `__tests__/graph-executor-e2e.test.ts` - E2E 测试

### 修改文件

7. `src/planner/types.ts` - 添加 `ConditionalStep` 类型（可选，如果想从现有计划转换）
8. `src/planner/prompt.ts` - 更新 prompt 添加条件步骤示例
9. `src/cli/commands/execute.ts` - 集成图执行器选择逻辑
10. `CLAUDE.md` - 文档更新

### 不修改的文件

- `src/executor/executor.ts` - ExecutorImpl 保持不变
- `src/executor/context.ts` - 不修改（图执行器使用新的状态管理）
- `src/executor/types.ts` - 不修改（图执行器使用新的结果类型）

## 测试策略

### 单元测试

1. **Graph类型和工具**
   - 图构建和验证
   - 拓扑排序算法
   - 依赖关系解析

2. **GraphExecutor**
   - 节点执行（function, input, condition）
   - 参数解析（nodeRef 引用）
   - 条件求值

3. **PlanToGraphConverter**
   - 线性计划转换
   - 条件计划转换
   - 边缘情况（空计划、循环等）

### E2E 测试

1. **基本场景**
   - 线性执行（与 ExecutorImpl 对比）
   - 简单条件分支

2. **高级场景**
   - 嵌套条件
   - 异常处理模式
   - 简单循环（后向边）

3. **并行执行**
   - 多个无依赖节点并行
   - 验证执行顺序正确

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 图遍历算法复杂 | 中 | 使用成熟的拓扑排序算法 |
| 并行执行Bug | 中 | 严格的单元测试，MVP先禁用并行 |
| LLM难以生成图结构 | 高 | Phase 1使用转换器，Phase 2再训练LLM |
| 性能不如ExecutorImpl | 低 | 对于线性计划两者应相当 |
| 循环导致无限执行 | 中 | 添加最大迭代次数限制 |

## 预计工作量

- **Phase 1**（基础）：5 天
- **Phase 2**（条件分支）：5 天
- **Phase 3**（集成优化）：3 天
- **Phase 4**（高级特性）：5 天（可选）

**总计**：2-3 周核心功能，4 周完整实现

## 成功标准

1. ✅ GraphExecutor 能执行所有现有的线性计划
2. ✅ 支持条件分支和异常处理
3. ✅ 支持简单循环（后向边）
4. ✅ 所有现有测试通过（ExecutorImpl 不受影响）
5. ✅ 新的 E2E 测试覆盖图执行器场景
6. ✅ LLM 能生成条件步骤（通过 prompt engineering）
7. ✅ 文档完整，包含使用示例

---

## 总结

**推荐方案：实现独立的 GraphExecutor，借鉴 LangGraph 设计**

**核心优势：**
- ✅ 架构优雅：状态图模式，声明式表达
- ✅ 完全独立：不影响现有 ExecutorImpl
- ✅ 自然支持：条件、循环、并行都是图的天然特性
- ✅ 未来扩展：易于添加新节点类型和执行策略
- ✅ 可视化友好：图结构易于理解和调试
- ✅ LLM 友好：通过 `getSchema()` 方法提供完整的规范说明

**实施路径：**
1. Phase 1：图执行器基础 + 线性计划支持
2. Phase 2：条件节点 + 分支逻辑
3. Phase 3：LLM 集成 + 并行优化
4. Phase 4：循环优化 + 可视化工具

**与条件跳转方案的对比：**
- 虽然图执行器实现复杂度稍高，但长期来看架构更清晰
- 原生支持并行执行，这是条件跳转方案难以实现的
- 不修改现有代码，风险更低
- 符合现代工作流引擎的设计理念（LangGraph, Airflow, Prefect）

**准备就绪，等待用户批准后开始实施。**
