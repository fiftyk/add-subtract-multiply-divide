import type { MockFunctionSpec } from './types.js';

/**
 * Build prompt for LLM to generate mock function code
 */
export function buildMockCodeGenerationPrompt(spec: MockFunctionSpec): string {
  const paramsDoc = spec.parameters
    .map(
      (p) => `- ${p.name} (${p.type}): ${p.description}`
    )
    .join('\n');

  // Build parameters array string for the example
  const paramsArrayStr = spec.parameters
    .map(
      (p) =>
        `    { name: '${p.name}', type: '${p.type}', description: '${p.description}' }`
    )
    .join(',\n');

  return `你是一个 TypeScript 代码生成专家。请根据以下函数规格生成一个完整的 mock 函数实现。

函数名称: ${spec.name}
描述: ${spec.description}

参数:
${paramsDoc}

返回值: ${spec.returns.type} - ${spec.returns.description}

要求:
1. 使用 defineFunction 辅助函数定义函数
2. 从 '../../dist/src/registry/index.js' 导入 defineFunction
3. 使用 export const 导出函数
4. implementation 部分应该返回合理的模拟数据（不要返回 null 或 undefined）
5. 模拟数据应该符合返回值类型，包含有意义的测试数据
6. 如果返回 object，请构造一个包含多个字段的完整对象
7. 如果返回 array，请包含 2-3 个示例元素
8. 添加适当的 scenario 字段，描述使用场景（中文，20字以内）
9. 代码必须符合 TypeScript 语法，可以直接编译通过
10. 不要包含任何注释或说明，只输出可执行的代码
11. **关键**: parameters 必须是数组格式，每个参数是对象: { name, type, description }
12. **关键**: 必须使用 returns 字段(对象)，不是 returnType

代码格式示例:
\`\`\`typescript
import { defineFunction } from '../../dist/src/registry/index.js';

export const ${spec.name} = defineFunction({
  name: '${spec.name}',
  description: '${spec.description}',
  scenario: '使用场景描述',
  parameters: [
${paramsArrayStr}
  ],
  returns: { type: '${spec.returns.type}', description: '${spec.returns.description}' },
  implementation: (${spec.parameters.map((p) => p.name).join(', ')}) => {
    // 返回符合类型的模拟数据
    return ${spec.returns.type === 'object' ? '{ /* mock data */ }' : spec.returns.type === 'array' ? '[/* mock data */]' : '"mock value"'};
  }
});
\`\`\`

请严格按照上述格式输出代码，不要使用 markdown 代码块标记：`;
}

/**
 * Extract code from LLM response
 * Removes markdown code blocks if present
 */
export function extractCodeFromLLMResponse(response: string): string {
  let code = response.trim();

  // Remove markdown code blocks if present
  if (code.startsWith('```typescript') || code.startsWith('```ts')) {
    code = code.replace(/^```(?:typescript|ts)\n/, '').replace(/\n```$/, '');
  } else if (code.startsWith('```')) {
    code = code.replace(/^```\n/, '').replace(/\n```$/, '');
  }

  return code.trim();
}
