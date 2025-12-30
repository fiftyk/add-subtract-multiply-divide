/**
 * Interface for writing generated code to files
 * Responsibility: Handle file system operations for saving functions
 */
export interface FunctionFileWriter {
  /**
   * Write code to a file
   * @param code - The code content to write
   * @param fileName - The file name (not full path)
   * @returns The absolute path of the created file
   */
  write(code: string, fileName: string): Promise<string>;

  /**
   * Ensure a directory exists
   * @param path - Directory path
   */
  ensureDirectory(path: string): Promise<void>;
}

export const FunctionFileWriter = Symbol('FunctionFileWriter');
