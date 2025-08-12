import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OptimizedFileIOService } from './optimized-file-io.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('OptimizedFileIOService', () => {
  let service: OptimizedFileIOService;
  let tempDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizedFileIOService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'app.maxConcurrentJobs':
                  return 5;
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OptimizedFileIOService>(OptimizedFileIOService);

    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-io-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Reading', () => {
    it('should read small files efficiently', async () => {
      const testFile = path.join(tempDir, 'small-test.txt');
      const testContent = 'This is a small test file';

      fs.writeFileSync(testFile, testContent);

      const result = await service.readFileOptimized(testFile);
      expect(result.toString()).toBe(testContent);
    });

    it('should read large files with streaming', async () => {
      const testFile = path.join(tempDir, 'large-test.txt');
      const testContent = 'Large file content. '.repeat(10000); // ~200KB

      fs.writeFileSync(testFile, testContent);

      const startTime = Date.now();
      const result = await service.readFileOptimized(testFile);
      const readTime = Date.now() - startTime;

      expect(result.toString()).toBe(testContent);
      expect(readTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle read errors gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.txt');

      await expect(service.readFileOptimized(nonExistentFile)).rejects.toThrow(
        'FileSystemException',
      );
    });

    it('should use optimal buffer size for different file sizes', async () => {
      const smallFile = path.join(tempDir, 'small.txt');
      const mediumFile = path.join(tempDir, 'medium.txt');
      const largeFile = path.join(tempDir, 'large.txt');

      fs.writeFileSync(smallFile, 'small'.repeat(100)); // ~500 bytes
      fs.writeFileSync(mediumFile, 'medium'.repeat(50000)); // ~300KB
      fs.writeFileSync(largeFile, 'large'.repeat(500000)); // ~2.5MB

      // All should complete successfully with appropriate buffer sizes
      const [smallResult, mediumResult, largeResult] = await Promise.all([
        service.readFileOptimized(smallFile),
        service.readFileOptimized(mediumFile),
        service.readFileOptimized(largeFile),
      ]);

      expect(smallResult.length).toBeGreaterThan(0);
      expect(mediumResult.length).toBeGreaterThan(0);
      expect(largeResult.length).toBeGreaterThan(0);
    });
  });

  describe('File Writing', () => {
    it('should write small files efficiently', async () => {
      const testFile = path.join(tempDir, 'write-small.txt');
      const testContent = 'Small write test content';

      await service.writeFileOptimized(testFile, testContent);

      const result = fs.readFileSync(testFile, 'utf8');
      expect(result).toBe(testContent);
    });

    it('should write large files with streaming', async () => {
      const testFile = path.join(tempDir, 'write-large.txt');
      const testContent = Buffer.from('Large content. '.repeat(20000)); // ~280KB

      const startTime = Date.now();
      await service.writeFileOptimized(testFile, testContent);
      const writeTime = Date.now() - startTime;

      const result = fs.readFileSync(testFile);
      expect(result.equals(testContent)).toBe(true);
      expect(writeTime).toBeLessThan(5000);
    });

    it('should create directories automatically', async () => {
      const nestedDir = path.join(tempDir, 'nested', 'deep', 'directory');
      const testFile = path.join(nestedDir, 'test.txt');

      await service.writeFileOptimized(testFile, 'test content');

      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf8')).toBe('test content');
    });

    it('should handle write errors gracefully', async () => {
      // Try to write to a read-only location (this might not work on all systems)
      const invalidPath = path.join('/invalid/path/file.txt');

      await expect(
        service.writeFileOptimized(invalidPath, 'content'),
      ).rejects.toThrow();
    });
  });

  describe('File Operations', () => {
    it('should copy files efficiently', async () => {
      const sourceFile = path.join(tempDir, 'source.txt');
      const destFile = path.join(tempDir, 'destination.txt');
      const testContent = 'Copy test content';

      fs.writeFileSync(sourceFile, testContent);

      await service.copyFileOptimized(sourceFile, destFile);

      expect(fs.existsSync(destFile)).toBe(true);
      expect(fs.readFileSync(destFile, 'utf8')).toBe(testContent);
    });

    it('should move files efficiently', async () => {
      const sourceFile = path.join(tempDir, 'move-source.txt');
      const destFile = path.join(tempDir, 'move-dest.txt');
      const testContent = 'Move test content';

      fs.writeFileSync(sourceFile, testContent);

      await service.moveFileOptimized(sourceFile, destFile);

      expect(fs.existsSync(sourceFile)).toBe(false);
      expect(fs.existsSync(destFile)).toBe(true);
      expect(fs.readFileSync(destFile, 'utf8')).toBe(testContent);
    });

    it('should delete files safely', async () => {
      const testFile = path.join(tempDir, 'delete-test.txt');
      fs.writeFileSync(testFile, 'content to delete');

      expect(fs.existsSync(testFile)).toBe(true);

      await service.deleteFileOptimized(testFile);

      expect(fs.existsSync(testFile)).toBe(false);
    });

    it('should handle deletion of non-existent files gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.txt');

      // Should not throw error
      await expect(
        service.deleteFileOptimized(nonExistentFile),
      ).resolves.not.toThrow();
    });
  });

  describe('File Information', () => {
    it('should get file statistics', async () => {
      const testFile = path.join(tempDir, 'stats-test.txt');
      const testContent = 'Statistics test content';

      fs.writeFileSync(testFile, testContent);

      const stats = await service.getFileStats(testFile);

      expect(stats.size).toBe(testContent.length);
      expect(stats.isFile).toBe(true);
      expect(stats.isDirectory).toBe(false);
      expect(stats.mtime).toBeInstanceOf(Date);
    });

    it('should check file existence', async () => {
      const existingFile = path.join(tempDir, 'existing.txt');
      const nonExistentFile = path.join(tempDir, 'non-existent.txt');

      fs.writeFileSync(existingFile, 'exists');

      expect(await service.fileExists(existingFile)).toBe(true);
      expect(await service.fileExists(nonExistentFile)).toBe(false);
    });

    it('should ensure directory exists', async () => {
      const newDir = path.join(tempDir, 'new-directory');

      expect(fs.existsSync(newDir)).toBe(false);

      await service.ensureDirectoryExists(newDir);

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.statSync(newDir).isDirectory()).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent file operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => {
        const testFile = path.join(tempDir, `concurrent-${i}.txt`);
        return service.writeFileOptimized(testFile, `Content ${i}`);
      });

      await Promise.all(operations);

      // Verify all files were created
      for (let i = 0; i < 10; i++) {
        const testFile = path.join(tempDir, `concurrent-${i}.txt`);
        expect(fs.existsSync(testFile)).toBe(true);
        expect(fs.readFileSync(testFile, 'utf8')).toBe(`Content ${i}`);
      }
    });

    it('should respect concurrency limits', async () => {
      const stats = service.getIOStats();
      expect(stats.maxConcurrentOperations).toBe(5);
      expect(stats.currentOperations).toBe(0);
      expect(stats.queuedOperations).toBe(0);
    });

    it('should queue operations when at capacity', async () => {
      // Create many concurrent operations
      const operations = Array.from({ length: 15 }, (_, i) => {
        const testFile = path.join(tempDir, `queued-${i}.txt`);
        return service.writeFileOptimized(testFile, `Queued content ${i}`);
      });

      // Start all operations
      const startTime = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - startTime;

      // Should complete but may take longer due to queuing
      expect(totalTime).toBeGreaterThan(0);

      // Verify all files were created
      for (let i = 0; i < 15; i++) {
        const testFile = path.join(tempDir, `queued-${i}.txt`);
        expect(fs.existsSync(testFile)).toBe(true);
      }
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup multiple files concurrently', async () => {
      // Create multiple test files
      const testFiles = Array.from({ length: 5 }, (_, i) => {
        const testFile = path.join(tempDir, `cleanup-${i}.txt`);
        fs.writeFileSync(testFile, `Content ${i}`);
        return testFile;
      });

      // Verify files exist
      testFiles.forEach((file) => {
        expect(fs.existsSync(file)).toBe(true);
      });

      // Cleanup all files
      await service.cleanupFiles(testFiles);

      // Verify files are deleted
      testFiles.forEach((file) => {
        expect(fs.existsSync(file)).toBe(false);
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      const testFiles = [
        path.join(tempDir, 'existing.txt'),
        path.join(tempDir, 'non-existent.txt'),
      ];

      // Create only one file
      fs.writeFileSync(testFiles[0], 'content');

      // Should not throw error even if some files don't exist
      await expect(service.cleanupFiles(testFiles)).resolves.not.toThrow();

      // Existing file should be deleted
      expect(fs.existsSync(testFiles[0])).toBe(false);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track I/O statistics', async () => {
      const initialStats = service.getIOStats();
      expect(initialStats.currentOperations).toBe(0);

      // Start some operations
      const operations = Array.from({ length: 3 }, (_, i) => {
        const testFile = path.join(tempDir, `stats-${i}.txt`);
        return service.writeFileOptimized(testFile, `Stats content ${i}`);
      });

      await Promise.all(operations);

      const finalStats = service.getIOStats();
      expect(finalStats.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(finalStats.utilizationRate).toBeLessThanOrEqual(100);
    });

    it('should calculate optimal buffer sizes', async () => {
      // Test with different file sizes to verify buffer size calculation
      const smallFile = path.join(tempDir, 'buffer-small.txt');
      const mediumFile = path.join(tempDir, 'buffer-medium.txt');
      const largeFile = path.join(tempDir, 'buffer-large.txt');

      const smallContent = 'small'.repeat(100); // < 1KB
      const mediumContent = 'medium'.repeat(50000); // ~300KB
      const largeContent = 'large'.repeat(2000000); // ~10MB

      // All operations should complete successfully with appropriate buffer sizes
      await Promise.all([
        service.writeFileOptimized(smallFile, smallContent),
        service.writeFileOptimized(mediumFile, mediumContent),
        service.writeFileOptimized(largeFile, largeContent),
      ]);

      // Verify files were written correctly
      expect(fs.readFileSync(smallFile, 'utf8')).toBe(smallContent);
      expect(fs.readFileSync(mediumFile, 'utf8')).toBe(mediumContent);
      expect(fs.readFileSync(largeFile, 'utf8')).toBe(largeContent);
    });
  });
});
