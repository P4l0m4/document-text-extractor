import { Injectable, Logger } from '@nestjs/common';

export interface ProcessingLogEntry {
  taskId: string;
  operation: string;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  fileSize?: number;
  fileName?: string;
  error?: string;
  timestamp: string;
}

@Injectable()
export class ProcessingLoggerService {
  private readonly logger = new Logger(ProcessingLoggerService.name);
  private processingLogs: ProcessingLogEntry[] = [];
  private readonly maxLogEntries = 1000; // Keep last 1000 entries

  logProcessingStart(taskId: string, fileName: string, fileSize: number): void {
    const entry: ProcessingLogEntry = {
      taskId,
      operation: 'document_processing',
      status: 'started',
      fileName,
      fileSize,
      timestamp: new Date().toISOString(),
    };

    this.addLogEntry(entry);
    this.logger.log(
      `Processing started for task ${taskId} - File: ${fileName} (${fileSize} bytes)`,
    );
  }

  logProcessingComplete(taskId: string, duration: number): void {
    const entry: ProcessingLogEntry = {
      taskId,
      operation: 'document_processing',
      status: 'completed',
      duration,
      timestamp: new Date().toISOString(),
    };

    this.addLogEntry(entry);
    this.logger.log(`Processing completed for task ${taskId} in ${duration}ms`);
  }

  logProcessingError(taskId: string, error: string, duration?: number): void {
    const entry: ProcessingLogEntry = {
      taskId,
      operation: 'document_processing',
      status: 'failed',
      duration,
      error,
      timestamp: new Date().toISOString(),
    };

    this.addLogEntry(entry);
    this.logger.error(
      `Processing failed for task ${taskId}: ${error}${duration ? ` (after ${duration}ms)` : ''}`,
    );
  }

  logUpload(taskId: string, fileName: string, fileSize: number): void {
    const entry: ProcessingLogEntry = {
      taskId,
      operation: 'file_upload',
      status: 'completed',
      fileName,
      fileSize,
      timestamp: new Date().toISOString(),
    };

    this.addLogEntry(entry);
    this.logger.log(
      `File uploaded for task ${taskId} - File: ${fileName} (${fileSize} bytes)`,
    );
  }

  logCleanup(taskId: string, fileName?: string): void {
    const entry: ProcessingLogEntry = {
      taskId,
      operation: 'file_cleanup',
      status: 'completed',
      fileName,
      timestamp: new Date().toISOString(),
    };

    this.addLogEntry(entry);
    this.logger.log(
      `File cleanup completed for task ${taskId}${fileName ? ` - File: ${fileName}` : ''}`,
    );
  }

  getRecentLogs(limit: number = 100): ProcessingLogEntry[] {
    return this.processingLogs.slice(-limit);
  }

  getLogsByTaskId(taskId: string): ProcessingLogEntry[] {
    return this.processingLogs.filter((log) => log.taskId === taskId);
  }

  getProcessingStats(): {
    totalProcessed: number;
    successfulProcessing: number;
    failedProcessing: number;
    averageProcessingTime: number;
    recentActivity: ProcessingLogEntry[];
  } {
    const processingLogs = this.processingLogs.filter(
      (log) => log.operation === 'document_processing',
    );
    const completedLogs = processingLogs.filter(
      (log) => log.status === 'completed' && log.duration,
    );

    const totalProcessed = processingLogs.length;
    const successfulProcessing = processingLogs.filter(
      (log) => log.status === 'completed',
    ).length;
    const failedProcessing = processingLogs.filter(
      (log) => log.status === 'failed',
    ).length;

    const averageProcessingTime =
      completedLogs.length > 0
        ? completedLogs.reduce((sum, log) => sum + (log.duration || 0), 0) /
          completedLogs.length
        : 0;

    return {
      totalProcessed,
      successfulProcessing,
      failedProcessing,
      averageProcessingTime: Math.round(averageProcessingTime),
      recentActivity: this.getRecentLogs(10),
    };
  }

  private addLogEntry(entry: ProcessingLogEntry): void {
    this.processingLogs.push(entry);

    // Keep only the most recent entries
    if (this.processingLogs.length > this.maxLogEntries) {
      this.processingLogs = this.processingLogs.slice(-this.maxLogEntries);
    }
  }
}
