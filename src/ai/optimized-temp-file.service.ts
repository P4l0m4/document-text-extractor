import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface TempFileInfo {
  id: string;
  path: string;
  size: number;
  createdAt: Date;
  sessionId?: string;
  type: 'pdf' | 'image' | 'directory';
  cleanupScheduled: boolean;
}

export interface TempFileStats {
  totalFiles: number;
  totalSize: number;
  oldestFile: Date | null;
  newestFile: Date | null;
  byType: Record<string, number>;
  scheduledForCleanup: number;
}

@Injectable()
export class OptimizedTempFileService implements OnModuleDestroy {
  private readonly logger = new Logger(OptimizedTempFileService.name);
  
  private readonly tempFiles: Map<string, TempFileInfo> = new Map();
  private readonly cleanupQueue: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout;
  
  private readonly maxTempFiles: number;
  private readonly maxTempFileAge: number; // milliseconds
  private readonly maxTotalSize: number; // bytes
  private readonly cleanupIntervalMs: number;
  private readonly batchCleanupSize: number;

  constructor(private readonly configService: ConfigService) {
    this.maxTempFiles = this.configService.get<number>('TEMP_FILE_MAX_COUNT') || 100;
    this.maxTempFileAge = this.configService.get<number>('TEMP_FILE_MAX_AGE_MS') || 3600000; // 1 hour
    this.maxTotalSize = this.configService.get<number>('TEMP_FILE_MAX_SIZE_MB') || 500 * 1024 * 1024; // 500MB
    this.cleanupIntervalMs = this.configService.get<number>('TEMP_FILE_CLEANUP_INTERVAL_MS') || 300000; // 5 minutes
    this.batchCleanupSize = this.configService.get<number>('TEMP_FILE_BATCH_CLEANUP_SIZE') || 10;

    this.startPeriodicCleanup();
    this.logConfiguration();
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Emergency cleanup on shutdown
    await this.emergencyCleanup();
  }

  /**
   * Create a unique temporary file path
   */
  createTempFilePath(extension: string, sessionId?: string): string {
    const tempDir = this.configService.get<string>('TEMP_DIR') || '/tmp/document-processing';
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const filename = `temp_${timestamp}_${random}${extension}`;
    
    return path.join(tempDir, filename);
  }

  /**
   * Create a unique temporary directory path
   */
  createTempDirPath(sessionId?: string): string {
    const tempDir = this.configService.get<string>('TEMP_DIR') || '/tmp/document-processing';
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const dirname = `temp_dir_${timestamp}_${random}`;
    
    return path.join(tempDir, dirname);
  }

  /**
   * Register a temporary file for tracking and cleanup
   */
  async registerTempFile(
    filePath: string, 
    type: TempFileInfo['type'] = 'image', 
    sessionId?: string
  ): Promise<string> {
    const fileId = crypto.randomBytes(16).toString('hex');
    
    try {
      // Get file size for tracking
      const stats = await fs.stat(filePath);
      
      const tempFileInfo: TempFileInfo = {
        id: fileId,
        path: filePath,
        size: stats.size,
        createdAt: new Date(),
        sessionId,
        type,
        cleanupScheduled: false,
      };

      this.tempFiles.set(fileId, tempFileInfo);
      
      this.logger.debug(`📁 Registered temp file: ${path.basename(filePath)} (${this.formatBytes(stats.size)}) [${fileId}]`);
      
      // Check if we need immediate cleanup due to limits
      await this.checkLimitsAndCleanup();
      
      return fileId;
    } catch (error) {
      this.logger.warn(`⚠️ Failed to register temp file ${filePath}: ${error.message}`);
      return fileId; // Return ID anyway for cleanup attempts
    }
  }

  /**
   * Register a temporary directory for tracking and cleanup
   */
  async registerTempDirectory(dirPath: string, sessionId?: string): Promise<string> {
    const dirId = crypto.randomBytes(16).toString('hex');
    
    try {
      // Calculate directory size
      const size = await this.calculateDirectorySize(dirPath);
      
      const tempDirInfo: TempFileInfo = {
        id: dirId,
        path: dirPath,
        size,
        createdAt: new Date(),
        sessionId,
        type: 'directory',
        cleanupScheduled: false,
      };

      this.tempFiles.set(dirId, tempDirInfo);
      
      this.logger.debug(`📂 Registered temp directory: ${path.basename(dirPath)} (${this.formatBytes(size)}) [${dirId}]`);
      
      // Check if we need immediate cleanup due to limits
      await this.checkLimitsAndCleanup();
      
      return dirId;
    } catch (error) {
      this.logger.warn(`⚠️ Failed to register temp directory ${dirPath}: ${error.message}`);
      return dirId; // Return ID anyway for cleanup attempts
    }
  }

