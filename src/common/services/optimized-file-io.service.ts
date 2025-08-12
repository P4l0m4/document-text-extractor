import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import { promisify } from 'util';
import { FileSystemException } from '../exceptions';

const pipeline = promisify(stream.pipeline);

export interface FileOperationOptions {
  bufferSize?: number;
  encoding?: BufferEncoding;
  flags?: string;
  mode?: number;
  highWaterMark?: number;
}

export interface FileStats {
  size: number;
  mtime: Date;
  isFile: boolean;
  isDirectory: boolean;
}

@Injectable()
export class OptimizedFileIOService {
  private readonly logger = new Logger(OptimizedFileIOService.name);
  private readonly defaultBufferSize: number = 64 * 1024; // 64KB
  private readonly maxConcurrentOperations: number;
  private currentOperations: number = 0;
  private readonly operationQueue: Array<() => Promise<any>> = [];

  constructor(private readonly configService: ConfigService) {
    this.maxConcurrentOperations =
      this.configService.get<number>('app.maxConcurrentJobs') || 10;
  }

  /**
   * Read file with optimized streaming for large files
   */
  async readFileOptimized(
    filePath: string,
    options: FileOperationOptions = {},
  ): Promise<Buffer> {
    return this.executeWithConcurrencyControl(async () => {
      const startTime = Date.now();

      try {
        const stats = await this.getFileStats(filePath);

        // For small files, use regular readFile
        if (stats.size < this.defaultBufferSize) {
          const data = await fs.promises.readFile(filePath);
          this.logger.debug(
            `Read small file ${filePath} (${stats.size} bytes) in ${Date.now() - startTime}ms`,
          );
          return data;
        }

        // For large files, use streaming with optimized buffer size
        const bufferSize =
          options.bufferSize || this.calculateOptimalBufferSize(stats.size);
        const chunks: Buffer[] = [];

        const readStream = fs.createReadStream(filePath, {
          highWaterMark: bufferSize,
          ...options,
        });

        return new Promise<Buffer>((resolve, reject) => {
          readStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          readStream.on('end', () => {
            const result = Buffer.concat(chunks);
            this.logger.debug(
              `Read large file ${filePath} (${stats.size} bytes) in ${Date.now() - startTime}ms using ${bufferSize} byte buffer`,
            );
            resolve(result);
          });

          readStream.on('error', (error) => {
            this.logger.error(`Error reading file ${filePath}:`, error);
            reject(new FileSystemException('read file', filePath));
          });
        });
      } catch (error) {
        this.logger.error(`Failed to read file ${filePath}:`, error);
        throw new FileSystemException('read file', filePath);
      }
    });
  }

  /**
   * Write file with optimized streaming for large data
   */
  async writeFileOptimized(
    filePath: string,
    data: Buffer | string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    return this.executeWithConcurrencyControl(async () => {
      const startTime = Date.now();

      try {
        // Ensure directory exists
        await this.ensureDirectoryExists(path.dirname(filePath));

        const dataBuffer = Buffer.isBuffer(data)
          ? data
          : Buffer.from(data, options.encoding || 'utf8');

        // For small files, use regular writeFile
        if (dataBuffer.length < this.defaultBufferSize) {
          await fs.promises.writeFile(filePath, dataBuffer, options);
          this.logger.debug(
            `Wrote small file ${filePath} (${dataBuffer.length} bytes) in ${Date.now() - startTime}ms`,
          );
          return;
        }

        // For large files, use streaming
        const bufferSize =
          options.bufferSize ||
          this.calculateOptimalBufferSize(dataBuffer.length);
        const writeStream = fs.createWriteStream(filePath, {
          highWaterMark: bufferSize,
          ...options,
        });

        const readableStream = new stream.Readable({
          read() {
            // No-op, we'll push data manually
          },
        });

        // Push data in chunks
        let offset = 0;
        while (offset < dataBuffer.length) {
          const chunk = dataBuffer.slice(offset, offset + bufferSize);
          readableStream.push(chunk);
          offset += bufferSize;
        }
        readableStream.push(null); // End the stream

        await pipeline(readableStream, writeStream);

        this.logger.debug(
          `Wrote large file ${filePath} (${dataBuffer.length} bytes) in ${Date.now() - startTime}ms using ${bufferSize} byte buffer`,
        );
      } catch (error) {
        this.logger.error(`Failed to write file ${filePath}:`, error);
        throw new FileSystemException('write file', filePath);
      }
    });
  }

