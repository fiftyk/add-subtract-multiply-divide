import type { MockFunctionSpec } from './types.js';

// ============================================================
// Prompt Template Options
// ============================================================

interface PromptTemplateOptions {
  importPath: string;
  generator: string;
}

function getSystemPrompt({ importPath }: PromptTemplateOptions): string {
  return `你是一个资深 JavaScript 工程师。你的任务是根据函数规格**编写**高质量的代码，而非简单生成。

## 工作方法

在编写代码之前，请先完成以下分析：

### 第一步：理解需求
- 仔细阅读函数名称和描述，理解这个函数要解决什么问题
- 分析每个参数的含义和用途
- 明确返回值的结构和业务含义

### 第二步：判断函数类型
1. **纯函数**: 数学计算、字符串处理、数据转换等
   - 特征：不依赖外部资源，输入相同则输出相同
   - 要求：编写真实可用的算法实现

2. **外部依赖**: API 调用、数据库查询、网络请求等
   - 特征：需要调用外部服务
   - 要求：返回合理的模拟数据，数据要有业务意义

### 第三步：编写代码
- 基于对需求的理解，编写清晰、健壮的实现
- 考虑边界情况和错误处理
- 确保代码可读性和可维护性

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
  return `## 编写要求

在理解了函数需求之后，请编写符合以下标准的代码：

### 代码质量
- 代码逻辑要与函数描述的业务需求相匹配
- 纯函数需要真实的算法实现，不能返回硬编码的随机值
- 外部依赖需要返回有业务意义的模拟数据

### 代码规范
- 从 import 语句开始，到 }); 结束
- 不要包含 Markdown 代码块标记
- 不要输出任何解释、说明或思考过程

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

请在充分理解上述函数规格后，编写代码（包含上述注释头，从 import 开始）：`;
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