  /**
   * Schedule a temporary file for cleanup
   */
  scheduleCleanup(fileId: string, delay: number = 0): void {
    const tempFile = this.tempFiles.get(fileId);
    if (!tempFile) {
      this.logger.warn(`⚠️ Cannot schedule cleanup for unknown temp file: ${fileId}`);
      return;
    }

    if (tempFile.cleanupScheduled) {
      this.logger.debug(`📋 Temp file already scheduled for cleanup: ${fileId}`);
      return;
    }

    tempFile.cleanupScheduled = true;
    
    if (delay > 0) {
      setTimeout(() => {
        this.cleanupQueue.add(fileId);
      }, delay);
      this.logger.debug(`⏰ Scheduled temp file cleanup in ${delay}ms: ${path.basename(tempFile.path)}`);
    } else {
      this.cleanupQueue.add(fileId);
      this.logger.debug(`📋 Scheduled immediate temp file cleanup: ${path.basename(tempFile.path)}`);
    }
  }

  /**
   * Immediately cleanup a specific temporary file
   */
  async cleanupTempFile(fileId: string): Promise<boolean> {
    const tempFile = this.tempFiles.get(fileId);
    if (!tempFile) {
      this.logger.debug(`🔍 Temp file not found for cleanup: ${fileId}`);
      return false;
    }

    try {
      if (tempFile.type === 'directory') {
        await this.cleanupDirectory(tempFile.path);
      } else {
        await this.cleanupFile(tempFile.path);
      }
      
      this.tempFiles.delete(fileId);
      this.cleanupQueue.delete(fileId);
      
      this.logger.debug(`✅ Cleaned up temp ${tempFile.type}: ${path.basename(tempFile.path)} (${this.formatBytes(tempFile.size)})`);
      return true;
    } catch (error) {
      this.logger.warn(`⚠️ Failed to cleanup temp ${tempFile.type} ${tempFile.path}: ${error.message}`);
      return false;
    }
  }

  /**
   * Cleanup multiple temporary files by session ID
   */
  async cleanupBySession(sessionId: string): Promise<number> {
    const sessionFiles = Array.from(this.tempFiles.values())
      .filter(file => file.sessionId === sessionId);

    if (sessionFiles.length === 0) {
      this.logger.debug(`🔍 No temp files found for session: ${sessionId}`);
      return 0;
    }

    this.logger.log(`🧹 Cleaning up ${sessionFiles.length} temp files for session: ${sessionId}`);
    
    let cleanedCount = 0;
    const cleanupPromises = sessionFiles.map(async (file) => {
      const success = await this.cleanupTempFile(file.id);
      if (success) cleanedCount++;
    });

    await Promise.all(cleanupPromises);
    
    this.logger.log(`✅ Cleaned up ${cleanedCount}/${sessionFiles.length} temp files for session: ${sessionId}`);
    return cleanedCount;
  }

  /**
   * Get temporary file statistics
   */
  getTempFileStats(): TempFileStats {
    const files = Array.from(this.tempFiles.values());
    
    if (files.length === 0) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
        byType: {},
        scheduledForCleanup: 0,
      };
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const dates = files.map(file => file.createdAt);
    const byType = files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const scheduledForCleanup = files.filter(file => file.cleanupScheduled).length;

