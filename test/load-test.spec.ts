import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PerformanceMonitorService } from '../src/common/monitoring/performance-monitor.service';
import { QueueService } from '../src/queue/queue.service';
import { AiModelPoolService } from '../src/ai/ai-model-pool.service';

describe('Load Testing (e2e)', () => {
  let app: INestApplication;
  let performanceMonitor: PerformanceMonitorService;
  let queueService: QueueService;
  let aiModelPool: AiModelPoolService;

  // Test files
  const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
  const testPdfPath = path.join(__dirname, 'fixtures', 'test-document.pdf');
  const largeImagePath = path.join(__dirname, 'fixtures', 'large-image.png');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    performanceMonitor = app.get(PerformanceMonitorService);
    queueService = app.get(QueueService);
    aiModelPool = app.get(AiModelPoolService);

    await app.init();

    // Create test fixtures if they don't exist
    await createTestFixtures();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset performance metrics before each test
    performanceMonitor.resetMetrics();
  });

  describe('Concurrent Upload Load Test', () => {
    it('should handle 10 simultaneous image uploads', async () => {
      const concurrentRequests = 10;
      const uploadPromises: Promise<any>[] = [];

      console.log(`Starting ${concurrentRequests} concurrent image uploads...`);
      const startTime = Date.now();

      // Create concurrent upload requests
      for (let i = 0; i < concurrentRequests; i++) {
        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', testImagePath)
          .field('generateSummary', 'true')
          .expect(201)
          .then((response) => ({
            requestId: i,
            taskId: response.body.taskId,
            uploadTime: Date.now() - startTime,
          }));

        uploadPromises.push(uploadPromise);
      }

      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises);
      const totalUploadTime = Date.now() - startTime;

      console.log(
        `All ${concurrentRequests} uploads completed in ${totalUploadTime}ms`,
      );

      // Verify all uploads succeeded
      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result, index) => {
        expect(result.taskId).toBeDefined();
        expect(result.uploadTime).toBeLessThan(10000); // Should complete within 10 seconds
        console.log(
          `Upload ${index}: Task ${result.taskId} completed in ${result.uploadTime}ms`,
        );
      });

      // Check performance metrics
      const uploadMetrics = performanceMonitor.getPerformanceSummary('upload');
      if (uploadMetrics) {
        expect(uploadMetrics.totalRequests).toBe(concurrentRequests);
        expect(uploadMetrics.errorRate).toBeLessThan(5); // Less than 5% error rate
        expect(uploadMetrics.averageDuration).toBeLessThan(5000); // Average under 5 seconds

        console.log('Upload Performance Metrics:', {
          totalRequests: uploadMetrics.totalRequests,
          averageDuration: uploadMetrics.averageDuration,
          p95Duration: uploadMetrics.p95Duration,
          errorRate: uploadMetrics.errorRate,
          throughputPerSecond: uploadMetrics.throughputPerSecond,
        });
      }

      // Wait for processing to complete and verify results
      await waitForProcessingCompletion(results.map((r) => r.taskId));
    }, 60000); // 60 second timeout

    it('should handle 15 simultaneous PDF uploads', async () => {
      const concurrentRequests = 15;
      const uploadPromises: Promise<any>[] = [];

      console.log(`Starting ${concurrentRequests} concurrent PDF uploads...`);
      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', testPdfPath)
          .field('generateSummary', 'true')
          .expect(201)
          .then((response) => ({
            requestId: i,
            taskId: response.body.taskId,
            uploadTime: Date.now() - startTime,
          }));

        uploadPromises.push(uploadPromise);
      }

      const results = await Promise.all(uploadPromises);
      const totalUploadTime = Date.now() - startTime;

      console.log(
        `All ${concurrentRequests} PDF uploads completed in ${totalUploadTime}ms`,
      );

      // Verify performance requirements
      expect(results).toHaveLength(concurrentRequests);
      expect(totalUploadTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Check queue performance
      const queueStats = await queueService.getQueueStats();
      console.log('Queue Stats after PDF uploads:', queueStats);

      await waitForProcessingCompletion(results.map((r) => r.taskId));
    }, 90000);

    it('should handle mixed file type concurrent uploads', async () => {
      const concurrentRequests = 12;
      const uploadPromises: Promise<any>[] = [];

      console.log(`Starting ${concurrentRequests} mixed concurrent uploads...`);
      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const filePath = i % 2 === 0 ? testImagePath : testPdfPath;
        const fileType = i % 2 === 0 ? 'image' : 'pdf';

        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', filePath)
          .field('generateSummary', 'true')
          .expect(201)
          .then((response) => ({
            requestId: i,
            taskId: response.body.taskId,
            fileType,
            uploadTime: Date.now() - startTime,
          }));

        uploadPromises.push(uploadPromise);
      }

      const results = await Promise.all(uploadPromises);
      const totalUploadTime = Date.now() - startTime;

      console.log(
        `All ${concurrentRequests} mixed uploads completed in ${totalUploadTime}ms`,
      );

      // Analyze performance by file type
      const imageResults = results.filter((r) => r.fileType === 'image');
      const pdfResults = results.filter((r) => r.fileType === 'pdf');

      console.log(
        `Image uploads: ${imageResults.length}, PDF uploads: ${pdfResults.length}`,
      );

      await waitForProcessingCompletion(results.map((r) => r.taskId));
    }, 120000);
  });

  describe('Processing Performance Under Load', () => {
    it('should maintain processing performance with high concurrency', async () => {
      const concurrentRequests = 20;
      const uploadPromises: Promise<any>[] = [];

      console.log(
        `Testing processing performance with ${concurrentRequests} concurrent requests...`,
      );

      // Monitor AI model pool before load
      const initialPoolStats = aiModelPool.getPoolStats();
      console.log('Initial AI Model Pool Stats:', initialPoolStats);

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', testImagePath)
          .field('generateSummary', 'true')
          .expect(201)
          .then((response) => response.body.taskId);

        uploadPromises.push(uploadPromise);
      }

      const taskIds = await Promise.all(uploadPromises);
      const uploadCompleteTime = Date.now() - startTime;

      console.log(`All uploads queued in ${uploadCompleteTime}ms`);

      // Monitor processing progress
      const processingStartTime = Date.now();
      await waitForProcessingCompletion(taskIds);
      const totalProcessingTime = Date.now() - processingStartTime;

      console.log(`All processing completed in ${totalProcessingTime}ms`);

      // Check final AI model pool stats
      const finalPoolStats = aiModelPool.getPoolStats();
      console.log('Final AI Model Pool Stats:', finalPoolStats);

      // Verify performance requirements
      expect(totalProcessingTime).toBeLessThan(180000); // Should complete within 3 minutes
      expect(finalPoolStats.utilizationRate).toBeLessThan(100); // Pool shouldn't be completely saturated

      // Check processing performance metrics
      const processingMetrics = performanceMonitor.getAllPerformanceSummaries();
      console.log('Processing Performance Summary:', processingMetrics);

      // Verify no memory leaks
      const systemMetrics = performanceMonitor.getCurrentSystemMetrics();
      console.log('System Metrics:', systemMetrics);
      expect(systemMetrics.memory.heapUtilization).toBeLessThan(90); // Less than 90% heap utilization
    }, 300000); // 5 minute timeout

    it('should handle queue backpressure gracefully', async () => {
      const concurrentRequests = 25; // Exceed normal capacity
      const uploadPromises: Promise<any>[] = [];

      console.log(
        `Testing queue backpressure with ${concurrentRequests} requests...`,
      );

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', testImagePath)
          .expect(201)
          .then((response) => ({
            taskId: response.body.taskId,
            queueTime: Date.now() - startTime,
          }));

        uploadPromises.push(uploadPromise);
      }

      const results = await Promise.all(uploadPromises);

      // Monitor queue statistics during high load
      const queueStats = await queueService.getQueueStats();
      console.log('Queue Stats under high load:', queueStats);

      // Verify queue is handling backpressure
      expect(queueStats.waiting).toBeGreaterThan(0); // Should have queued jobs
      expect(queueStats.active).toBeLessThanOrEqual(10); // Shouldn't exceed concurrency limit

      // Check queue performance metrics
      const queueMetrics = performanceMonitor.getQueuePerformanceMetrics();
      console.log('Queue Performance Metrics:', queueMetrics);

      await waitForProcessingCompletion(results.map((r) => r.taskId));
    }, 400000);
  });

  describe('Memory and Resource Management', () => {
    it('should maintain stable memory usage during sustained load', async () => {
      const rounds = 3;
      const requestsPerRound = 8;

      console.log(
        `Testing memory stability over ${rounds} rounds of ${requestsPerRound} requests...`,
      );

      const memorySnapshots: any[] = [];

      for (let round = 0; round < rounds; round++) {
        console.log(`Starting round ${round + 1}/${rounds}`);

        // Take memory snapshot before round
        const beforeMemory = performanceMonitor.getCurrentSystemMetrics();
        memorySnapshots.push({ round, phase: 'before', ...beforeMemory });

        // Execute requests for this round
        const uploadPromises: Promise<string>[] = [];
        for (let i = 0; i < requestsPerRound; i++) {
          const uploadPromise = request(app.getHttpServer())
            .post('/api/documents/upload')
            .attach('file', testImagePath)
            .expect(201)
            .then((response) => response.body.taskId);

          uploadPromises.push(uploadPromise);
        }

        const taskIds = await Promise.all(uploadPromises);
        await waitForProcessingCompletion(taskIds);

        // Take memory snapshot after round
        const afterMemory = performanceMonitor.getCurrentSystemMetrics();
        memorySnapshots.push({ round, phase: 'after', ...afterMemory });

        console.log(
          `Round ${round + 1} completed. Memory usage: ${(afterMemory.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        );

        // Brief pause between rounds
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Analyze memory trends
      console.log('Memory Usage Trends:');
      memorySnapshots.forEach((snapshot) => {
        console.log(
          `Round ${snapshot.round} ${snapshot.phase}: ${(snapshot.memory.heapUsed / 1024 / 1024).toFixed(2)}MB heap`,
        );
      });

      // Verify memory doesn't grow excessively
      const initialMemory = memorySnapshots[0].memory.heapUsed;
      const finalMemory =
        memorySnapshots[memorySnapshots.length - 1].memory.heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / initialMemory;

      expect(memoryGrowth).toBeLessThan(0.5); // Memory shouldn't grow more than 50%
      console.log(`Memory growth: ${(memoryGrowth * 100).toFixed(2)}%`);
    }, 600000);
  });

  // Helper functions
  async function waitForProcessingCompletion(taskIds: string[]): Promise<void> {
    const maxWaitTime = 180000; // 3 minutes
    const checkInterval = 1000; // 1 second
    const startTime = Date.now();

    console.log(
      `Waiting for ${taskIds.length} tasks to complete processing...`,
    );

    while (Date.now() - startTime < maxWaitTime) {
      const statusChecks = await Promise.all(
        taskIds.map(async (taskId) => {
          try {
            const response = await request(app.getHttpServer())
              .get(`/api/tasks/${taskId}/status`)
              .expect(200);
            return { taskId, status: response.body.status };
          } catch (error) {
            return { taskId, status: 'error', error };
          }
        }),
      );

      const completedTasks = statusChecks.filter(
        (check) => check.status === 'completed' || check.status === 'failed',
      );

      console.log(
        `Progress: ${completedTasks.length}/${taskIds.length} tasks completed`,
      );

      if (completedTasks.length === taskIds.length) {
        console.log('All tasks completed!');

        // Verify results for completed tasks
        const successfulTasks = statusChecks.filter(
          (check) => check.status === 'completed',
        );
        const failedTasks = statusChecks.filter(
          (check) => check.status === 'failed',
        );

        console.log(
          `Successful: ${successfulTasks.length}, Failed: ${failedTasks.length}`,
        );

        if (failedTasks.length > 0) {
          console.warn('Failed tasks:', failedTasks);
        }

        return;
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error(
      `Timeout waiting for tasks to complete. ${taskIds.length} tasks still processing after ${maxWaitTime}ms`,
    );
  }

  async function createTestFixtures(): Promise<void> {
    const fixturesDir = path.join(__dirname, 'fixtures');

    // Ensure fixtures directory exists
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create test image if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      // Create a simple test image (1x1 PNG)
      const pngData = Buffer.from([
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
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52, // IHDR chunk
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x01, // 1x1 dimensions
        0x08,
        0x02,
        0x00,
        0x00,
        0x00,
        0x90,
        0x77,
        0x53,
        0xde, // IHDR data
        0x00,
        0x00,
        0x00,
        0x0c,
        0x49,
        0x44,
        0x41,
        0x54, // IDAT chunk
        0x08,
        0x99,
        0x01,
        0x01,
        0x00,
        0x00,
        0x00,
        0xff,
        0xff,
        0x00,
        0x00,
        0x00,
        0x02,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x49,
        0x45,
        0x4e,
        0x44,
        0xae,
        0x42,
        0x60,
        0x82, // IEND
      ]);
      fs.writeFileSync(testImagePath, pngData);
    }

    // Create test PDF if it doesn't exist
    if (!fs.existsSync(testPdfPath)) {
      // Create a minimal PDF
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
      fs.writeFileSync(testPdfPath, pdfContent);
    }

    console.log('Test fixtures created successfully');
  }
});
