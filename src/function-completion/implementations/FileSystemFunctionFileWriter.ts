import { promises as fs } from 'fs';
import path from 'path';
import type { FunctionFileWriter } from '../interfaces/FunctionFileWriter.js';

/**
 * Writes generated mock functions to the file system
 * Follows SRP: Only responsible for file I/O operations
 */
export class FileSystemFunctionFileWriterImpl implements FunctionFileWriter {
  constructor(private outputDirectory: string) {}

  /**
   * Ensure the output directory exists
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Write code to a file in the output directory
   */
  async write(code: string, fileName: string): Promise<string> {
    await this.ensureDirectory(this.outputDirectory);

    const filePath = path.join(this.outputDirectory, fileName);

    await fs.writeFile(filePath, code, 'utf-8');

    return filePath;
  }
}
