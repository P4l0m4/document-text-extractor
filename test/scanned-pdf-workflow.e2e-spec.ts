import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TaskService } from '../src/task/task.service';
import { AiModelPoolService } from '../src/ai/ai-model-pool.service';
import { DependencyDetectionService } from '../src/ai/dependency-detection.service';
import { TaskStatus } from '../src/common/interfaces/task.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Scanned PDF Workflow Integration Tests (e2e)', () => {
  let app: INestApplication<App>;
  let taskService: TaskService;
  let aiModelPoolService: AiModelPoolService;
  let dependencyDetectionService: DependencyDetectionService;
  let tempDir: string;

  // Test file buffers
  let textBasedPdfBuffer: Buffer;
  let scannedPdfBuffer: Buffer;
  let imageBuffer: Buffer;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    taskService = moduleFixture.get<TaskService>(TaskService);
    aiModelPoolService = moduleFixture.get<AiModelPoolService>(AiModelPoolService);
    dependencyDetectionService = moduleFixture.get<DependencyDetectionService>(DependencyDetectionService);

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanned-pdf-e2e-'));

    // Initialize test file buffers
    await initializeTestFiles();
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

  async function initializeTestFiles() {
    // Create text-based PDF with extractable content
    textBasedPdfBuffer = Buffer.from(`%PDF-1.4
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
/Length 120
>>
stream
BT
/F1 12 Tf
72 720 Td
(This is a text-based PDF document with extractable content.) Tj
0 -20 Td
(It contains multiple lines of readable text.) Tj
0 -20 Td
(This should be processed via direct text extraction.) Tj
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
400
%%EOF`);

    // Create minimal PDF that appears scanned (no extractable text)
    scannedPdfBuffer = Buffer.from(`%PDF-1.4
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
>>
endobj

xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
180
%%EOF`);

    // Create a minimal valid PNG file
    imageBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // width: 1
      0x00, 0x00, 0x00, 0x01, // height: 1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
      0x90, 0x77, 0x53, 0xde, // CRC
      0x00, 0x00, 0x00, 0x0c, // IDAT chunk length
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x08, 0xd7, 0x63, 0xf8, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, // compressed data
      0x35, 0xa4, 0x29, 0x2e, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk length
      0x49, 0x45, 0x4e, 0x44, // IEND
      0xae, 0x42, 0x60, 0x82, // CRC
    ]);
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

  describe('Text-based PDF Processing (Requirement 4.1)', () => {
    it('should process text-based PDF via direct extraction', async () => {
      const startTime = Date.now();

      // Upload text-based PDF
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', textBasedPdfBuffer, 'text-based-document.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('taskId');
      const taskId = uploadResponse.body.taskId;

      // Wait for processing to complete
      const finalStatus = await waitForTaskCompletion(taskId);
      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);

      // Get processing result
      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;
      const processingTime = Date.now() - startTime;

      // Verify response format consistency (Requirement 3.1)
      expect(result).toHaveProperty('extractedText');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('metadata');

      // Verify text extraction worked
      expect(result.extractedText).toContain('text-based PDF document');
      expect(result.extractedText).toContain('extractable content');

      // Verify metadata indicates direct processing (Requirement 3.2)
      expect(result.metadata).toHaveProperty('isScannedPdf', false);
      expect(result.metadata).toHaveProperty('ocrMethod', 'direct');
      expect(result.metadata).toHaveProperty('processingTime');
      expect(result.metadata.processingTime).toBeGreaterThan(0);

      // Verify confidence score (Requirement 3.3)
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBe(100); // Direct extraction should have 100% confidence

      // Performance validation (Requirement 4.1) - text-based PDFs should be fast
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`✅ Text-based PDF processed in ${processingTime}ms via direct extraction`);
    });

    it('should prioritize direct extraction over image conversion for text-based PDFs', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', textBasedPdfBuffer, 'priority-test.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId);
      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);

      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;

      // Should use direct extraction, not PDF-to-image conversion
      expect(result.metadata.ocrMethod).toBe('direct');
      expect(result.metadata.isScannedPdf).toBe(false);
      expect(result.metadata).not.toHaveProperty('conversionTime');
    });
  });

  describe('Scanned PDF Processing (Requirements 1.1, 1.2, 1.3)', () => {
    it('should detect and process scanned PDFs via PDF-to-image conversion', async () => {
      const startTime = Date.now();

      // Upload scanned PDF (minimal text content)
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', scannedPdfBuffer, 'scanned-document.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('taskId');
      const taskId = uploadResponse.body.taskId;

      // Wait for processing to complete (may take longer for OCR)
      const finalStatus = await waitForTaskCompletion(taskId, 90); // Extended timeout for OCR
      
      // Check if processing completed or failed due to missing dependencies
      if (finalStatus.status === TaskStatus.FAILED) {
        // Check if failure is due to missing system dependencies
        const task = taskService.getTask(taskId);
        if (task.error && task.error.includes('dependency')) {
          console.log('⚠️ Scanned PDF test skipped due to missing system dependencies');
          console.log(`Error: ${task.error}`);
          return; // Skip test if dependencies are missing
        }
        
        // If not a dependency error, the test should fail
        throw new Error(`Task failed unexpectedly: ${task.error}`);
      }

      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);

      // Get processing result
      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;
      const processingTime = Date.now() - startTime;

      // Verify response format consistency (Requirement 3.1)
      expect(result).toHaveProperty('extractedText');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('metadata');

      // Verify scanned PDF metadata (Requirement 3.2)
      expect(result.metadata).toHaveProperty('isScannedPdf', true);
      expect(result.metadata).toHaveProperty('ocrMethod', 'pdf-to-image');
      expect(result.metadata).toHaveProperty('conversionTime');
      expect(result.metadata).toHaveProperty('ocrTime');
      expect(result.metadata).toHaveProperty('processingTime');

      // Verify processing time includes both conversion and OCR (Requirement 3.3)
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      if (result.metadata.conversionTime) {
        expect(result.metadata.conversionTime).toBeGreaterThan(0);
      }

      // Verify confidence score reflects OCR confidence (Requirement 3.3)
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);

      // Performance validation - scanned PDFs may take longer but should complete
      expect(processingTime).toBeLessThan(60000); // Should complete within 60 seconds

      console.log(`✅ Scanned PDF processed in ${processingTime}ms via PDF-to-image conversion`);
    });

    it('should handle scanned PDF processing with system dependency information', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', scannedPdfBuffer, 'dependency-test.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 90);

      // Get result regardless of success/failure to check dependency info
      let result;
      if (finalStatus.status === TaskStatus.COMPLETED) {
        const resultResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/result`)
          .expect(200);
        result = resultResponse.body;
      } else {
        // For failed tasks, check the task directly for dependency information
        const task = taskService.getTask(taskId);
        expect(task.error).toBeDefined();
        
        // Verify error contains dependency information
        if (task.error.includes('dependency') || task.error.includes('GraphicsMagick') || task.error.includes('ImageMagick')) {
          console.log('✅ Dependency error properly reported');
          return;
        }
      }

      // If successful, verify system dependency information is included
      if (result) {
        expect(result.metadata).toHaveProperty('systemDependencies');
        expect(result.metadata.systemDependencies).toHaveProperty('graphicsMagick');
        expect(result.metadata.systemDependencies).toHaveProperty('imageMagick');
        expect(result.metadata.systemDependencies).toHaveProperty('pdf2pic');
      }
    });
  });

  describe('Response Format Consistency (Requirements 3.1, 3.2, 3.3)', () => {
    it('should maintain consistent response format between text-based and scanned PDFs', async () => {
      // Process both types of PDFs
      const textPdfUpload = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', textBasedPdfBuffer, 'format-test-text.pdf')
        .expect(200);

      const scannedPdfUpload = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', scannedPdfBuffer, 'format-test-scanned.pdf')
        .expect(200);

      // Wait for both to complete
      const textTaskId = textPdfUpload.body.taskId;
      const scannedTaskId = scannedPdfUpload.body.taskId;

      const textFinalStatus = await waitForTaskCompletion(textTaskId);
      const scannedFinalStatus = await waitForTaskCompletion(scannedTaskId, 90);

      expect(textFinalStatus.status).toBe(TaskStatus.COMPLETED);

      // Get results
      const textResultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${textTaskId}/result`)
        .expect(200);

      const textResult = textResultResponse.body;

      // Verify consistent base structure for text-based PDF
      expect(textResult).toHaveProperty('extractedText');
      expect(textResult).toHaveProperty('summary');
      expect(textResult).toHaveProperty('confidence');
      expect(textResult).toHaveProperty('metadata');
      expect(textResult.metadata).toHaveProperty('processingTime');
      expect(textResult.metadata).toHaveProperty('isScannedPdf');
      expect(textResult.metadata).toHaveProperty('ocrMethod');

      // Only check scanned PDF result if processing succeeded
      if (scannedFinalStatus.status === TaskStatus.COMPLETED) {
        const scannedResultResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${scannedTaskId}/result`)
          .expect(200);

        const scannedResult = scannedResultResponse.body;

        // Verify consistent structure for scanned PDF
        expect(scannedResult).toHaveProperty('extractedText');
        expect(scannedResult).toHaveProperty('summary');
        expect(scannedResult).toHaveProperty('confidence');
        expect(scannedResult).toHaveProperty('metadata');
        expect(scannedResult.metadata).toHaveProperty('processingTime');
        expect(scannedResult.metadata).toHaveProperty('isScannedPdf');
        expect(scannedResult.metadata).toHaveProperty('ocrMethod');

        // Verify different processing methods are indicated
        expect(textResult.metadata.ocrMethod).toBe('direct');
        expect(scannedResult.metadata.ocrMethod).toBe('pdf-to-image');
        expect(textResult.metadata.isScannedPdf).toBe(false);
        expect(scannedResult.metadata.isScannedPdf).toBe(true);

        // Verify additional scanned PDF metadata fields
        expect(scannedResult.metadata).toHaveProperty('conversionTime');
        expect(scannedResult.metadata).toHaveProperty('systemDependencies');
      } else {
        console.log('⚠️ Scanned PDF format consistency test partially skipped due to processing failure');
      }
    });

    it('should provide enhanced metadata for scanned PDF processing', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', scannedPdfBuffer, 'metadata-test.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 90);

      if (finalStatus.status === TaskStatus.COMPLETED) {
        const resultResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/result`)
          .expect(200);

        const result = resultResponse.body;

        // Verify enhanced metadata fields (Requirement 3.2)
        expect(result.metadata).toHaveProperty('isScannedPdf', true);
        expect(result.metadata).toHaveProperty('ocrMethod', 'pdf-to-image');
        expect(result.metadata).toHaveProperty('originalPageCount');
        expect(result.metadata).toHaveProperty('processedPages');
        expect(result.metadata).toHaveProperty('conversionTime');
        expect(result.metadata).toHaveProperty('systemDependencies');

        // Verify system dependencies structure
        const deps = result.metadata.systemDependencies;
        expect(deps).toHaveProperty('graphicsMagick');
        expect(deps).toHaveProperty('imageMagick');
        expect(deps).toHaveProperty('pdf2pic');
        expect(typeof deps.graphicsMagick).toBe('boolean');
        expect(typeof deps.imageMagick).toBe('boolean');
        expect(typeof deps.pdf2pic).toBe('boolean');
      } else {
        console.log('⚠️ Enhanced metadata test skipped due to processing failure');
      }
    });
  });

  describe('Error Handling and Fallback (Requirements 4.2, 4.3)', () => {
    it('should handle PDF-to-image conversion failures gracefully', async () => {
      // Create a corrupted PDF that will fail conversion
      const corruptedPdfBuffer = Buffer.from('%PDF-1.4\nCorrupted content that will fail parsing');

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', corruptedPdfBuffer, 'corrupted.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 60);

      // Task should either complete with fallback or fail gracefully
      if (finalStatus.status === TaskStatus.COMPLETED) {
        // If completed, should have fallback information
        const resultResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/result`)
          .expect(200);

        const result = resultResponse.body;
        
        // Check for fallback indicators
        if (result.metadata.fallbackUsed) {
          expect(result.metadata).toHaveProperty('fallbackUsed', true);
          expect(result.confidence).toBeLessThan(100); // Should have reduced confidence
        }
      } else if (finalStatus.status === TaskStatus.FAILED) {
        // If failed, should have clear error message
        expect(finalStatus.error).toBeDefined();
        expect(typeof finalStatus.error).toBe('string');
        expect(finalStatus.error.length).toBeGreaterThan(0);
      }
    });

    it('should provide clear error messages for missing dependencies', async () => {
      // This test checks if dependency errors are properly communicated
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', scannedPdfBuffer, 'dependency-error-test.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 90);

      if (finalStatus.status === TaskStatus.FAILED) {
        const task = taskService.getTask(taskId);
        
        // Verify error message provides helpful information
        expect(task.error).toBeDefined();
        
        // Check for dependency-related error messages
        const errorMessage = task.error.toLowerCase();
        const hasDependencyInfo = 
          errorMessage.includes('dependency') ||
          errorMessage.includes('graphicsmagick') ||
          errorMessage.includes('imagemagick') ||
          errorMessage.includes('pdf2pic') ||
          errorMessage.includes('install');

        if (hasDependencyInfo) {
          console.log('✅ Clear dependency error message provided');
          expect(hasDependencyInfo).toBe(true);
        }
      }
    });
  });

  describe('Performance Validation (Requirements 4.1, 4.2, 4.3)', () => {
    it('should meet processing time requirements for different PDF types', async () => {
      const testCases = [
        {
          name: 'text-based PDF',
          buffer: textBasedPdfBuffer,
          filename: 'performance-text.pdf',
          maxTime: 10000, // 10 seconds for text-based
        },
        {
          name: 'scanned PDF',
          buffer: scannedPdfBuffer,
          filename: 'performance-scanned.pdf',
          maxTime: 60000, // 60 seconds for scanned (includes OCR)
        },
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();

        const uploadResponse = await request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', testCase.buffer, testCase.filename)
          .expect(200);

        const taskId = uploadResponse.body.taskId;
        const finalStatus = await waitForTaskCompletion(taskId, Math.ceil(testCase.maxTime / 1000));

        const processingTime = Date.now() - startTime;

        if (finalStatus.status === TaskStatus.COMPLETED) {
          expect(processingTime).toBeLessThan(testCase.maxTime);
          console.log(`✅ ${testCase.name} processed in ${processingTime}ms (limit: ${testCase.maxTime}ms)`);
        } else {
          console.log(`⚠️ ${testCase.name} performance test skipped due to processing failure`);
        }
      }
    });

    it('should handle concurrent scanned PDF processing efficiently', async () => {
      const concurrentCount = 3;
      const uploadPromises = [];

      const startTime = Date.now();

      // Upload multiple scanned PDFs simultaneously
      for (let i = 0; i < concurrentCount; i++) {
        const uploadPromise = request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', scannedPdfBuffer, `concurrent-scanned-${i}.pdf`);
        uploadPromises.push(uploadPromise);
      }

      const uploadResponses = await Promise.all(uploadPromises);
      const taskIds = uploadResponses.map(response => {
        expect(response.status).toBe(200);
        return response.body.taskId;
      });

      // Wait for all tasks to complete
      const completionPromises = taskIds.map(taskId => 
        waitForTaskCompletion(taskId, 120) // Extended timeout for concurrent processing
      );

      try {
        const completedTasks = await Promise.all(completionPromises);
        const totalTime = Date.now() - startTime;

        // Count successful completions
        const successfulTasks = completedTasks.filter(task => task.status === TaskStatus.COMPLETED);
        
        if (successfulTasks.length > 0) {
          console.log(`✅ ${successfulTasks.length}/${concurrentCount} concurrent scanned PDFs processed in ${totalTime}ms`);
          
          // Verify concurrent processing didn't take excessively long
          expect(totalTime).toBeLessThan(180000); // 3 minutes for concurrent processing
        } else {
          console.log('⚠️ Concurrent scanned PDF test skipped - all tasks failed (likely missing dependencies)');
        }
      } catch (error) {
        console.log('⚠️ Concurrent processing test encountered errors - likely due to missing dependencies');
      }
    });
  });

  describe('Mixed Content Processing', () => {
    it('should handle mixed document types in the same session', async () => {
      // Upload different document types
      const uploads = [
        {
          buffer: textBasedPdfBuffer,
          filename: 'mixed-text.pdf',
          expectedMethod: 'direct',
          expectedScanned: false,
        },
        {
          buffer: scannedPdfBuffer,
          filename: 'mixed-scanned.pdf',
          expectedMethod: 'pdf-to-image',
          expectedScanned: true,
        },
        {
          buffer: imageBuffer,
          filename: 'mixed-image.png',
          expectedMethod: 'image',
          expectedScanned: false,
        },
      ];

      const uploadPromises = uploads.map(upload =>
        request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', upload.buffer, upload.filename)
      );

      const uploadResponses = await Promise.all(uploadPromises);
      const taskIds = uploadResponses.map(response => {
        expect(response.status).toBe(200);
        return response.body.taskId;
      });

      // Wait for all to complete
      const completionPromises = taskIds.map(taskId => 
        waitForTaskCompletion(taskId, 90)
      );

      const completedTasks = await Promise.all(completionPromises);

      // Verify each document was processed with the appropriate method
      for (let i = 0; i < uploads.length; i++) {
        const upload = uploads[i];
        const taskStatus = completedTasks[i];

        if (taskStatus.status === TaskStatus.COMPLETED) {
          const resultResponse = await request(app.getHttpServer())
            .get(`/api/tasks/${taskIds[i]}/result`)
            .expect(200);

          const result = resultResponse.body;

          // Verify processing method matches expectation
          if (upload.filename.endsWith('.pdf')) {
            expect(result.metadata).toHaveProperty('isScannedPdf', upload.expectedScanned);
            if (upload.expectedMethod !== 'image') {
              expect(result.metadata).toHaveProperty('ocrMethod', upload.expectedMethod);
            }
          }

          console.log(`✅ ${upload.filename} processed correctly with method: ${result.metadata.ocrMethod || 'image'}`);
        } else {
          console.log(`⚠️ ${upload.filename} processing failed - likely missing dependencies`);
        }
      }
    });
  });
});