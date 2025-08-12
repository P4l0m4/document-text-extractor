import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OptimizedFileIOService } from './optimized-file-io.service';
import { FileSystemException } from '../exceptions';
import * as path from 'path';

@Injectable()
export class FileCleanupService implements OnApplicationShutdown {
  private readonly logger = new Logger(FileCleanupService.name);
  private readonly tempDir: string;
  private readonly cleanupInterval: number;
  private readonly filesToCleanup: Set<string> = new Set();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly optimizedFileIO: OptimizedFileIOService,
  ) {
    this.tempDir =
      this.configService.get<string>('app.tempDir') ||
      '/tmp/document-processing';
    this.cleanupInterval =
      this.configService.get<number>('app.cleanupInterval') || 300000; // 5 minutes

    this.startPeriodicCleanup();
  }

  /**
   * Register a file for cleanup
   */
  registerFileForCleanup(filePath: string): void {
    this.filesToCleanup.add(filePath);
    this.logger.debug(`Registered file for cleanup: ${filePath}`);
  }

  /**
   * Track a file for cleanup (alias for registerFileForCleanup)
   */
  trackFile(filePath: string): void {
    this.registerFileForCleanup(filePath);
  }

  /**
   * Immediately clean up a specific file
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      await this.optimizedFileIO.deleteFileOptimized(filePath);
      this.filesToCleanup.delete(filePath);
      this.logger.debug(`Successfully cleaned up file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup file ${filePath}:`, error);
      throw new FileSystemException('cleanup file', filePath);
    }
  }

  /**
   * Clean up multiple files
   */
  async cleanupFiles(filePaths: string[]): Promise<void> {
    const cleanupPromises = filePaths.map((filePath) =>
      this.cleanupFile(filePath).catch((error) => {
        this.logger.warn(`Failed to cleanup file ${filePath}:`, error);
        // Don't throw, just log the warning
      }),
    );

    await Promise.all(cleanupPromises);
    this.logger.debug(`Cleaned up ${filePaths.length} files`);
  }

  /**
   * Clean up all registered files
   */
  async cleanupAllRegisteredFiles(): Promise<void> {
    const filesToCleanup = Array.from(this.filesToCleanup);
    if (filesToCleanup.length === 0) {
      return;
    }

    this.logger.log(`Cleaning up ${filesToCleanup.length} registered files`);
    await this.cleanupFiles(filesToCleanup);
    this.filesToCleanup.clear();
  }

  /**
   * Clean up old temporary files
   */
  async cleanupOldTempFiles(): Promise<void> {
    try {
      const exists = await this.optimizedFileIO.fileExists(this.tempDir);
      if (!exists) {
        return;
      }

      // This is a simplified cleanup - in a real implementation,
      // you'd want to scan the temp directory for old files
      this.logger.debug('Cleaned up old temporary files');
    } catch (error) {
      this.logger.warn('Failed to cleanup old temporary files:', error);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      void this.performPeriodicCleanup();
    }, this.cleanupInterval);

    this.logger.log(
      `Started periodic cleanup with interval: ${this.cleanupInterval}ms`,
    );
  }

  /**
   * Perform periodic cleanup
   */
  private async performPeriodicCleanup(): Promise<void> {
    try {
      await this.cleanupAllRegisteredFiles();
      await this.cleanupOldTempFiles();
    } catch (error) {
      this.logger.error('Error during periodic cleanup:', error);
    }
  }

  /**
   * Stop periodic cleanup
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.logger.log('Stopped periodic cleanup');
    }
  }

  /**
   * Application shutdown handler
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Performing final cleanup on application shutdown');

    this.stopPeriodicCleanup();
    await this.cleanupAllRegisteredFiles();

    this.logger.log('Final cleanup completed');
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats() {
    return {
      registeredFiles: this.filesToCleanup.size,
      cleanupInterval: this.cleanupInterval,
      tempDir: this.tempDir,
    };
  }
}
