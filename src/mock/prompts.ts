import type { MockFunctionSpec } from './types.js';

// ============================================================
// Prompt Template Options
// ============================================================

interface PromptTemplateOptions {
  importPath: string;
  generator: string;
}

function getSystemPrompt({ importPath }: PromptTemplateOptions): string {
  return `你是一个 JavaScript 代码生成专家。

## 函数类型

1. **纯函数**: 数学计算、字符串处理等，不依赖外部资源，生成真实实现
2. **外部依赖**: API 调用等，返回合理的模拟数据

## 代码规范

- 使用 defineFunction 辅助函数
- 从 '${importPath}' 导入 defineFunction
- 使用 export const 导出函数
- scenario 字段：中文描述，20字以内
- parameters：数组格式 [{ name, type, description }]
- returns：对象格式 { type, description }`;
}

function getPureFunctionExample({ importPath }: PromptTemplateOptions): string {
  return `import { defineFunction } from '${importPath}';

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
      throw new Error('Input must be non-negative');
    }
    return Math.sqrt(number);
  }
});`;
}

function getExternalDependencyExample({ importPath }: PromptTemplateOptions): string {
  return `import { defineFunction } from '${importPath}';

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
});`;
}

function getOutputRequirements({ generator }: PromptTemplateOptions): string {
  return `## 输出要求

- 只输出 JavaScript 代码（不含 Markdown 标记）
- 从 import 开始，到 }); 结束
- 代码可直接保存为 .js 文件执行

## 代码头注释

在代码最前面添加以下注释：

\`\`\`javascript
// 🤖 AUTO-GENERATED MOCK FUNCTION
// Generator: ${generator}
// Function: {functionName}
// Description: {description}
// TODO: Replace with real implementation
\`\`\``;
}

// ============================================================
// Main Function
// ============================================================

/**
 * Build prompt for LLM to generate mock function code
 * @param spec - Mock function specification
 * @param options - Template options
 */
export function buildMockCodeGenerationPrompt(
  spec: MockFunctionSpec,
  options: PromptTemplateOptions
): string {
  const paramsDoc = spec.parameters
    .map((p) => `  - ${p.name} (${p.type}): ${p.description}`)
    .join('\n');

  return `${getSystemPrompt(options)}

函数规格:
- 名称: ${spec.name}
- 描述: ${spec.description}
- 参数:
${paramsDoc}
- 返回值: ${spec.returns.type} - ${spec.returns.description}

示例:

${getPureFunctionExample(options)}

${getExternalDependencyExample(options)}

${getOutputRequirements(options)}

立即输出代码（包含上述注释头，从 import 开始）：`;
}

/**
 * Extract code from LLM response
 * Removes markdown code blocks and explanatory text if present
 */
export function extractCodeFromLLMResponse(response: string): string {
  let code = response.trim();

  // Find code block with markers
  const codeBlockRegex = /```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)\n```/;
  const match = code.match(codeBlockRegex);

  if (match && match[1]) {
    code = match[1].trim();
  } else {
    // No explicit code block, find import or export statement
    const importIndex = code.indexOf('import ');
    const exportIndex = code.indexOf('export ');

    if (importIndex !== -1 && (exportIndex === -1 || importIndex < exportIndex)) {
      code = code.substring(importIndex);
    } else if (exportIndex !== -1) {
      code = code.substring(exportIndex);
    }

    // Clean up markdown markers
    code = code.replace(/^```(?:typescript|ts|javascript|js)?\n?/, '');
    code = code.replace(/\n?```$/, '');
  }

  return code.trim();
}