    return {
      totalFiles: files.length,
      totalSize,
      oldestFile: new Date(Math.min(...dates.map(d => d.getTime()))),
      newestFile: new Date(Math.max(...dates.map(d => d.getTime()))),
      byType,
      scheduledForCleanup,
    };
  }

  /**
   * Start periodic cleanup process
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.performPeriodicCleanup();
    }, this.cleanupIntervalMs);

    this.logger.log(`🔄 Started periodic temp file cleanup (${this.cleanupIntervalMs}ms interval)`);
  }

  /**
   * Perform periodic cleanup of old and queued files
   */
  private async performPeriodicCleanup(): Promise<void> {
    const startTime = Date.now();
    let cleanedCount = 0;

    try {
      // Process cleanup queue first (batch processing)
      const queuedFiles = Array.from(this.cleanupQueue).slice(0, this.batchCleanupSize);
      
      for (const fileId of queuedFiles) {
        const success = await this.cleanupTempFile(fileId);
        if (success) cleanedCount++;
      }

      // Clean up old files that exceed age limit
      const now = Date.now();
      const oldFiles = Array.from(this.tempFiles.values())
        .filter(file => !file.cleanupScheduled && (now - file.createdAt.getTime()) > this.maxTempFileAge)
        .slice(0, this.batchCleanupSize - queuedFiles.length);

      for (const file of oldFiles) {
        const success = await this.cleanupTempFile(file.id);
        if (success) cleanedCount++;
      }

      const duration = Date.now() - startTime;
      
      if (cleanedCount > 0) {
        this.logger.log(`🧹 Periodic cleanup completed: ${cleanedCount} files cleaned in ${duration}ms`);
      } else {
        this.logger.debug(`🔍 Periodic cleanup completed: no files to clean (${duration}ms)`);
      }

    } catch (error) {
      this.logger.error(`❌ Error during periodic cleanup: ${error.message}`);
    }
  }

  /**
   * Check limits and perform immediate cleanup if necessary
   */
  private async checkLimitsAndCleanup(): Promise<void> {
    const stats = this.getTempFileStats();
    
    // Check file count limit
    if (stats.totalFiles > this.maxTempFiles) {
      const excess = stats.totalFiles - this.maxTempFiles;
      this.logger.warn(`⚠️ Temp file count limit exceeded: ${stats.totalFiles}/${this.maxTempFiles} (excess: ${excess})`);
      await this.cleanupOldestFiles(excess);
    }

    // Check total size limit
    if (stats.totalSize > this.maxTotalSize) {
      const excessMB = (stats.totalSize - this.maxTotalSize) / 1024 / 1024;
      this.logger.warn(`⚠️ Temp file size limit exceeded: ${this.formatBytes(stats.totalSize)}/${this.formatBytes(this.maxTotalSize)} (excess: ${excessMB.toFixed(1)}MB)`);
      await this.cleanupLargestFiles(Math.ceil(excessMB / 10)); // Estimate files to clean
    }
  }

  /**
   * Cleanup oldest files
   */
  private async cleanupOldestFiles(count: number): Promise<void> {
    const files = Array.from(this.tempFiles.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, count);

    this.logger.log(`🧹 Cleaning up ${files.length} oldest temp files`);
    
    for (const file of files) {
      await this.cleanupTempFile(file.id);
    }
  }

  /**
   * Cleanup largest files
   */
  private async cleanupLargestFiles(count: number): Promise<void> {
    const files = Array.from(this.tempFiles.values())
      .sort((a, b) => b.size - a.size)
      .slice(0, count);

    this.logger.log(`🧹 Cleaning up ${files.length} largest temp files`);
    
    for (const file of files) {
      await this.cleanupTempFile(file.id);
    }
  }

  /**
   * Emergency cleanup on shutdown
   */
  private async emergencyCleanup(): Promise<void> {
    const files = Array.from(this.tempFiles.values());
    
    if (files.length === 0) {
      this.logger.log('🔍 No temp files to clean up on shutdown');
      return;
    }

    this.logger.log(`🚨 Emergency cleanup: removing ${files.length} temp files`);
    
    const cleanupPromises = files.map(file => this.cleanupTempFile(file.id));
    await Promise.allSettled(cleanupPromises);
    
    this.logger.log('✅ Emergency cleanup completed');
  }

  /**
   * Cleanup a single file
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') { // Ignore "file not found" errors
        throw error;
      }
    }
  }

  /**
   * Cleanup a directory and all its contents
   */
  private async cleanupDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') { // Ignore "directory not found" errors
        throw error;
      }
    }
  }

  /**
   * Calculate total size of a directory
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let totalSize = 0;

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        } else if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        }
      }

      return totalSize;
    } catch (error) {
      this.logger.warn(`⚠️ Failed to calculate directory size for ${dirPath}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Log configuration on startup
   */
  private logConfiguration(): void {
    this.logger.log('📁 Optimized Temp File Service Configuration:');
    this.logger.log(`   Max Files: ${this.maxTempFiles}`);
    this.logger.log(`   Max Age: ${this.maxTempFileAge / 1000}s`);
    this.logger.log(`   Max Total Size: ${this.formatBytes(this.maxTotalSize)}`);
    this.logger.log(`   Cleanup Interval: ${this.cleanupIntervalMs / 1000}s`);
    this.logger.log(`   Batch Cleanup Size: ${this.batchCleanupSize}`);
  }

  /**
   * Log comprehensive temp file summary
   */
  logTempFileSummary(): void {
    const stats = this.getTempFileStats();
    
    this.logger.log('📁 === TEMPORARY FILE MANAGEMENT SUMMARY ===');
    this.logger.log(`📊 Total Files: ${stats.totalFiles}`);
    this.logger.log(`💾 Total Size: ${this.formatBytes(stats.totalSize)}`);
    this.logger.log(`📋 Scheduled for Cleanup: ${stats.scheduledForCleanup}`);
    
    if (stats.oldestFile && stats.newestFile) {
      const oldestAge = (Date.now() - stats.oldestFile.getTime()) / 1000;
      this.logger.log(`⏰ Oldest File: ${oldestAge.toFixed(0)}s ago`);
    }
    
    this.logger.log('📂 By Type:');
    Object.entries(stats.byType).forEach(([type, count]) => {
      this.logger.log(`   ${type}: ${count}`);
    });
    
    // Check against limits
    const fileCountPercent = (stats.totalFiles / this.maxTempFiles) * 100;
    const sizePercent = (stats.totalSize / this.maxTotalSize) * 100;
    
    this.logger.log('🎯 Limit Usage:');
    this.logger.log(`   File Count: ${fileCountPercent.toFixed(1)}% (${stats.totalFiles}/${this.maxTempFiles})`);
    this.logger.log(`   Total Size: ${sizePercent.toFixed(1)}% (${this.formatBytes(stats.totalSize)}/${this.formatBytes(this.maxTotalSize)})`);
    
    this.logger.log('='.repeat(50));
  }
}