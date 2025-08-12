import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OptimizedTempFileService } from './optimized-temp-file.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('OptimizedTempFileService', () => {
  let service: OptimizedTempFileService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizedTempFileService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'TEMP_FILE_MAX_COUNT': 50,
                'TEMP_FILE_MAX_AGE_MS': 1800000, // 30 minutes
                'TEMP_FILE_MAX_SIZE_MB': 100 * 1024 * 1024, // 100MB
                'TEMP_FILE_CLEANUP_INTERVAL_MS': 60000, // 1 minute
                'TEMP_FILE_BATCH_CLEANUP_SIZE': 5,
                'TEMP_DIR': '/tmp/test-processing',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OptimizedTempFileService>(OptimizedTempFileService);
    configService = module.get<ConfigService>(ConfigService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any intervals
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTempFilePath', () => {
    it('should create unique temp file paths', () => {
      const path1 = service.createTempFilePath('.png');
      const path2 = service.createTempFilePath('.png');

      expect(path1).not.toBe(path2);
      expect(path1).toMatch(/\.png$/);
      expect(path2).toMatch(/\.png$/);
      expect(path1).toContain('temp_');
      expect(path2).toContain('temp_');
    });

    it('should include session ID in path when provided', () => {
      const sessionId = 'test-session-123';
      const filePath = service.createTempFilePath('.jpg', sessionId);

      expect(filePath).toContain('temp_');
      expect(filePath).toMatch(/\.jpg$/);
    });
  });

  describe('createTempDirPath', () => {
    it('should create unique temp directory paths', () => {
      const dir1 = service.createTempDirPath();
      const dir2 = service.createTempDirPath();

      expect(dir1).not.toBe(dir2);
      expect(dir1).toContain('temp_dir_');
      expect(dir2).toContain('temp_dir_');
    });
  });

  describe('registerTempFile', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 1024 * 1024, // 1MB
        isFile: () => true,
        isDirectory: () => false,
      } as any);
    });

    it('should register a temp file successfully', async () => {
      const filePath = '/tmp/test-file.png';
      const sessionId = 'test-session';

      const fileId = await service.registerTempFile(filePath, 'image', sessionId);

      expect(fileId).toBeDefined();
      expect(typeof fileId).toBe('string');
      expect(fileId.length).toBeGreaterThan(0);

      const stats = service.getTempFileStats();
      expect(stats.totalFiles).toBe(1);
      expect(stats.totalSize).toBe(1024 * 1024);
      expect(stats.byType.image).toBe(1);
    });

    it('should handle file stat errors gracefully', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));

      const filePath = '/tmp/nonexistent-file.png';
      const fileId = await service.registerTempFile(filePath, 'image');

      expect(fileId).toBeDefined();
      // Should still return an ID for cleanup attempts
    });
  });

  describe('registerTempDirectory', () => {
    beforeEach(() => {
      mockFs.readdir.mockResolvedValue([
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file2.txt', isFile: () => true, isDirectory: () => false },
      ] as any);
      
      mockFs.stat.mockResolvedValue({
        size: 512 * 1024, // 512KB per file
      } as any);
    });

    it('should register a temp directory successfully', async () => {
      const dirPath = '/tmp/test-dir';
      const sessionId = 'test-session';

      const dirId = await service.registerTempDirectory(dirPath, sessionId);

      expect(dirId).toBeDefined();
      expect(typeof dirId).toBe('string');

      const stats = service.getTempFileStats();
      expect(stats.totalFiles).toBe(1);
      expect(stats.byType.directory).toBe(1);
    });
  });

  describe('scheduleCleanup', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        isDirectory: () => false,
      } as any);
    });

    it('should schedule immediate cleanup', async () => {
      const filePath = '/tmp/test-file.png';
      const fileId = await service.registerTempFile(filePath);

      service.scheduleCleanup(fileId);

      // File should be marked as scheduled for cleanup
      const stats = service.getTempFileStats();
      expect(stats.scheduledForCleanup).toBe(1);
    });

    it('should schedule delayed cleanup', async () => {
      const filePath = '/tmp/test-file.png';
      const fileId = await service.registerTempFile(filePath);

      service.scheduleCleanup(fileId, 1000); // 1 second delay

      const stats = service.getTempFileStats();
      expect(stats.scheduledForCleanup).toBe(1);
    });

    it('should handle unknown file ID gracefully', () => {
      const unknownFileId = 'unknown-file-id';

      expect(() => {
        service.scheduleCleanup(unknownFileId);
      }).not.toThrow();
    });
  });

  describe('cleanupTempFile', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        isDirectory: () => false,
      } as any);
      mockFs.unlink.mockResolvedValue(undefined);
    });

    it('should cleanup a registered file successfully', async () => {
      const filePath = '/tmp/test-file.png';
      const fileId = await service.registerTempFile(filePath);

      const result = await service.cleanupTempFile(fileId);

      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledWith(filePath);

      const stats = service.getTempFileStats();
      expect(stats.totalFiles).toBe(0);
    });

    it('should handle cleanup of unknown file ID', async () => {
      const unknownFileId = 'unknown-file-id';

      const result = await service.cleanupTempFile(unknownFileId);

      expect(result).toBe(false);
    });

    it('should handle file deletion errors gracefully', async () => {
      mockFs.unlink.mockRejectedValue(new Error('Permission denied'));

      const filePath = '/tmp/test-file.png';
      const fileId = await service.registerTempFile(filePath);

      const result = await service.cleanupTempFile(fileId);

      expect(result).toBe(false);
    });

    it('should ignore ENOENT errors (file not found)', async () => {
      const enoentError = new Error('File not found');
      (enoentError as any).code = 'ENOENT';
      mockFs.unlink.mockRejectedValue(enoentError);

      const filePath = '/tmp/test-file.png';
      const fileId = await service.registerTempFile(filePath);

      const result = await service.cleanupTempFile(fileId);

      expect(result).toBe(true); // Should succeed despite ENOENT
    });
  });

  describe('cleanupBySession', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        isDirectory: () => false,
      } as any);
      mockFs.unlink.mockResolvedValue(undefined);
    });

    it('should cleanup all files for a session', async () => {
      const sessionId = 'test-session';
      
      // Register multiple files for the same session
      await service.registerTempFile('/tmp/file1.png', 'image', sessionId);
      await service.registerTempFile('/tmp/file2.png', 'image', sessionId);
      await service.registerTempFile('/tmp/file3.png', 'image', 'other-session');

      const cleanedCount = await service.cleanupBySession(sessionId);

      expect(cleanedCount).toBe(2);
      expect(mockFs.unlink).toHaveBeenCalledTimes(2);

      const stats = service.getTempFileStats();
      expect(stats.totalFiles).toBe(1); // Only the file from other-session should remain
    });

    it('should return 0 when no files found for session', async () => {
      const sessionId = 'nonexistent-session';

      const cleanedCount = await service.cleanupBySession(sessionId);

      expect(cleanedCount).toBe(0);
      expect(mockFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('getTempFileStats', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        isDirectory: () => false,
      } as any);
    });

    it('should return empty stats when no files registered', () => {
      const stats = service.getTempFileStats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestFile).toBeNull();
      expect(stats.newestFile).toBeNull();
      expect(stats.byType).toEqual({});
      expect(stats.scheduledForCleanup).toBe(0);
    });

    it('should return correct stats with registered files', async () => {
      await service.registerTempFile('/tmp/file1.png', 'image');
      await service.registerTempFile('/tmp/file2.pdf', 'pdf');

      const stats = service.getTempFileStats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(2048); // 2 * 1024
      expect(stats.oldestFile).toBeInstanceOf(Date);
      expect(stats.newestFile).toBeInstanceOf(Date);
      expect(stats.byType.image).toBe(1);
      expect(stats.byType.pdf).toBe(1);
      expect(stats.scheduledForCleanup).toBe(0);
    });
  });

  describe('memory management', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 1024 * 1024, // 1MB
        isFile: () => true,
        isDirectory: () => false,
      } as any);
    });

    it('should trigger cleanup when file count limit exceeded', async () => {
      // Register files up to the limit (50 from config)
      for (let i = 0; i < 55; i++) {
        await service.registerTempFile(`/tmp/file${i}.png`, 'image');
      }

      // Should have triggered automatic cleanup
      const stats = service.getTempFileStats();
      expect(stats.totalFiles).toBeLessThanOrEqual(50);
    });
  });
});