  /**
   * Copy file with optimized streaming
   */
  async copyFileOptimized(
    sourcePath: string,
    destinationPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    return this.executeWithConcurrencyControl(async () => {
      const startTime = Date.now();

      try {
        const stats = await this.getFileStats(sourcePath);

        // Ensure destination directory exists
        await this.ensureDirectoryExists(path.dirname(destinationPath));

        const bufferSize =
          options.bufferSize || this.calculateOptimalBufferSize(stats.size);

        const readStream = fs.createReadStream(sourcePath, {
          highWaterMark: bufferSize,
        });

        const writeStream = fs.createWriteStream(destinationPath, {
          highWaterMark: bufferSize,
          ...options,
        });

        await pipeline(readStream, writeStream);

        this.logger.debug(
          `Copied file ${sourcePath} to ${destinationPath} (${stats.size} bytes) in ${Date.now() - startTime}ms`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to copy file from ${sourcePath} to ${destinationPath}:`,
          error,
        );
        throw new FileSystemException('copy file', sourcePath);
      }
    });
  }

  /**
   * Move file with optimization
   */
  async moveFileOptimized(
    sourcePath: string,
    destinationPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    return this.executeWithConcurrencyControl(async () => {
      const startTime = Date.now();

      try {
        // Ensure destination directory exists
        await this.ensureDirectoryExists(path.dirname(destinationPath));

        // Try rename first (fastest for same filesystem)
        try {
          await fs.promises.rename(sourcePath, destinationPath);
          this.logger.debug(
            `Moved file ${sourcePath} to ${destinationPath} via rename in ${Date.now() - startTime}ms`,
          );
          return;
        } catch (renameError) {
          // If rename fails (different filesystems), fall back to copy + delete
          this.logger.debug(
            `Rename failed, falling back to copy+delete: ${renameError.message}`,
          );
        }

        // Copy then delete
        await this.copyFileOptimized(sourcePath, destinationPath, options);
        await this.deleteFileOptimized(sourcePath);

        this.logger.debug(
          `Moved file ${sourcePath} to ${destinationPath} via copy+delete in ${Date.now() - startTime}ms`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to move file from ${sourcePath} to ${destinationPath}:`,
          error,
        );
        throw new FileSystemException('move file', sourcePath);
      }
    });
  }

  /**
   * Delete file with error handling
   */
  async deleteFileOptimized(filePath: string): Promise<void> {
    return this.executeWithConcurrencyControl(async () => {
      const startTime = Date.now();

      try {
        await fs.promises.unlink(filePath);
        this.logger.debug(
          `Deleted file ${filePath} in ${Date.now() - startTime}ms`,
        );
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.logger.debug(
            `File ${filePath} already deleted or doesn't exist`,
          );
          return;
        }
        this.logger.error(`Failed to delete file ${filePath}:`, error);
        throw new FileSystemException('delete file', filePath);
      }
    });
  }

  /**
   * Get file statistics
   */
  async getFileStats(filePath: string): Promise<FileStats> {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for ${filePath}:`, error);
      throw new FileSystemException('get file stats', filePath);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        this.logger.error(`Failed to create directory ${dirPath}:`, error);
        throw new FileSystemException('create directory', dirPath);
      }
    }
  }

  /**
   * Clean up multiple files concurrently
   */
  async cleanupFiles(filePaths: string[]): Promise<void> {
    const cleanupPromises = filePaths.map((filePath) =>
      this.deleteFileOptimized(filePath).catch((error) => {
        this.logger.warn(`Failed to cleanup file ${filePath}:`, error);
        // Don't throw, just log the warning
      }),
    );

    await Promise.all(cleanupPromises);
    this.logger.debug(`Cleaned up ${filePaths.length} files`);
  }

  /**
   * Calculate optimal buffer size based on file size
   */
  private calculateOptimalBufferSize(fileSize: number): number {
    // Use larger buffers for larger files, but cap at 1MB
    if (fileSize < 1024 * 1024) {
      // < 1MB
      return 16 * 1024; // 16KB
    } else if (fileSize < 10 * 1024 * 1024) {
      // < 10MB
      return 64 * 1024; // 64KB
    } else if (fileSize < 100 * 1024 * 1024) {
      // < 100MB
      return 256 * 1024; // 256KB
    } else {
      return 1024 * 1024; // 1MB
    }
  }

  /**
   * Execute operation with concurrency control
   */
  private async executeWithConcurrencyControl<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.currentOperations >= this.maxConcurrentOperations) {
      // Queue the operation
      return new Promise((resolve, reject) => {
        this.operationQueue.push(async () => {
          try {
            const result = await operation();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    this.currentOperations++;

    try {
      const result = await operation();
      return result;
    } finally {
      this.currentOperations--;

      // Process next operation in queue
      if (this.operationQueue.length > 0) {
        const nextOperation = this.operationQueue.shift();
        if (nextOperation) {
          // Execute without awaiting to avoid blocking
          nextOperation().catch((error) => {
            this.logger.error('Queued file operation failed:', error);
          });
        }
      }
    }
  }

  /**
   * Get current I/O statistics
   */
  getIOStats() {
    return {
      currentOperations: this.currentOperations,
      queuedOperations: this.operationQueue.length,
      maxConcurrentOperations: this.maxConcurrentOperations,
      utilizationRate:
        (this.currentOperations / this.maxConcurrentOperations) * 100,
    };
  }
}
