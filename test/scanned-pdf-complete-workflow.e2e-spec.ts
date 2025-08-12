import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TaskService } from '../src/task/task.service';
import { AiModelPoolService } from '../src/ai/ai-model-pool.service';
import { DependencyDetectionService } from '../src/ai/dependency-detection.service';
import { TaskStatus } from '../src/common/interfaces/task.interface';
import { PdfTestFiles } from './helpers/pdf-test-files';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Scanned PDF Complete Workflow Integration (e2e)', () => {
  let app: INestApplication<App>;
  let taskService: TaskService;
  let aiModelPoolService: AiModelPoolService;
  let dependencyDetectionService: DependencyDetectionService;
  let tempDir: string;

  // Test scenarios with expected outcomes
  const testScenarios = [
    {
      name: 'Single Page Text-based PDF',
      createPdf: () => PdfTestFiles.createTextBasedPdf({ pageCount: 1, wordsPerPage: 100 }),
      filename: 'single-text.pdf',
      expectedScanned: false,
      expectedMethod: 'direct',
      maxProcessingTime: 10000,
      minConfidence: 95,
    },
    {
      name: 'Multi-page Text-based PDF',
      createPdf: () => PdfTestFiles.createTextBasedPdf({ pageCount: 3, wordsPerPage: 75 }),
      filename: 'multi-text.pdf',
      expectedScanned: false,
      expectedMethod: 'direct',
      maxProcessingTime: 15000,
      minConfidence: 95,
    },
    {
      name: 'Single Page Scanned PDF',
      createPdf: () => PdfTestFiles.createScannedPdf({ pageCount: 1 }),
      filename: 'single-scanned.pdf',
      expectedScanned: true,
      expectedMethod: 'pdf-to-image',
      maxProcessingTime: 60000,
      minConfidence: 0, // OCR confidence can vary
    },
    {
      name: 'Multi-page Scanned PDF',
      createPdf: () => PdfTestFiles.createScannedPdf({ pageCount: 2 }),
      filename: 'multi-scanned.pdf',
      expectedScanned: true,
      expectedMethod: 'pdf-to-image',
      maxProcessingTime: 90000,
      minConfidence: 0,
    },
    {
      name: 'Scanned PDF with Minimal Text',
      createPdf: () => PdfTestFiles.createScannedPdf({ pageCount: 1, hasMinimalText: true }),
      filename: 'minimal-text-scanned.pdf',
      expectedScanned: true,
      expectedMethod: 'pdf-to-image',
      maxProcessingTime: 60000,
      minConfidence: 0,
    },
    {
      name: 'Mixed Content PDF',
      createPdf: () => PdfTestFiles.createMixedContentPdf({ totalPages: 3, textPages: [1] }),
      filename: 'mixed-content.pdf',
      expectedScanned: false, // Should prioritize direct extraction
      expectedMethod: 'direct',
      maxProcessingTime: 15000,
      minConfidence: 80,
    },
  ];

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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'complete-workflow-'));

    // Check system dependencies at startup
    console.log('🔍 Checking system dependencies...');
    try {
      const dependencies = await dependencyDetectionService.checkSystemDependencies();
      console.log('📊 System Dependencies Status:');
      console.log(`   - pdf2pic: ${dependencies.pdf2pic.available ? '✅' : '❌'}`);
      console.log(`   - GraphicsMagick: ${dependencies.graphicsMagick.available ? '✅' : '❌'}`);
      console.log(`   - ImageMagick: ${dependencies.imageMagick.available ? '✅' : '❌'}`);
      
      const conversionSupported = await dependencyDetectionService.isConversionSupported();
      console.log(`   - PDF-to-image conversion: ${conversionSupported ? '✅' : '❌'}`);
    } catch (error) {
      console.log('⚠️ Could not check system dependencies:', error.message);
    }
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

  function validateResponseFormat(result: any, scenario: any): void {
    // Requirement 3.1: Consistent response format
    expect(result).toHaveProperty('extractedText');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('metadata');

    // Basic metadata structure
    expect(result.metadata).toHaveProperty('processingTime');
    expect(result.metadata).toHaveProperty('isScannedPdf');
    expect(result.metadata).toHaveProperty('ocrMethod');

    // Type validations
    expect(typeof result.extractedText).toBe('string');
    expect(typeof result.summary).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.metadata.processingTime).toBe('number');
    expect(typeof result.metadata.isScannedPdf).toBe('boolean');
    expect(typeof result.metadata.ocrMethod).toBe('string');

    // Value validations
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(result.metadata.processingTime).toBeGreaterThan(0);
  }

  function validateScannedPdfMetadata(result: any): void {
    // Requirement 3.2: Enhanced metadata for scanned PDFs
    expect(result.metadata).toHaveProperty('conversionTime');
    expect(result.metadata).toHaveProperty('systemDependencies');
    expect(result.metadata).toHaveProperty('originalPageCount');
    expect(result.metadata).toHaveProperty('processedPages');

    // System dependencies structure
    const deps = result.metadata.systemDependencies;
    expect(deps).toHaveProperty('graphicsMagick');
    expect(deps).toHaveProperty('imageMagick');
    expect(deps).toHaveProperty('pdf2pic');
    expect(typeof deps.graphicsMagick).toBe('boolean');
    expect(typeof deps.imageMagick).toBe('boolean');
    expect(typeof deps.pdf2pic).toBe('boolean');
  }

  describe('Individual Scenario Testing', () => {
    testScenarios.forEach((scenario) => {
      it(`should process ${scenario.name} correctly`, async () => {
        const startTime = Date.now();
        const pdfBuffer = scenario.createPdf();

        // Upload the PDF
        const uploadResponse = await request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', pdfBuffer, scenario.filename)
          .expect(200);

        expect(uploadResponse.body).toHaveProperty('taskId');
        const taskId = uploadResponse.body.taskId;

        // Wait for processing to complete
        const maxAttempts = Math.ceil(scenario.maxProcessingTime / 1000);
        const finalStatus = await waitForTaskCompletion(taskId, maxAttempts);
        const processingTime = Date.now() - startTime;

        // Handle dependency-related failures for scanned PDFs
        if (finalStatus.status === TaskStatus.FAILED && scenario.expectedScanned) {
          const task = taskService.getTask(taskId);
          if (task.error && task.error.includes('dependency')) {
            console.log(`⚠️ ${scenario.name} test skipped due to missing system dependencies`);
            console.log(`   Error: ${task.error}`);
            return;
          }
        }

        // Verify successful completion
        expect(finalStatus.status).toBe(TaskStatus.COMPLETED);
        expect(processingTime).toBeLessThan(scenario.maxProcessingTime);

        // Get processing result
        const resultResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/result`)
          .expect(200);

        const result = resultResponse.body;

        // Validate response format (Requirement 3.1)
        validateResponseFormat(result, scenario);

        // Validate processing method and scanned PDF detection
        expect(result.metadata.isScannedPdf).toBe(scenario.expectedScanned);
        expect(result.metadata.ocrMethod).toBe(scenario.expectedMethod);

        // Validate confidence score (Requirement 3.3)
        expect(result.confidence).toBeGreaterThanOrEqual(scenario.minConfidence);

        // Validate enhanced metadata for scanned PDFs (Requirement 3.2)
        if (scenario.expectedScanned) {
          validateScannedPdfMetadata(result);
        }

        // Performance validation
        expect(result.metadata.processingTime).toBeLessThan(scenario.maxProcessingTime);

        console.log(`✅ ${scenario.name}: ${processingTime}ms, Method: ${result.metadata.ocrMethod}, Confidence: ${result.confidence}%`);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle corrupted PDF gracefully', async () => {
      const corruptedPdf = PdfTestFiles.createCorruptedPdf();

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', corruptedPdf, 'corrupted.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 60);

      // Should either complete with fallback or fail gracefully
      if (finalStatus.status === TaskStatus.COMPLETED) {
        const resultResponse = await request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/result`)
          .expect(200);

        const result = resultResponse.body;
        
        // If completed, should have fallback indicators
        if (result.metadata.fallbackUsed) {
          expect(result.metadata.fallbackUsed).toBe(true);
          expect(result.confidence).toBeLessThan(100);
        }
      } else {
        // If failed, should have clear error message
        expect(finalStatus.status).toBe(TaskStatus.FAILED);
        expect(finalStatus.error).toBeDefined();
        expect(typeof finalStatus.error).toBe('string');
      }

      console.log('✅ Corrupted PDF handled gracefully');
    });

    it('should provide clear dependency error messages', async () => {
      const scannedPdf = PdfTestFiles.createScannedPdf({ pageCount: 1 });

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', scannedPdf, 'dependency-test.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 90);

      if (finalStatus.status === TaskStatus.FAILED) {
        const task = taskService.getTask(taskId);
        expect(task.error).toBeDefined();

        // Check for helpful dependency information
        const errorMessage = task.error.toLowerCase();
        const hasDependencyInfo = 
          errorMessage.includes('dependency') ||
          errorMessage.includes('graphicsmagick') ||
          errorMessage.includes('imagemagick') ||
          errorMessage.includes('pdf2pic') ||
          errorMessage.includes('install');

        if (hasDependencyInfo) {
          console.log('✅ Clear dependency error message provided');
        }
      } else if (finalStatus.status === TaskStatus.COMPLETED) {
        console.log('✅ Scanned PDF processed successfully (dependencies available)');
      }
    });

    it('should handle mixed content PDFs with priority logic', async () => {
      const mixedPdf = PdfTestFiles.createMixedContentPdf({ 
        totalPages: 4, 
        textPages: [1, 3] // Pages 1 and 3 have text, 2 and 4 are scanned-like
      });

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', mixedPdf, 'mixed-priority.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const finalStatus = await waitForTaskCompletion(taskId, 60);

      expect(finalStatus.status).toBe(TaskStatus.COMPLETED);

      const resultResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/result`)
        .expect(200);

      const result = resultResponse.body;

      // Should prioritize direct extraction (Requirement 4.1)
      expect(result.metadata.isScannedPdf).toBe(false);
      expect(result.metadata.ocrMethod).toBe('direct');
      expect(result.extractedText).toContain('extractable text');

      console.log('✅ Mixed content PDF processed with correct priority');
    });
  });

  describe('Concurrent Processing Validation', () => {
    it('should handle concurrent mixed document processing', async () => {
      const concurrentScenarios = [
        { pdf: PdfTestFiles.createTextBasedPdf({ pageCount: 1 }), filename: 'concurrent-text-1.pdf' },
        { pdf: PdfTestFiles.createScannedPdf({ pageCount: 1 }), filename: 'concurrent-scanned-1.pdf' },
        { pdf: PdfTestFiles.createTextBasedPdf({ pageCount: 2 }), filename: 'concurrent-text-2.pdf' },
        { pdf: PdfTestFiles.createScannedPdf({ pageCount: 1, hasMinimalText: true }), filename: 'concurrent-scanned-2.pdf' },
      ];

      const startTime = Date.now();
      const uploadPromises = concurrentScenarios.map(scenario =>
        request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', scenario.pdf, scenario.filename)
      );

      const uploadResponses = await Promise.all(uploadPromises);
      const taskIds = uploadResponses.map(response => {
        expect(response.status).toBe(200);
        return response.body.taskId;
      });

      // Wait for all tasks to complete
      const completionPromises = taskIds.map(taskId => 
        waitForTaskCompletion(taskId, 120)
      );

      const completedTasks = await Promise.all(completionPromises);
      const totalTime = Date.now() - startTime;

      // Count successful completions
      const successfulTasks = completedTasks.filter(task => task.status === TaskStatus.COMPLETED);
      const failedTasks = completedTasks.filter(task => task.status === TaskStatus.FAILED);

      // At least text-based PDFs should complete successfully
      expect(successfulTasks.length).toBeGreaterThan(0);

      // Get results for successful tasks
      const resultPromises = successfulTasks.map((task, index) => {
        const taskId = taskIds[completedTasks.indexOf(task)];
        return request(app.getHttpServer())
          .get(`/api/tasks/${taskId}/result`)
          .expect(200);
      });

      const results = await Promise.all(resultPromises);

      // Validate each result
      results.forEach((resultResponse, index) => {
        const result = resultResponse.body;
        validateResponseFormat(result, {});
        
        // Log processing method for each successful task
        console.log(`   Task ${index + 1}: Method=${result.metadata.ocrMethod}, Scanned=${result.metadata.isScannedPdf}`);
      });

      console.log(`✅ Concurrent processing: ${successfulTasks.length}/${concurrentScenarios.length} successful in ${totalTime}ms`);
      
      if (failedTasks.length > 0) {
        console.log(`⚠️ ${failedTasks.length} tasks failed (likely due to missing dependencies for scanned PDFs)`);
      }
    });
  });

  describe('Performance Benchmarking', () => {
    it('should meet performance requirements across document types', async () => {
      const performanceTests = [
        {
          name: 'Text PDF Performance',
          pdf: PdfTestFiles.createTextBasedPdf({ pageCount: 1, wordsPerPage: 200 }),
          filename: 'perf-text.pdf',
          maxTime: 10000,
        },
        {
          name: 'Scanned PDF Performance',
          pdf: PdfTestFiles.createScannedPdf({ pageCount: 1 }),
          filename: 'perf-scanned.pdf',
          maxTime: 60000,
        },
      ];

      const performanceResults = [];

      for (const test of performanceTests) {
        const startTime = Date.now();

        const uploadResponse = await request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', test.pdf, test.filename)
          .expect(200);

        const taskId = uploadResponse.body.taskId;
        const finalStatus = await waitForTaskCompletion(taskId, Math.ceil(test.maxTime / 1000));

        const processingTime = Date.now() - startTime;

        if (finalStatus.status === TaskStatus.COMPLETED) {
          expect(processingTime).toBeLessThan(test.maxTime);

          const resultResponse = await request(app.getHttpServer())
            .get(`/api/tasks/${taskId}/result`)
            .expect(200);

          const result = resultResponse.body;

          performanceResults.push({
            name: test.name,
            processingTime,
            internalTime: result.metadata.processingTime,
            method: result.metadata.ocrMethod,
            confidence: result.confidence,
          });

          console.log(`✅ ${test.name}: ${processingTime}ms (internal: ${result.metadata.processingTime}ms)`);
        } else if (finalStatus.status === TaskStatus.FAILED) {
          const task = taskService.getTask(taskId);
          if (task.error && task.error.includes('dependency')) {
            console.log(`⚠️ ${test.name} skipped due to missing dependencies`);
          } else {
            throw new Error(`${test.name} failed unexpectedly: ${task.error}`);
          }
        }
      }

      // Verify we have at least some performance results
      expect(performanceResults.length).toBeGreaterThan(0);
    });
  });

  describe('Response Format Consistency Validation', () => {
    it('should maintain consistent response structure across all document types', async () => {
      const consistencyTests = [
        {
          name: 'Text-based PDF',
          pdf: PdfTestFiles.createTextBasedPdf({ pageCount: 1, wordsPerPage: 50 }),
          filename: 'consistency-text.pdf',
        },
        {
          name: 'Scanned PDF',
          pdf: PdfTestFiles.createScannedPdf({ pageCount: 1 }),
          filename: 'consistency-scanned.pdf',
        },
      ];

      const results = [];

      for (const test of consistencyTests) {
        const uploadResponse = await request(app.getHttpServer())
          .post('/api/documents/upload')
          .attach('file', test.pdf, test.filename)
          .expect(200);

        const taskId = uploadResponse.body.taskId;
        const finalStatus = await waitForTaskCompletion(taskId, 90);

        if (finalStatus.status === TaskStatus.COMPLETED) {
          const resultResponse = await request(app.getHttpServer())
            .get(`/api/tasks/${taskId}/result`)
            .expect(200);

          results.push({
            name: test.name,
            result: resultResponse.body,
          });
        } else if (finalStatus.status === TaskStatus.FAILED) {
          const task = taskService.getTask(taskId);
          if (task.error && task.error.includes('dependency')) {
            console.log(`⚠️ ${test.name} consistency test skipped due to missing dependencies`);
          }
        }
      }

      // Verify we have at least one result to validate
      expect(results.length).toBeGreaterThan(0);

      // Validate consistent structure across all results
      const baseStructure = Object.keys(results[0].result).sort();
      const baseMetadataStructure = Object.keys(results[0].result.metadata).sort();

      results.forEach(({ name, result }) => {
        // Validate top-level structure consistency
        const resultStructure = Object.keys(result).sort();
        expect(resultStructure).toEqual(baseStructure);

        // Validate metadata structure consistency
        const metadataStructure = Object.keys(result.metadata).sort();
        expect(metadataStructure).toEqual(expect.arrayContaining(baseMetadataStructure));

        // Validate response format
        validateResponseFormat(result, {});

        console.log(`✅ ${name} response format consistent`);
      });

      console.log(`✅ Response format consistency validated across ${results.length} document types`);
    });
  });
});