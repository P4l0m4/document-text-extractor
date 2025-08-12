import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  ProcessingService,
  ProcessingOptions,
} from '../src/processing/processing.service';
import { ProcessingModule } from '../src/processing/processing.module';
import { AiModelService } from '../src/ai/ai-model.service';
import { TaskService } from '../src/task/task.service';
import {
  TaskStatus,
  ProcessingResult,
} from '../src/common/interfaces/task.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ProcessingService (e2e)', () => {
  let app: INestApplication;
  let processingService: ProcessingService;
  let taskService: TaskService;
  let aiModelService: AiModelService;
  let tempDir: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProcessingModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    processingService = moduleFixture.get<ProcessingService>(ProcessingService);
    taskService = moduleFixture.get<TaskService>(TaskService);
    aiModelService = moduleFixture.get<AiModelService>(AiModelService);

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'processing-test-'));
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

  describe('Document Processing Workflow', () => {
    it('should process a complete image workflow with progress tracking', async () => {
      // Arrange
      const taskId = 'integration-test-task-1';
      const fileName = 'test-image.png';
      const testImagePath = path.join(tempDir, fileName);

      // Create a mock image file (1x1 PNG)
      const mockImageBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x35, 0xa4, 0x29, 0x2e, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      fs.writeFileSync(testImagePath, mockImageBuffer);

      // Create task
      taskService.createTask(taskId, fileName, 'image/png');

      // Act
      const result = await processingService.processDocument(
        taskId,
        testImagePath,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.extractedText).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.fileSize).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);

      // Verify task was updated correctly
      const finalTask = taskService.getTask(taskId);
      expect(finalTask.status).toBe(TaskStatus.COMPLETED);
      expect(finalTask.progress).toBe(100);
      expect(finalTask.result).toEqual(result);
    });

    it('should process a PDF workflow with progress tracking', async () => {
      // Arrange
      const taskId = 'integration-test-task-2';
      const fileName = 'test-document.pdf';
      const testPdfPath = path.join(tempDir, fileName);

      // Create a minimal PDF file
      const mockPdfContent = `%PDF-1.4
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
(Hello World) Tj
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
      fs.writeFileSync(testPdfPath, mockPdfContent);

      // Create task
      taskService.createTask(taskId, fileName, 'application/pdf');

      // Act
      const result = await processingService.processDocument(
        taskId,
        testPdfPath,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.extractedText).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.fileSize).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);

      // Verify task was updated correctly
      const finalTask = taskService.getTask(taskId);
      expect(finalTask.status).toBe(TaskStatus.COMPLETED);
      expect(finalTask.progress).toBe(100);
      expect(finalTask.result).toEqual(result);
    });

    it('should handle processing options correctly', async () => {
      // Arrange
      const taskId = 'integration-test-task-3';
      const fileName = 'test-image-no-summary.png';
      const testImagePath = path.join(tempDir, fileName);

      // Create a mock image file
      const mockImageBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x35, 0xa4, 0x29, 0x2e, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      fs.writeFileSync(testImagePath, mockImageBuffer);

      // Create task
      taskService.createTask(taskId, fileName, 'image/png');

      const options: ProcessingOptions = {
        generateSummary: false,
      };

      // Act
      const result = await processingService.processDocument(
        taskId,
        testImagePath,
        options,
      );

      // Assert
      expect(result.summary).toBe('');
      expect(result.extractedText).toBeDefined();
    });

    it('should handle concurrent document processing', async () => {
      // Arrange
      const requests = [
        {
          taskId: 'concurrent-task-1',
          filePath: path.join(tempDir, 'concurrent1.png'),
        },
        {
          taskId: 'concurrent-task-2',
          filePath: path.join(tempDir, 'concurrent2.png'),
        },
        {
          taskId: 'concurrent-task-3',
          filePath: path.join(tempDir, 'concurrent3.png'),
        },
      ];

      // Create mock image files and tasks
      const mockImageBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x35, 0xa4, 0x29, 0x2e, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      requests.forEach((request, index) => {
        fs.writeFileSync(request.filePath, mockImageBuffer);
        taskService.createTask(
          request.taskId,
          `concurrent${index + 1}.png`,
          'image/png',
        );
      });

      // Act
      const startTime = Date.now();
      const results = await processingService.processDocuments(requests);
      const totalTime = Date.now() - startTime;

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.extractedText).toBeDefined();
        expect(result.metadata.processingTime).toBeGreaterThan(0);

        // Verify task completion
        const task = taskService.getTask(requests[index].taskId);
        expect(task.status).toBe(TaskStatus.COMPLETED);
        expect(task.progress).toBe(100);
      });

      // Concurrent processing should be faster than sequential
      console.log(`Concurrent processing completed in ${totalTime}ms`);
    });

    it('should handle processing errors gracefully', async () => {
      // Arrange
      const taskId = 'error-test-task';
      const fileName = 'non-existent.png';
      const nonExistentPath = path.join(tempDir, fileName);

      // Create task
      taskService.createTask(taskId, fileName, 'image/png');

      // Act & Assert
      await expect(
        processingService.processDocument(taskId, nonExistentPath),
      ).rejects.toThrow();

      // Verify task was marked as failed
      const failedTask = taskService.getTask(taskId);
      expect(failedTask.status).toBe(TaskStatus.FAILED);
      expect(failedTask.error).toBeDefined();
    });

    it('should handle unsupported file types', async () => {
      // Arrange
      const taskId = 'unsupported-file-task';
      const fileName = 'test.txt';
      const testFilePath = path.join(tempDir, fileName);

      fs.writeFileSync(testFilePath, 'This is a text file');
      taskService.createTask(taskId, fileName, 'text/plain');

      // Act & Assert
      await expect(
        processingService.processDocument(taskId, testFilePath),
      ).rejects.toThrow('Unsupported file type: .txt');

      // Verify task was marked as failed
      const failedTask = taskService.getTask(taskId);
      expect(failedTask.status).toBe(TaskStatus.FAILED);
      expect(failedTask.error).toContain('Unsupported file type');
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress throughout processing lifecycle', async () => {
      // Arrange
      const taskId = 'progress-tracking-task';
      const fileName = 'progress-test.png';
      const testImagePath = path.join(tempDir, fileName);

      const mockImageBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x35, 0xa4, 0x29, 0x2e, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      fs.writeFileSync(testImagePath, mockImageBuffer);

      taskService.createTask(taskId, fileName, 'image/png');

      // Act
      const processingPromise = processingService.processDocument(
        taskId,
        testImagePath,
      );

      // Check initial progress
      let progress = processingService.getProcessingProgress(taskId);
      expect(progress.status).toBe(TaskStatus.PROCESSING);

      // Wait for completion
      await processingPromise;

      // Check final progress
      progress = processingService.getProcessingProgress(taskId);
      expect(progress.status).toBe(TaskStatus.COMPLETED);
      expect(progress.progress).toBe(100);
    });

    it('should handle progress queries for non-existent tasks', () => {
      // Act & Assert
      expect(() =>
        processingService.getProcessingProgress('non-existent-task'),
      ).toThrow();
    });
  });

  describe('File Type Validation', () => {
    it('should validate supported file types correctly', () => {
      expect(processingService.isSupportedFileType('/path/to/image.png')).toBe(
        true,
      );
      expect(processingService.isSupportedFileType('/path/to/image.jpg')).toBe(
        true,
      );
      expect(processingService.isSupportedFileType('/path/to/image.jpeg')).toBe(
        true,
      );
      expect(
        processingService.isSupportedFileType('/path/to/document.pdf'),
      ).toBe(true);

      expect(
        processingService.isSupportedFileType('/path/to/document.txt'),
      ).toBe(false);
      expect(
        processingService.isSupportedFileType('/path/to/document.docx'),
      ).toBe(false);
      expect(processingService.isSupportedFileType('/path/to/image.gif')).toBe(
        false,
      );
    });

    it('should return correct supported extensions', () => {
      const extensions = processingService.getSupportedExtensions();
      expect(extensions).toEqual(['.png', '.jpg', '.jpeg', '.pdf']);
    });
  });
});
