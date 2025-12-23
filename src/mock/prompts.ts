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

  return `你是一个 JavaScript 代码生成专家。请根据以下函数规格生成一个完整的函数实现。

函数名称: ${spec.name}
描述: ${spec.description}

参数:
${paramsDoc}

返回值: ${spec.returns.type} - ${spec.returns.description}

代码生成策略：
请先判断这个函数的类型：

1. **纯函数/纯算法** (Pure Function)：
   - 特征：数学计算、字符串处理、数据转换、数组操作等
   - 特征：不依赖外部资源（API、数据库、文件系统等）
   - 特征：输入相同，输出总是相同
   - **要求：生成真实的、完整的、可用于生产的实现代码**
   - 示例：计算平方根、求和、数组排序、字符串格式化、数据类型转换等

2. **依赖外部资源的函数** (External Dependency)：
   - 特征：需要调用 API、查询数据库、读取文件、网络请求等
   - 特征：依赖第三方服务或系统资源
   - **要求：返回合理的模拟数据（mock data）**
   - 示例：queryPatent、fetchUserData、readFile、httpRequest等

技术要求：
1. 使用 defineFunction 辅助函数定义函数
2. 从 '../../dist/src/registry/index.js' 导入 defineFunction
3. 使用 export const 导出函数
4. 添加适当的 scenario 字段，描述使用场景（中文，20字以内）
5. 代码必须是纯 JavaScript，可以直接执行
6. **关键**: parameters 必须是数组格式，每个参数是对象: { name, type, description }
7. **关键**: 必须使用 returns 字段(对象)，不是 returnType

实现要求：
- **如果是纯函数**：编写完整的、真实的算法实现
  - 对于数学函数：使用 Math 内置函数或实现算法
  - 对于字符串处理：使用字符串方法实现真实逻辑
  - 对于数据转换：实现真实的转换逻辑
  - 确保实现正确、高效、健壮

- **如果依赖外部资源**：返回合理的模拟数据
  - 模拟数据应该符合返回值类型
  - 包含有意义的测试数据
  - 如果返回 object，请构造一个包含多个字段的完整对象
  - 如果返回 array，请包含 2-3 个示例元素

代码格式示例：

【纯函数示例 - 平方根】
import { defineFunction } from '../../dist/src/registry/index.js';

export const sqrt = defineFunction({
  name: 'sqrt',
  description: '计算一个数字的平方根',
  scenario: '数学计算',
  parameters: [
    { name: 'number', type: 'number', description: '需要计算平方根的非负数' }
  ],
  returns: { type: 'number', description: '输入数字的平方根' },
  implementation: (number) => {
    if (number < 0) {
      throw new Error('Cannot calculate square root of negative number');
    }
    return Math.sqrt(number);
  }
});

【外部依赖示例 - API查询】
import { defineFunction } from '../../dist/src/registry/index.js';

export const queryPatent = defineFunction({
  name: 'queryPatent',
  description: '查询专利详细信息',
  scenario: '专利数据查询',
  parameters: [
    { name: 'patentNumber', type: 'string', description: '专利号' }
  ],
  returns: { type: 'object', description: '专利详细信息' },
  implementation: (patentNumber) => {
    return {
      patentNumber,
      title: '一种基于人工智能的数据处理方法',
      inventors: ['张三', '李四'],
      applicationDate: '2023-01-15',
      status: 'granted'
    };
  }
});

请根据 "${spec.name}" 函数的特征判断类型并生成相应的代码。

**极其重要 - 输出格式要求**：
1. ❌ 禁止：不要输出任何解释、说明、思考过程或注释
2. ❌ 禁止：不要使用 Markdown 代码块标记（\`\`\`typescript、\`\`\`javascript、\`\`\`）
3. ❌ 禁止：不要在代码前后添加任何文字
4. ✅ 必须：只输出纯 JavaScript 代码
5. ✅ 必须：从 import 语句开始，���最后的 }); 结束
6. ✅ 必须：代码必须能够直接保存为 .js 文件并在 Node.js 中执行

立即输出 JavaScript 代码（不要添加任何其他内容）：`;


}

/**
 * Extract code from LLM response
 * Removes markdown code blocks and explanatory text if present
 */
export function extractCodeFromLLMResponse(response: string): string {
  let code = response.trim();

  // Strategy 1: Find code block with markers (```typescript or ```)
  const codeBlockRegex = /```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)\n```/;
  const match = code.match(codeBlockRegex);

  if (match && match[1]) {
    // Found code block, extract the code inside
    code = match[1].trim();
  } else {
    // Strategy 2: No explicit code block markers, try to find import statement
    // Remove everything before the first import or export statement
    const importIndex = code.indexOf('import ');
    const exportIndex = code.indexOf('export ');

    if (importIndex !== -1 && (exportIndex === -1 || importIndex < exportIndex)) {
      code = code.substring(importIndex);
    } else if (exportIndex !== -1) {
      code = code.substring(exportIndex);
    }

    // Remove markdown code blocks if present at start/end
    if (code.startsWith('```')) {
      code = code.replace(/^```(?:typescript|ts|javascript|js)?\n?/, '');
    }
    if (code.endsWith('```')) {
      code = code.replace(/\n?```$/, '');
    }
  }

  return code.trim();
}
