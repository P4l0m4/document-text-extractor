import { Injectable, Logger } from '@nestjs/common';
import { AiModelService } from '../ai/ai-model.service';
import { AiModelPoolService } from '../ai/ai-model-pool.service';
import { TaskService } from '../task/task.service';
import {
  ProcessingResult,
  TaskStatus,
} from '../common/interfaces/task.interface';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import { PerformanceMonitorService } from '../common/monitoring/performance-monitor.service';
import { OptimizedFileIOService } from '../common/services/optimized-file-io.service';
import {
  UnsupportedDocumentException,
  FileSystemException,
} from '../common/exceptions';
import * as path from 'path';

export interface ProcessingOptions {
  generateSummary?: boolean;
  maxSummaryLength?: number;
  summaryType?: 'extractive' | 'abstractive';
}

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private readonly aiModelService: AiModelService,
    private readonly aiModelPoolService: AiModelPoolService,
    private readonly taskService: TaskService,
    private readonly fileCleanupService: FileCleanupService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly optimizedFileIO: OptimizedFileIOService,
  ) {}

  /**
   * Process a document file and extract information with performance optimization
   */
  async processDocument(
    taskId: string,
    filePath: string,
    options: ProcessingOptions = {},
  ): Promise<ProcessingResult> {
    const endTiming = this.performanceMonitor.startTiming(
      `processing-${taskId}`,
    );

    try {
      this.logger.log(
        `Starting optimized document processing for task ${taskId}`,
      );

      // Update task status to processing
      this.taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING, 0);

      // Get file information using optimized I/O
      let fileStats;
      try {
        fileStats = await this.optimizedFileIO.getFileStats(filePath);
      } catch (error) {
        throw new FileSystemException('read file stats', filePath, taskId);
      }
      const fileSize = fileStats.size;
      const fileExtension = path.extname(filePath).toLowerCase();

      this.logger.log(
        `Processing file: ${filePath}, size: ${fileSize} bytes, type: ${fileExtension}`,
      );

      // Update progress - file analysis complete
      this.taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING, 20);

      // Extract text based on file type using pooled AI models
      let extractionResult;
      const extractionTiming = this.performanceMonitor.startTiming(
        `ai-extraction-${fileExtension}`,
      );

      try {
        if (this.isImageFile(fileExtension)) {
          this.logger.log('Processing as image file with pooled OCR');
          extractionResult =
            await this.aiModelPoolService.extractTextFromImage(filePath);
        } else if (this.isPdfFile(fileExtension)) {
          this.logger.log(
            'Processing as PDF file with automatic OCR fallback for scanned PDFs',
          );
          this.logger.log(
            `Calling aiModelPoolService.extractTextFromPdf for: ${filePath}`,
          );
          extractionResult =
            await this.aiModelPoolService.extractTextFromPdf(filePath);
          this.logger.log(
            `Received extraction result with ${extractionResult.text.length} characters`,
          );
        } else {
          throw new UnsupportedDocumentException(
            path.basename(filePath),
            `File type ${fileExtension} is not supported`,
            taskId,
          );
        }
        extractionTiming();
      } catch (error) {
        extractionTiming();
        throw error;
      }

      // Update progress - text extraction complete
      this.taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING, 60);

      this.logger.log(
        `Text extraction completed. Extracted ${extractionResult.text.length} characters`,
      );

      // If PDF extraction returned empty results, provide helpful message
      if (
        this.isPdfFile(fileExtension) &&
        (!extractionResult.text || extractionResult.text.trim().length === 0)
      ) {
        this.logger.warn(
          `Scanned PDF detected with ${extractionResult.text.length} characters extracted.`,
        );
        this.logger.warn(
          `OCR method used: ${extractionResult.metadata?.ocrMethod || 'unknown'}`,
        );
        if (extractionResult.metadata?.isScannedPdf) {
          this.logger.warn(
            `PDF-to-image conversion may have failed. Check AI model pool logs for errors.`,
          );
        }
      }

      // Generate summary if requested using optimized summarization
      let tldr = '';
      if (options.generateSummary !== false && extractionResult.text.trim()) {
        this.logger.log('Generating optimized summary');
        const summaryTiming =
          this.performanceMonitor.startTiming('summarization');

        try {
          const summaryResult = await this.aiModelPoolService.generateSummary(
            extractionResult.text,
            {
              maxLength: options.maxSummaryLength || 200,
              summaryType: options.summaryType || 'extractive',
            },
          );
          tldr = summaryResult.tldr;
          summaryTiming();
        } catch (error) {
          summaryTiming();
          throw error;
        }

        // Update progress - summary generation complete
        this.taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING, 90);
      } else {
        // Skip summary generation
        this.taskService.updateTaskStatus(taskId, TaskStatus.PROCESSING, 90);
      }

      const result: ProcessingResult = {
        extractedText: extractionResult.text,
        summary: extractionResult.summary,
        tldr,
        metadata: {
          pageCount: extractionResult.metadata.pageCount,
          fileSize,
          processingTime: extractionResult.metadata.processingTime || 0,
          confidence: extractionResult.confidence,
          isScannedPdf: extractionResult.metadata.isScannedPdf,
          ocrMethod: extractionResult.metadata.ocrMethod,
          conversionTime: extractionResult.metadata.conversionTime,
          ocrTime: extractionResult.metadata.ocrTime,
          originalPageCount: extractionResult.metadata.originalPageCount,
          processedPages: extractionResult.metadata.processedPages,
          tempFilesCreated: extractionResult.metadata.tempFilesCreated,
          conversionSupported: extractionResult.metadata.conversionSupported,
          fallbackUsed: extractionResult.metadata.fallbackUsed,
          systemDependencies: extractionResult.metadata.systemDependencies,
          workerId: extractionResult.metadata.workerId,
          language: extractionResult.metadata.language,
        },
      };

      this.logger.debug(
        `TYPEOF summary: ${typeof extractionResult.summary}, isArray=${Array.isArray(extractionResult.summary)}`,
      );
      this.logger.debug(`TLDR length: ${tldr?.length ?? 0}`);

      // Update task with final result
      this.taskService.updateTaskResult(taskId, result);

      // Clean up the processed file using optimized I/O
      const cleanupTiming = this.performanceMonitor.startTiming('file-cleanup');
      try {
        await this.optimizedFileIO.deleteFileOptimized(filePath);
        this.logger.debug(
          `Cleaned up file after successful processing: ${filePath}`,
        );
        cleanupTiming();
      } catch (cleanupError) {
        this.logger.warn(
          `Failed to cleanup file ${filePath} after processing:`,
          cleanupError,
        );
        cleanupTiming();
        // Don't throw cleanup errors as processing was successful
      }

      this.logger.log(
        `Document processing completed for task ${taskId} in ${extractionResult.metadata.processingTime}ms`,
      );

      endTiming();

      return result;
    } catch (error) {
      const errorMessage = `Processing failed: ${error.message}`;

      this.logger.error(
        `Document processing failed for task ${taskId}: ${errorMessage}`,
        error.stack,
      );

      // Clean up the file on processing error using optimized I/O
      try {
        await this.optimizedFileIO.deleteFileOptimized(filePath);
        this.logger.debug(
          `Cleaned up file after processing error: ${filePath}`,
        );
      } catch (cleanupError) {
        this.logger.warn(
          `Failed to cleanup file ${filePath} after error:`,
          cleanupError,
        );
      }

      // Update task with error
      this.taskService.updateTaskError(taskId, errorMessage);

      endTiming();
      throw error;
    }
  }

  /**
   * Process multiple documents concurrently
   */
  async processDocuments(
    requests: Array<{
      taskId: string;
      filePath: string;
      options?: ProcessingOptions;
    }>,
  ): Promise<ProcessingResult[]> {
    this.logger.log(`Processing ${requests.length} documents concurrently`);

    const processingPromises = requests.map(({ taskId, filePath, options }) =>
      this.processDocument(taskId, filePath, options).catch((error) => {
        this.logger.error(
          `Failed to process document for task ${taskId}:`,
          error,
        );
        throw error;
      }),
    );

    try {
      const results = await Promise.all(processingPromises);
      this.logger.log(`Successfully processed ${results.length} documents`);
      return results;
    } catch (error) {
      this.logger.error('Error in concurrent document processing:', error);
      throw error;
    }
  }

  /**
   * Get processing progress for a task
   */
  getProcessingProgress(taskId: string): {
    status: TaskStatus;
    progress?: number;
  } {
    try {
      const task = this.taskService.getTask(taskId);
      return {
        status: task.status,
        progress: task.progress,
      };
    } catch (error) {
      this.logger.error(`Failed to get progress for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Check if file is an image
   */
  private isImageFile(extension: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg'];
    return imageExtensions.includes(extension);
  }

  /**
   * Check if file is a PDF
   */
  private isPdfFile(extension: string): boolean {
    return extension === '.pdf';
  }

  /**
   * Validate file type is supported
   */
  isSupportedFileType(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return this.isImageFile(extension) || this.isPdfFile(extension);
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return ['.png', '.jpg', '.jpeg', '.pdf'];
  }
}
