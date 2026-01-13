/**
 * Auto-load Functions Utility
 *
 * Automatically discovers and loads all function modules from the functions directory.
 * Supports files that export `registerXxxFunctions` or `xxxFunctions` as default.
 */

import { readdirSync, statSync } from 'fs';
import { join, parse } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Auto-load all functions from the functions directory
 *
 * @param functionsDir - Directory containing function modules
 * @param registerFn - Function to register each loaded function
 */
export async function autoLoadFunctions(
  functionsDir: string,
  registerFn: (fn: any) => void
): Promise<number> {
  const loadedCount = { value: 0 };

  try {
    // Check if directory exists
    const dirExists = statSync(functionsDir).isDirectory();
    if (!dirExists) {
      console.log(`[AutoLoadFunctions] Functions directory not found: ${functionsDir}`);
      return 0;
    }

    const files = readdirSync(functionsDir);
    const tsFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));

    console.log(`[AutoLoadFunctions] Found ${tsFiles.length} function files in ${functionsDir}`);

    for (const file of tsFiles) {
      const filePath = join(functionsDir, file);
      const fileStat = statSync(filePath);

      if (fileStat.isFile()) {
        await loadFunctionModule(file, filePath, registerFn, loadedCount);
      }
    }

    console.log(`[AutoLoadFunctions] Loaded ${loadedCount.value} functions from ${functionsDir}`);
    return loadedCount.value;
  } catch (error) {
    console.error(`[AutoLoadFunctions] Error loading functions from ${functionsDir}:`, error);
    return 0;
  }
}

/**
 * Load a single function module
 */
async function loadFunctionModule(
  fileName: string,
  filePath: string,
  registerFn: (fn: any) => void,
  loadedCount: { value: number }
): Promise<void> {
  try {
    // Dynamic import the module
    const module = await import(filePath + '?t=' + Date.now());

    // Try to find register function (registerXxxFunctions pattern)
    const registerFnName = Object.keys(module).find(
      key => key.startsWith('register') && key.endsWith('Functions')
    );

    if (registerFnName && typeof module[registerFnName] === 'function') {
      module[registerFnName](registerFn);
      console.log(`[AutoLoadFunctions] Registered functions from: ${fileName}`);
      loadedCount.value++;
      return;
    }

    // Try to find default export that is an array of functions
    if (module.default && Array.isArray(module.default)) {
      for (const fn of module.default) {
        registerFn(fn);
      }
      console.log(`[AutoLoadFunctions] Registered functions from default export: ${fileName}`);
      loadedCount.value++;
      return;
    }

    // Try to find named export that is an array of functions
    const arrayExportName = Object.keys(module).find(
      key => Array.isArray(module[key]) && key.endsWith('Functions')
    );

    if (arrayExportName && Array.isArray(module[arrayExportName])) {
      for (const fn of module[arrayExportName]) {
        registerFn(fn);
      }
      console.log(`[AutoLoadFunctions] Registered functions from: ${fileName}`);
      loadedCount.value++;
      return;
    }

    console.warn(`[AutoLoadFunctions] No functions found in: ${fileName}`);
  } catch (error) {
    console.error(`[AutoLoadFunctions] Error loading module ${fileName}:`, error);
  }
}

/**
 * Get the functions directory path
 * Resolves relative to the caller or uses a default path
 */
export function getFunctionsDir(callerDir?: string): string {
  const defaultDir = join(__dirname, '../functions');

  if (callerDir) {
    const callerFunctionsDir = join(callerDir, 'functions');
    try {
      if (statSync(callerFunctionsDir).isDirectory()) {
        return callerFunctionsDir;
      }
    } catch {
      // Directory doesn't exist, use default
    }
  }

  return defaultDir;
}
