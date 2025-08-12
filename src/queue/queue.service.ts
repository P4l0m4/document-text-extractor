import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PerformanceMonitorService } from '../common/monitoring/performance-monitor.service';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentProcessingJobData {
  taskId: string;
  filePath: string;
  fileName: string;
  fileType: string;
  options?: {
    generateSummary?: boolean;
    maxSummaryLength?: number;
    summaryType?: 'extractive' | 'abstractive';
  };
}

export interface Job {
  id: string;
  data: DocumentProcessingJobData;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private readonly jobs: Map<string, Job> = new Map();
  private readonly waitingJobs: string[] = [];
  private readonly activeJobs: Set<string> = new Set();
  private readonly maxConcurrentJobs: number;
  constructor(
    private readonly configService: ConfigService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {
    this.maxConcurrentJobs =
      this.configService.get<number>('app.maxConcurrentJobs') || 10;
  }

  onModuleInit() {
    // Start processing jobs
    this.startJobProcessor();
  }

  /**
   * Add a document processing job to the queue
   */
  async addDocumentProcessingJob(
    jobData: DocumentProcessingJobData,
  ): Promise<Job> {
    const endTiming = this.performanceMonitor.startTiming('queue-add-job');

    try {
      const job: Job = {
        id: uuidv4(),
        data: jobData,
        status: 'waiting',
        createdAt: new Date(),
      };

      this.jobs.set(job.id, job);
      this.waitingJobs.push(job.id);

      // Record queue statistics
      const queueStats = await this.getQueueStats();
      this.performanceMonitor.recordQueueMetric(
        'queue-add-job',
        0,
        true,
        queueStats,
        { taskId: jobData.taskId, fileType: jobData.fileType },
      );

      endTiming();
      this.logger.debug(
        `Added job ${job.id} for task ${jobData.taskId} to queue`,
      );

      // Try to process immediately if capacity allows
      void this.processNextJob();

      return job;
    } catch (error) {
      endTiming();
      this.logger.error(`Failed to add job for task ${jobData.taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const completed = Array.from(this.jobs.values()).filter(
      (job) => job.status === 'completed',
    ).length;
    const failed = Array.from(this.jobs.values()).filter(
      (job) => job.status === 'failed',
    ).length;

    return {
      waiting: this.waitingJobs.length,
      active: this.activeJobs.size,
      completed,
      failed,
      total: this.jobs.size,
    };
  }

  /**
   * Get active jobs count
   */
  async getActiveJobsCount(): Promise<number> {
    return this.activeJobs.size;
  }

  /**
   * Start the job processor
   */
  private startJobProcessor() {
    setInterval(() => {
      void this.processNextJob();
    }, 1000); // Check every second
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob() {
    if (
      this.activeJobs.size >= this.maxConcurrentJobs ||
      this.waitingJobs.length === 0
    ) {
      return;
    }

    const jobId = this.waitingJobs.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job) return;

    this.activeJobs.add(jobId);
    job.status = 'active';
    job.processedAt = new Date();

    this.logger.debug(`Processing job ${jobId} for task ${job.data.taskId}`);

    try {
      // For now, just mark as completed - processing will be handled elsewhere
      // This is a simplified queue implementation
      job.status = 'completed';
      this.logger.debug(`Job ${jobId} completed successfully`);
    } catch (error) {
      job.status = 'failed';
      job.error = (error as any).message;
      this.logger.error(`Job ${jobId} failed:`, error);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Pause the queue (stop processing new jobs)
   */
  async pauseQueue(): Promise<void> {
    // Implementation would stop the job processor
    this.logger.log('Queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    // Implementation would restart the job processor
    this.logger.log('Queue resumed');
  }

  /**
   * Clean completed jobs
   */
  async cleanCompletedJobs(grace: number = 0): Promise<void> {
    const cutoffTime = Date.now() - grace;
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        job.status === 'completed' &&
        job.processedAt &&
        job.processedAt.getTime() < cutoffTime
      ) {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Clean failed jobs
   */
  async cleanFailedJobs(grace: number = 0): Promise<void> {
    const cutoffTime = Date.now() - grace;
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        job.status === 'failed' &&
        job.processedAt &&
        job.processedAt.getTime() < cutoffTime
      ) {
        this.jobs.delete(jobId);
      }
    }
  }
}
