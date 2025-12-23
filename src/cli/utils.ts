import * as path from 'path';
import type { FunctionRegistry, FunctionDefinition } from '../registry/index.js';

/**
 * 加载函数定义文件
 */
export async function loadFunctions(
  registry: FunctionRegistry,
  functionsPath: string
): Promise<void> {
  try {
    // 转换为绝对路径
    const absolutePath = path.isAbsolute(functionsPath)
      ? functionsPath
      : path.resolve(process.cwd(), functionsPath);

    // 动态导入函数模块
    const module = await import(absolutePath);

    // 注册所有导出的函数
    for (const key of Object.keys(module)) {
      const fn = module[key];
      if (isFunctionDefinition(fn)) {
        registry.register(fn);
      }
    }
  } catch (error) {
    // 如果文件不存在，静默处理
    if (
      error instanceof Error &&
      error.message.includes('Cannot find module')
    ) {
      return;
    }
    throw error;
  }
}

/**
 * 检查是否是有效的函数定义
 */
function isFunctionDefinition(obj: unknown): obj is FunctionDefinition {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const fn = obj as Record<string, unknown>;
  return (
    typeof fn.name === 'string' &&
    typeof fn.description === 'string' &&
    typeof fn.scenario === 'string' &&
    Array.isArray(fn.parameters) &&
    typeof fn.returns === 'object' &&
    typeof fn.implementation === 'function'
  );
}
