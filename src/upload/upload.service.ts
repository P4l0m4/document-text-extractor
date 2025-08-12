import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { FileUploadOptionsDto } from '../common/dto/file-upload.dto';
import { TaskService } from '../task/task.service';
import { QueueService } from '../queue/queue.service';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import { ProcessingService } from '../processing/processing.service';

@Injectable()
export class UploadService {
  constructor(
    private readonly taskService: TaskService,
    private readonly queueService: QueueService,
    private readonly fileCleanupService: FileCleanupService,
    private readonly processingService: ProcessingService,
  ) {}

  /**
   * Process uploaded file and return task ID
   * Creates a task and queues it for processing
   */
  async processUpload(
    file: Express.Multer.File,
    options?: FileUploadOptionsDto,
  ): Promise<string> {
    // Generate unique task ID
    const taskId = uuidv4();

    // Track the uploaded file for cleanup
    this.fileCleanupService.trackFile(file.path);

    // Create task in task service
    const task = this.taskService.createTask(
      taskId,
      file.originalname,
      file.mimetype,
    );

    // Queue the document for processing
    await this.queueService.addDocumentProcessingJob({
      taskId,
      filePath: file.path,
      fileName: file.originalname,
      fileType: file.mimetype,
      options: options
        ? {
            generateSummary: options.generateSummary,
            maxSummaryLength: options.maxSummaryLength,
            summaryType: options.summaryType,
          }
        : undefined,
    });

    // Process the document asynchronously
    this.processDocumentAsync(taskId, file.path, options);

    return taskId;
  }

  /**
   * Process document asynchronously
   */
  private processDocumentAsync(
    taskId: string,
    filePath: string,
    options?: FileUploadOptionsDto,
  ): void {
    // Process in background without blocking the response
    setTimeout(async () => {
      try {
        await this.processingService.processDocument(taskId, filePath, {
          generateSummary: options?.generateSummary ?? true,
          maxSummaryLength: options?.maxSummaryLength ?? 200,
          summaryType: options?.summaryType ?? 'extractive',
        });
      } catch (error) {
        console.error(`Failed to process document for task ${taskId}:`, error);
      }
    }, 100); // Small delay to ensure response is sent first
  }
}
