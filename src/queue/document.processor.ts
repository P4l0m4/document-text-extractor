import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TaskService } from '../task/task.service';
import { ProcessingService } from '../processing/processing.service';
import { DocumentProcessingJobData } from './queue.service';

@Processor('document-processing')
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly taskService: TaskService,
    private readonly processingService: ProcessingService,
  ) {}

  @Process({
    name: 'process-document',
    concurrency: 10, // Process up to 10 jobs simultaneously
  })
  async processDocument(job: Job<DocumentProcessingJobData>) {
    const { taskId, filePath, fileName, options } = job.data;

    this.logger.log(
      `Starting processing for task ${taskId}, file: ${fileName}`,
    );

    try {
      // Set up progress tracking callback
      const progressCallback = (progress: number) => {
        job.progress(progress);
      };

      // Use ProcessingService to handle the actual document processing
      // Use options from job data or defaults
      const processingOptions = {
        generateSummary: options?.generateSummary ?? true,
        maxSummaryLength: options?.maxSummaryLength ?? 200,
        summaryType: options?.summaryType ?? 'extractive',
      };

      const result = await this.processingService.processDocument(
        taskId,
        filePath,
        processingOptions,
      );

      this.logger.log(`Completed processing for task ${taskId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process task ${taskId}:`, error);

      // The ProcessingService already handles task error updates,
      // but we still need to throw the error for the queue system
      throw error;
    }
  }
}
