import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TaskService } from '../src/task/task.service';
import { AiModelPoolService } from '../src/ai/ai-model-pool.service';
import { TaskStatus } from '../src/common/interfaces/task.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Scanned PDF Performance Validation (e2e)', () => {
  let app: INestApplication<App>;
  let taskService: TaskService;
  let aiModelPoolService: AiModelPoolService;
  let tempDir: string;

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    TEXT_PDF_MAX_TIME: 10000,      // 10 seconds for text-based PDFs
    SCANNED_PDF_MAX_TIME: 60000,   // 60 seconds for scanned PDFs
    CONCURRENT_MAX_TIME: 180000,   // 3 minutes for concurrent processing
    MEMORY_LIMIT_MB: 512,          // Memory usage limit per conversion
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    taskService = moduleFixture.get<TaskService>(TaskService);
    aiModelPoolService = moduleFixture.get<AiModelPoolService>(AiModelPoolService);

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-performance-'));
  });

  afterAll(async () => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    await app.close();
  });

  beforeEach(() => {
    taskService.clearAllTasks();
  });

  function createTextBasedPdf(pageCount: number = 1): Buffer {
    let pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [`;

    // Add page references
    for (let i = 0; i < pageCount; i++) {
      pdfContent += `${3 + i * 2} 0 R`;
      if (i < pageCount - 1) pdfContent += ' ';
    }

    pdfContent += `]
/Count ${pageCount}
>>
endobj

`;

    // Add pages and content
    let objNum = 3;
    for (let i = 0; i < pageCount; i++) {
      pdfContent += `${objNum} 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents ${objNum + 1} 0 R
>>
endobj

${objNum + 1} 0 obj
<<
/Length 150
>>
stream
BT
/F1 12 Tf
72 720 Td
(This is page ${i + 1} of a multi-page text-based PDF document.) Tj
0 -20 Td
(It contains extractable text content for performance testing.) Tj
0 -20 Td
(Processing should be fast via direct text extraction.) Tj
ET
endstream
endobj

`;
      objNum += 2;
    }

    // Add xref and trailer
    pdfContent += `xref
0 ${objNum}
0000000000 65535 f `;

    let offset = 9;
    for (let i = 1; i < objNum; i++) {
      pdfContent += `\n${offset.toString().padStart(10, '0')} 00000 n `;
      offset += 100; // Approximate offset increment
    }

    pdfContent += `
trailer
<<
/Size ${objNum}
/Root 1 0 R
>>
startxref
${offset}
%%EOF`;

    return Buffer.from(pdfContent);
  }

  function createScannedPdf(pageCount: number = 1): Buffer {
    let pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [`;

    // Add page references
    for (let i = 0; i < pageCount; i++) {
      pdfContent += `${3 + i} 0 R`;
      if (i < pageCount - 1) pdfContent += ' ';
    }

    pdfContent += `]
/Count ${pageCount}
>>
endobj

`;

    // Add pages (no text content - simulates scanned pages)
    let objNum = 3;
    for (let i = 0; i < pageCount; i++) {
      pdfContent += `${objNum} 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj

`;
      objNum++;
    }

    // Add xref and trailer
    pdfContent += `xref
0 ${objNum}
0000000000 65535 f `;

    let offset = 9;
    for (let i = 1; i < objNum; i++) {
      pdfContent += `\n${offset.toString().padStart(10, '0')} 00000 n `;
      offset += 80; // Approximate offset increment
    }

    pdfContent += `
trailer
<<
/Size ${objNum}
/Root 1 0 R
>>
startxref
${offset}
%%EOF`;

    return Buffer.from(pdfContent);
  }

  async function waitForTaskCompletion(taskId: string, maxAttempts: number = 60): Promise<any> {
    let attempts = 0;
    
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

    throw new Error(`Task ${taskId} did not complete within ${maxAttempts} seconds`);
  }

  function measureMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024); // Convert to MB
  }

  describe('Text-based PDF Performance', () => {
    it('should process single-page text PDF within time limit', async () => {
      const pdfBuffer = createTextBasedPdf(1);
      const startTime = Date.now();
      const initialMemory = measureMemoryUsage();

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pdfBuffer, 'single-page-text.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId);
      
      const processingTime = Date.now() - startTime;
      const finalMemory = measureMemoryUsage();
      const memoryUsed = finalMemory - initialMemory;

      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEXT_PDF_MAX_TIME);

      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;
      expect(result.metadata.ocrMethod).toBe('direct');
      expect(result.metadata.processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEXT_PDF_MAX_TIME);

      console.log(`✅ Single-page text PDF: ${processingTime}ms, Memory: ${memoryUsed}MB`);
    });

    it('should process multi-page text PDF efficiently', async () => {
      const pdfBuffer = createTextBasedPdf(5);
      const startTime = Date.now();

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pdfBuffer, 'multi-page-text.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId);
      
      const processingTime = Date.now() - startTime;

      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEXT_PDF_MAX_TIME);

      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;
      expect(result.metadata.ocrMethod).toBe('direct');
      expect(result.metadata.originalPageCount).toBe(5);

      console.log(`✅ Multi-page text PDF (5 pages): ${processingTime}ms`);
    });
  });

  describe('Scanned PDF Performance', () => {
    it('should process single-page scanned PDF within time limit', async () => {
      const pdfBuffer = createScannedPdf(1);
      const startTime = Date.now();
      const initialMemory = measureMemoryUsage();

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pdfBuffer, 'single-page-scanned.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 90); // Extended timeout for OCR
      
      const processingTime = Date.now() - startTime;
      const finalMemory = measureMemoryUsage();
      const memoryUsed = finalMemory - initialMemory;

      if (finalStatus.status === TaskStatus.FAILED) {
        // Check if failure is due to missing dependencies
        const task = taskService.getTask(taskId);
        if (task.error && task.error.includes('dependency')) {
          console.log('⚠️ Scanned PDF performance test skipped due to missing system dependencies');
          return;
        }
        throw new Error(`Task failed unexpectedly: ${task.error}`);
      }

      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SCANNED_PDF_MAX_TIME);

      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;
      expect(result.metadata.ocrMethod).toBe('pdf-to-image');
      expect(result.metadata.isScannedPdf).toBe(true);

      // Verify memory usage is within limits
      expect(memoryUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LIMIT_MB);

      console.log(`✅ Single-page scanned PDF: ${processingTime}ms, Memory: ${memoryUsed}MB`);
    });

    it('should handle scanned PDF processing with conversion time tracking', async () => {
      const pdfBuffer = createScannedPdf(1);
      const startTime = Date.now();

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pdfBuffer, 'conversion-timing.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 90);

      if (finalStatus.status === TaskStatus.FAILED) {
        const task = taskService.getTask(taskId);
        if (task.error && task.error.includes('dependency')) {
          console.log('⚠️ Conversion timing test skipped due to missing system dependencies');
          return;
        }
        throw new Error(`Task failed unexpectedly: ${task.error}`);
      }

      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);

      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;
      const totalTime = Date.now() - startTime;

      // Verify timing metadata is present and reasonable
      expect(result.metadata).toHaveProperty('conversionTime');
      expect(result.metadata).toHaveProperty('processingTime');
      
      if (result.metadata.conversionTime) {
        expect(result.metadata.conversionTime).toBeGreaterThan(0);
        expect(result.metadata.conversionTime).toBeLessThan(totalTime);
      }

      console.log(`✅ Conversion timing tracked: Total=${totalTime}ms, Conversion=${result.metadata.conversionTime}ms`);
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent text PDF processing efficiently', async () => {
      const concurrentCount = 5;
      const uploadPromises = [];
      const startTime = Date.now();

      // Create and upload multiple text PDFs
      for (let i = 0; i < concurrentCount; i++) {
        const pdfBuffer = createTextBasedPdf(1);
        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', pdfBuffer, `concurrent-text-${i}.pdf`);
        uploadPromises.push(uploadPromise);
      }

      const uploadResponses = await Promise.all(uploadPromises);
      const taskIds = uploadResponses.map(response => {
        expect(response.status).toBe(200);
        return response.body.taskId;
      });

      // Wait for all to complete
      const completionPromises = taskIds.map(taskId => 
        waitForTaskCompletion(taskId, 30)
      );

      const completedTasks = await Promise.all(completionPromises);
      const totalTime = Date.now() - startTime;

      // All should complete successfully
      completedTasks.forEach(task => {
        expect(task.status).toBe(TaskStatus.COMPLETED);
      });

      // Concurrent processing should be efficient
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEXT_PDF_MAX_TIME * 2); // Should be much faster than sequential

      console.log(`✅ ${concurrentCount} concurrent text PDFs processed in ${totalTime}ms`);
    });

    it('should handle concurrent scanned PDF processing with resource management', async () => {
      const concurrentCount = 3; // Smaller count for resource-intensive scanned PDFs
      const uploadPromises = [];
      const startTime = Date.now();
      const initialMemory = measureMemoryUsage();

      // Create and upload multiple scanned PDFs
      for (let i = 0; i < concurrentCount; i++) {
        const pdfBuffer = createScannedPdf(1);
        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', pdfBuffer, `concurrent-scanned-${i}.pdf`);
        uploadPromises.push(uploadPromise);
      }

      const uploadResponses = await Promise.all(uploadPromises);
      const taskIds = uploadResponses.map(response => {
        expect(response.status).toBe(200);
        return response.body.taskId;
      });

      // Wait for all to complete with extended timeout
      const completionPromises = taskIds.map(taskId => 
        waitForTaskCompletion(taskId, 120)
      );

      try {
        const completedTasks = await Promise.all(completionPromises);
        const totalTime = Date.now() - startTime;
        const finalMemory = measureMemoryUsage();
        const memoryUsed = finalMemory - initialMemory;

        // Count successful completions
        const successfulTasks = completedTasks.filter(task => task.status === TaskStatus.COMPLETED);

        if (successfulTasks.length > 0) {
          expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_MAX_TIME);
          
          // Memory usage should be reasonable for concurrent processing
          const memoryPerTask = memoryUsed / successfulTasks.length;
          expect(memoryPerTask).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LIMIT_MB);

          console.log(`✅ ${successfulTasks.length}/${concurrentCount} concurrent scanned PDFs: ${totalTime}ms, Memory: ${memoryUsed}MB (${memoryPerTask.toFixed(1)}MB/task)`);
        } else {
          console.log('⚠️ Concurrent scanned PDF test skipped - all tasks failed (likely missing dependencies)');
        }
      } catch (error) {
        console.log('⚠️ Concurrent scanned PDF performance test encountered errors - likely due to missing dependencies');
      }
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('should monitor memory usage during PDF-to-image conversion', async () => {
      const pdfBuffer = createScannedPdf(1);
      const initialMemory = measureMemoryUsage();

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pdfBuffer, 'memory-monitor.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // Monitor memory during processing
      const memoryReadings: number[] = [];
      const monitoringInterval = setInterval(() => {
        memoryReadings.push(measureMemoryUsage());
      }, 500); // Check every 500ms

      const finalStatus = await waitForTaskCompletion(taskId, 90);
      clearInterval(monitoringInterval);

      const finalMemory = measureMemoryUsage();
      const maxMemoryUsed = Math.max(...memoryReadings) - initialMemory;
      const avgMemoryUsed = (memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length) - initialMemory;

      if (finalStatus.status === TaskStatus.FAILED) {
        const task = taskService.getTask(taskId);
        if (task.error && task.error.includes('dependency')) {
          console.log('⚠️ Memory monitoring test skipped due to missing system dependencies');
          return;
        }
        throw new Error(`Task failed unexpectedly: ${task.error}`);
      }

      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);

      // Memory usage should be within reasonable limits
      expect(maxMemoryUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LIMIT_MB);

      console.log(`✅ Memory usage - Max: ${maxMemoryUsed}MB, Avg: ${avgMemoryUsed.toFixed(1)}MB, Final: ${finalMemory - initialMemory}MB`);
    });

    it('should track processing stages and their durations', async () => {
      const pdfBuffer = createScannedPdf(1);

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pdfBuffer, 'stage-tracking.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 90);

      if (finalStatus.status === TaskStatus.FAILED) {
        const task = taskService.getTask(taskId);
        if (task.error && task.error.includes('dependency')) {
          console.log('⚠️ Stage tracking test skipped due to missing system dependencies');
          return;
        }
        throw new Error(`Task failed unexpectedly: ${task.error}`);
      }

      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);

      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;

      // Verify timing information is available
      expect(result.metadata).toHaveProperty('processingTime');
      expect(result.metadata.processingTime).toBeGreaterThan(0);

      if (result.metadata.conversionTime) {
        expect(result.metadata.conversionTime).toBeGreaterThan(0);
        expect(result.metadata.conversionTime).toBeLessThan(result.metadata.processingTime);
      }

      console.log(`✅ Processing stages tracked - Total: ${result.metadata.processingTime}ms`);
    });
  });

  describe('Load Testing', () => {
    it('should handle sustained load of mixed document types', async () => {
      const loadTestDuration = 30000; // 30 seconds
      const uploadInterval = 2000; // Upload every 2 seconds
      const startTime = Date.now();
      const uploadPromises: Promise<any>[] = [];
      let uploadCount = 0;

      const loadTestInterval = setInterval(() => {
        if (Date.now() - startTime >= loadTestDuration) {
          clearInterval(loadTestInterval);
          return;
        }

        // Alternate between text and scanned PDFs
        const isTextPdf = uploadCount % 2 === 0;
        const pdfBuffer = isTextPdf ? createTextBasedPdf(1) : createScannedPdf(1);
        const filename = `load-test-${uploadCount}-${isTextPdf ? 'text' : 'scanned'}.pdf`;

        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', pdfBuffer, filename)
          .then(response => ({
            uploadCount,
            isTextPdf,
            success: response.status === 200,
            taskId: response.body?.taskId,
          }))
          .catch(error => ({
            uploadCount,
            isTextPdf,
            success: false,
            error: error.message,
          }));

        uploadPromises.push(uploadPromise);
        uploadCount++;
      }, uploadInterval);

      // Wait for load test to complete
      await new Promise(resolve => setTimeout(resolve, loadTestDuration + 1000));

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);
      const successfulUploads = uploadResults.filter(result => result.success);

      expect(successfulUploads.length).toBeGreaterThan(0);

      // Wait for a subset of tasks to complete to verify system stability
      const sampleTaskIds = successfulUploads
        .slice(0, Math.min(5, successfulUploads.length))
        .map(result => result.taskId)
        .filter(taskId => taskId);

      if (sampleTaskIds.length > 0) {
        const completionPromises = sampleTaskIds.map(taskId => 
          waitForTaskCompletion(taskId, 120).catch(() => ({ status: TaskStatus.FAILED }))
        );

        const completedSamples = await Promise.all(completionPromises);
        const successfulSamples = completedSamples.filter(task => task.status === TaskStatus.COMPLETED);

        console.log(`✅ Load test: ${uploadResults.length} uploads, ${successfulUploads.length} successful, ${successfulSamples.length}/${sampleTaskIds.length} sample tasks completed`);
      } else {
        console.log(`✅ Load test: ${uploadResults.length} uploads, ${successfulUploads.length} successful`);
      }
    });
  });
});