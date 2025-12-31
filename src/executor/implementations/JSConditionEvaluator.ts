/**
 * JavaScript 条件求值器
 * 使用 new Function() 执行条件表达式
 *
 * ⚠️ 安全性说明：
 * - 此实现直接执行用户提供的 JS 表达式
 * - 仅适用于可信环境或开发者自己生成的条件
 * - 如果需要更安全的方案，可实现 SandboxedConditionEvaluator
 */

import type { ConditionEvaluator, ConditionContext } from '../interfaces/ConditionEvaluator.js';

/**
 * 获取嵌套属性值的工具函数
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // 处理数组索引
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayName, indexStr] = arrayMatch;
      const array = (current as Record<string, unknown>)[arrayName];
      if (Array.isArray(array)) {
        current = array[parseInt(indexStr, 10)];
      } else {
        return undefined;
      }
    } else if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * JavaScript 条件求值器实现
 */
export class JSConditionEvaluator implements ConditionEvaluator {
  /**
   * 求值条件表达式
   * @param condition 条件表达式 (JavaScript)
   * @param context 条件求值上下文
   * @returns 条件结果 (true/false)
   */
  evaluate(condition: string, context: ConditionContext): boolean {
    // 预处理：替换 step.X.result 和 step.X.field 引用
    const resolvedCondition = this.resolveReferences(condition, context);

    // 使用 Function 执行表达式
    // 注意：直接执行 JS 表达式，接受安全风险
    try {
      const fn = new Function(
        ...this.getParameterNames(resolvedCondition),
        `return ${resolvedCondition};`
      );

      const args = this.getArgumentValues(resolvedCondition, context);
      const result = fn(...args);

      // 确保返回布尔值
      return Boolean(result);
    } catch (error) {
      // 条件求值失败时返回 false（保守策略）
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`条件求值失败: "${condition}" -> ${errorMessage}`);
      return false;
    }
  }

  /**
   * 检查是否支持该条件表达式
   * 简单实现：始终返回 true
   */
  supports(condition: string): boolean {
    // 排除明显危险的内容
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s*\(/,
      /eval\s*\(/,
      /process\./,
      /global\./,
      /window\./,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(condition)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 解析条件表达式中的引用
   * 将 step.X.result 格式转换为变量名
   */
  private resolveReferences(condition: string, context: ConditionContext): string {
    // 正则匹配: step.{id}.result.{path?}
    const stepRefPattern = /step\.(\d+)(?:\.result(?:\.([\w.\[\]]+))?)?/g;

    let resolved = condition;
    let match;

    // 创建一个作用域对象，包含所有步骤结果
    const scopeObject: Record<string, unknown> = {};

    for (const [stepId, result] of context.stepResults) {
      const resultValue = context.getStepResult(stepId);

      // 添加 step.{id} = resultValue
      scopeObject[`step${stepId}`] = resultValue;

      // 添加 step.{id}.result = resultValue
      scopeObject[`step${stepId}Result`] = resultValue;

      // 如果有嵌套字段，也添加到作用域
      if (resultValue !== null && resultValue !== undefined) {
        if (typeof resultValue === 'object') {
          const obj = resultValue as Record<string, unknown>;
          for (const [key, value] of Object.entries(obj)) {
            scopeObject[`step${stepId}${this.capitalize(key)}`] = value;
          }
        }
      }
    }

    // 添加变量
    for (const [name, value] of context.variables) {
      scopeObject[name] = value;
    }

    // 替换引用: step.1.result → step1Result
    resolved = condition.replace(stepRefPattern, (_, stepId: string, fieldPath?: string) => {
      if (fieldPath) {
        return `step${stepId}${this.capitalizeFieldPath(fieldPath)}`;
      }
      return `step${stepId}Result`;
    });

    return resolved;
  }

  /**
   * 获取参数名列表
   */
  private getParameterNames(condition: string): string[] {
    const paramSet = new Set<string>();

    // 提取所有 step{X}Result 和 step{XField} 模式的参数
    // 支持: step1Result, step1Count, step1UserName 等
    const stepPattern = /step(\d+)(Result|([A-Z][\w]*))/g;
    let match;

    while ((match = stepPattern.exec(condition)) !== null) {
      if (match[2]) {
        paramSet.add(`step${match[1]}${match[2]}`);
      }
    }

    // 添加变量引用
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((match = varPattern.exec(condition)) !== null) {
      const name = match[1];
      // 排除 JS 关键字和已知的步骤引用
      const keywords = ['return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'true', 'false', 'null', 'undefined', 'NaN', 'Infinity'];
      if (!keywords.includes(name) && !/^step\d+/.test(name)) {
        paramSet.add(name);
      }
    }

    return Array.from(paramSet);
  }

  /**
   * 获取参数值
   */
  private getArgumentValues(condition: string, context: ConditionContext): unknown[] {
    const paramNames = this.getParameterNames(condition);

    return paramNames.map((name) => {
      // 尝试从变量获取
      if (context.variables.has(name)) {
        return context.variables.get(name);
      }

      // 尝试从步骤结果获取
      const stepPattern = /^step(\d+)(?:Result|([A-Z][\w]*))$/;
      const match = name.match(stepPattern);
      if (match) {
        const stepId = parseInt(match[1], 10);
        const result = context.getStepResult(stepId);

        if (match[2]) {
          // 需要获取嵌套字段
          const fieldName = this.decapitalize(match[2]);
          return getNestedValue(result, fieldName);
        }

        return result;
      }

      return undefined;
    });
  }

  /**
   * 首字母大写
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * 首字母小写
   */
  private decapitalize(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * 转换字段路径为驼峰命名
   * 例如: user_name → UserName, result → Result
   */
  private capitalizeFieldPath(path: string): string {
    return path
      .split('.')
      .map((part) => this.capitalize(part))
      .join('');
  }
}
