import * as path from 'path';
import { promises as fs } from 'fs';
import { pathToFileURL } from 'url';
import type { FunctionDefinition } from '../registry/types.js';
import type { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';

/**
 * 加载函数定义文件
 */
export async function loadFunctions(
  provider: FunctionProvider,
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
        provider.register?.(fn);
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

/**
 * 加载目录下所有 .js 文件中的函数定义
 */
export async function loadFunctionsFromDirectory(
  provider: FunctionProvider,
  dirPath: string
): Promise<void> {
  try {
    // 转换为绝对路径
    const absolutePath = path.isAbsolute(dirPath)
      ? dirPath
      : path.resolve(process.cwd(), dirPath);

    // 检查目录是否存在
    try {
      await fs.access(absolutePath);
    } catch {
      // 目录不存在，静默返回
      return;
    }

    // 读取目录内容
    const files = await fs.readdir(absolutePath);

    // 过滤出 .js 文件
    const jsFiles = files.filter((file) => file.endsWith('.js'));

    // 加载每个文件
    for (const file of jsFiles) {
      const filePath = path.join(absolutePath, file);
      try {
        // 使用 pathToFileURL 和 cache busting 进行动态导入
        const fileUrl = pathToFileURL(filePath).href;
        const moduleUrl = `${fileUrl}?t=${Date.now()}`;
        const module = await import(moduleUrl);

        // 注册所有导出的函数
        for (const key of Object.keys(module)) {
          const fn = module[key];
          if (isFunctionDefinition(fn)) {
            // 检查是否已存在，避免重复注册错误
            if (await provider.has(fn.name)) {
              continue;
            }
            provider.register?.(fn);
          }
        }
      } catch (error) {
        // 单个文件加载失败时继续处理其他文件
        console.warn(`Warning: Failed to load ${file}:`, error);
      }
    }
  } catch (error) {
    // 目录读取失败，静默处理
    if (
      error instanceof Error &&
      error.message.includes('ENOENT')
    ) {
      return;
    }
    throw error;
  }
}
