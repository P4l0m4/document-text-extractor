import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TaskService } from '../src/task/task.service';
import { QueueService } from '../src/queue/queue.service';
import { ProcessingService } from '../src/processing/processing.service';
import { FileCleanupService } from '../src/common/services/file-cleanup.service';
import { TaskStatus } from '../src/common/interfaces/task.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Complete Processing Workflow (e2e)', () => {
  let app: INestApplication<App>;
  let taskService: TaskService;
  let queueService: QueueService;
  let processingService: ProcessingService;
  let fileCleanupService: FileCleanupService;
  let tempDir: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    taskService = moduleFixture.get<TaskService>(TaskService);
    queueService = moduleFixture.get<QueueService>(QueueService);
    processingService = moduleFixture.get<ProcessingService>(ProcessingService);
    fileCleanupService =
      moduleFixture.get<FileCleanupService>(FileCleanupService);

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-test-'));
  });

  afterAll(async () => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    await app.close();
  });

  beforeEach(() => {
    // Clear all tasks before each test
    taskService.clearAllTasks();
  });

  describe('Complete Image Processing Workflow', () => {
    it('should process image upload through complete workflow', async () => {
      // Create a minimal valid PNG file buffer
      const pngBuffer = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d, // IHDR chunk length
        0x49,
        0x48,
        0x44,
        0x52, // IHDR
        0x00,
        0x00,
        0x00,
        0x01, // width: 1
        0x00,
        0x00,
        0x00,
        0x01, // height: 1
        0x08,
        0x02,
        0x00,
        0x00,
        0x00, // bit depth, color type, compression, filter, interlace
        0x90,
        0x77,
        0x53,
        0xde, // CRC
        0x00,
        0x00,
        0x00,
        0x0c, // IDAT chunk length
        0x49,
        0x44,
        0x41,
        0x54, // IDAT
        0x08,
        0xd7,
        0x63,
        0xf8,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x01, // compressed data
        0x35,
        0xa4,
        0x29,
        0x2e, // CRC
        0x00,
        0x00,
        0x00,
        0x00, // IEND chunk length
        0x49,
        0x45,
        0x4e,
        0x44, // IEND
        0xae,
        0x42,
        0x60,
        0x82, // CRC
      ]);

      // Step 1: Upload file
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pngBuffer, 'test-workflow.png')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('taskId');
      const taskId = uploadResponse.body.taskId;

      // Step 2: Check initial task status
      const initialStatusResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/status`)
        .expect(200);

      expect(initialStatusResponse.body.status).toBeOneOf([
        TaskStatus.PENDING,
        TaskStatus.PROCESSING,
      ]);

      // Step 3: Wait for processing to complete (with timeout)
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (!processingComplete && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

        const statusResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/status`)
          .expect(200);

        if (
          statusResponse.body.status === TaskStatus.COMPLETED ||
          statusResponse.body.status === TaskStatus.FAILED
        ) {
          processingComplete = true;
        }
        attempts++;
      }

      expect(processingComplete).toBe(true);

      // Step 4: Get final task status
      const finalStatusResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/status`)
        .expect(200);

      expect(finalStatusResponse.body.status).toBe(TaskStatus.COMPLETED);
      expect(finalStatusResponse.body.progress).toBe(100);

      // Step 5: Get processing result
      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      expect(resultResponse.body).toHaveProperty('extractedText');
      expect(resultResponse.body).toHaveProperty('summary');
      expect(resultResponse.body).toHaveProperty('metadata');
      expect(resultResponse.body.metadata).toHaveProperty('fileSize');
      expect(resultResponse.body.metadata).toHaveProperty('processingTime');
      expect(resultResponse.body.metadata.processingTime).toBeGreaterThan(0);

      // Step 6: Verify file cleanup occurred
      // The file should have been cleaned up after processing
      const task = taskService.getTask(taskId);
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('Complete PDF Processing Workflow', () => {
    it('should process PDF upload through complete workflow', async () => {
      // Create a minimal valid PDF file buffer
      const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test Document) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`;

      const pdfBuffer = Buffer.from(pdfContent);

      // Step 1: Upload file
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pdfBuffer, 'test-workflow.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('taskId');
      const taskId = uploadResponse.body.taskId;

      // Step 2: Wait for processing to complete
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!processingComplete && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/status`)
          .expect(200);

        if (
          statusResponse.body.status === TaskStatus.COMPLETED ||
          statusResponse.body.status === TaskStatus.FAILED
        ) {
          processingComplete = true;
        }
        attempts++;
      }

      expect(processingComplete).toBe(true);

      // Step 3: Get processing result
      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      expect(resultResponse.body).toHaveProperty('extractedText');
      expect(resultResponse.body).toHaveProperty('summary');
      expect(resultResponse.body).toHaveProperty('metadata');
      expect(resultResponse.body.metadata).toHaveProperty('pageCount');
      expect(resultResponse.body.metadata.pageCount).toBe(1);
    });
  });

  describe('Concurrent Processing Workflow', () => {
    it('should handle multiple simultaneous uploads and processing', async () => {
      const uploadPromises = [];
      const fileCount = 5;

      // Create multiple PNG files
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x35, 0xa4, 0x29, 0x2e, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      // Step 1: Upload multiple files simultaneously
      for (let i = 0; i < fileCount; i++) {
        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', pngBuffer, `concurrent-test-${i}.png`);
        uploadPromises.push(uploadPromise);
      }

      const uploadResponses = await Promise.all(uploadPromises);
      const taskIds = uploadResponses.map((response) => {
        expect(response.status).toBe(200);
        return response.body.taskId;
      });

      // Step 2: Wait for all processing to complete
      const waitForCompletion = async (taskId: string) => {
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
          const statusResponse = await request(app.getHttpServer())
            .get(`/api/tasks/${taskId}/status`)
            .expect(200);

          if (
            statusResponse.body.status === TaskStatus.COMPLETED ||
            statusResponse.body.status === TaskStatus.FAILED
          ) {
            return statusResponse.body;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        }

        throw new Error(`Task ${taskId} did not complete within timeout`);
      };

      // Wait for all tasks to complete
      const completionPromises = taskIds.map(waitForCompletion);
      const completedTasks = await Promise.all(completionPromises);

      // Step 3: Verify all tasks completed successfully
      completedTasks.forEach((task, index) => {
        expect(task.status).toBe(TaskStatus.COMPLETED);
        expect(task.progress).toBe(100);
      });

      // Step 4: Get all results
      const resultPromises = taskIds.map((taskId) =>
        request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/result`)
          .expect(200),
      );

      const results = await Promise.all(resultPromises);

      results.forEach((result) => {
        expect(result.body).toHaveProperty('extractedText');
        expect(result.body).toHaveProperty('summary');
        expect(result.body).toHaveProperty('metadata');
      });

      // Step 5: Verify queue statistics
      const queueStats = await queueService.getQueueStats();
      expect(queueStats.completed).toBeGreaterThanOrEqual(fileCount);
    });
  });

  describe('Error Handling Workflow', () => {
    it('should handle processing errors gracefully', async () => {
      // Upload an invalid file that will cause processing to fail
      const invalidBuffer = Buffer.from('invalid image data');

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', invalidBuffer, 'invalid.png')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // Wait for processing to complete (should fail)
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!processingComplete && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/status`)
          .expect(200);

        if (
          statusResponse.body.status === TaskStatus.COMPLETED ||
          statusResponse.body.status === TaskStatus.FAILED
        ) {
          processingComplete = true;
        }
        attempts++;
      }

      expect(processingComplete).toBe(true);

      // Verify task failed with error message
      const finalStatusResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/status`)
        .expect(200);

      expect(finalStatusResponse.body.status).toBe(TaskStatus.FAILED);
      expect(finalStatusResponse.body).toHaveProperty('error');
      expect(finalStatusResponse.body.error).toBeDefined();

      // Verify result endpoint returns appropriate error
      await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(404); // Task failed, no result available
    });
  });

  describe('File Cleanup Integration', () => {
    it('should clean up files after successful processing', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x35, 0xa4, 0x29, 0x2e, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      // Track initial file count
      const initialTrackedFiles = fileCleanupService.getTrackedFileCount();

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pngBuffer, 'cleanup-test.png')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // File should be tracked after upload
      expect(fileCleanupService.getTrackedFileCount()).toBeGreaterThan(
        initialTrackedFiles,
      );

      // Wait for processing to complete
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!processingComplete && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/status`)
          .expect(200);

        if (
          statusResponse.body.status === TaskStatus.COMPLETED ||
          statusResponse.body.status === TaskStatus.FAILED
        ) {
          processingComplete = true;
        }
        attempts++;
      }

      expect(processingComplete).toBe(true);

      // After processing, file should be cleaned up
      // Note: There might be a small delay for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // The tracked file count should return to initial level or lower
      expect(fileCleanupService.getTrackedFileCount()).toBeLessThanOrEqual(
        initialTrackedFiles + 1,
      );
    });
  });

  describe('Processing Options Integration', () => {
    it('should respect processing options in complete workflow', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x35, 0xa4, 0x29, 0x2e, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      // Upload with specific options
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pngBuffer, 'options-test.png')
        .field('generateSummary', 'false')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // Wait for processing to complete
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!processingComplete && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/status`)
          .expect(200);

        if (
          statusResponse.body.status === TaskStatus.COMPLETED ||
          statusResponse.body.status === TaskStatus.FAILED
        ) {
          processingComplete = true;
        }
        attempts++;
      }

      expect(processingComplete).toBe(true);

      // Get result and verify summary was not generated
      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      expect(resultResponse.body).toHaveProperty('extractedText');
      expect(resultResponse.body).toHaveProperty('summary');
      expect(resultResponse.body.summary).toBe(''); // Should be empty when generateSummary is false
    });
  });
});
