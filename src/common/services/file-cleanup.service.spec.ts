import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FileCleanupService } from './file-cleanup.service';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    unlink: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
  },
}));

describe('FileCleanupService', () => {
  let service: FileCleanupService;
  let configService: ConfigService;
  let mockFs: jest.Mocked<typeof fs>;
  let mockExistsSync: jest.MockedFunction<typeof existsSync>;

  const mockTempDir = '/tmp/test-cleanup';
  const mockCleanupInterval = 1000;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    mockFs = fs as jest.Mocked<typeof fs>;
    mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCleanupService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'app.tempDir':
                  return mockTempDir;
                case 'app.cleanupInterval':
                  return mockCleanupInterval;
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FileCleanupService>(FileCleanupService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(service.getTempDir()).toBe(mockTempDir);
      expect(configService.get).toHaveBeenCalledWith('app.tempDir');
      expect(configService.get).toHaveBeenCalledWith('app.cleanupInterval');
    });

    it('should start periodic cleanup', () => {
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        mockCleanupInterval,
      );
    });
  });

  describe('trackFile', () => {
    it('should track a file for cleanup', () => {
      const filePath = '/tmp/test-file.txt';

      service.trackFile(filePath);

      expect(service.getTrackedFileCount()).toBe(1);
      expect(service.getTrackedFiles()).toContain(filePath);
    });

    it('should not duplicate tracked files', () => {
      const filePath = '/tmp/test-file.txt';

      service.trackFile(filePath);
      service.trackFile(filePath);

      expect(service.getTrackedFileCount()).toBe(1);
    });
  });

  describe('untrackFile', () => {
    it('should remove file from tracking', () => {
      const filePath = '/tmp/test-file.txt';

      service.trackFile(filePath);
      expect(service.getTrackedFileCount()).toBe(1);

      service.untrackFile(filePath);
      expect(service.getTrackedFileCount()).toBe(0);
    });
  });

  describe('cleanupFile', () => {
    it('should successfully cleanup existing file', async () => {
      const filePath = '/tmp/test-file.txt';
      mockExistsSync.mockReturnValue(true);
      mockFs.unlink.mockResolvedValue(undefined);

      service.trackFile(filePath);
      await service.cleanupFile(filePath);

      expect(mockFs.unlink).toHaveBeenCalledWith(filePath);
      expect(service.getTrackedFileCount()).toBe(0);
    });

    it('should handle non-existent file gracefully', async () => {
      const filePath = '/tmp/non-existent.txt';
      mockExistsSync.mockReturnValue(false);

      service.trackFile(filePath);
      await service.cleanupFile(filePath);

      expect(mockFs.unlink).not.toHaveBeenCalled();
      expect(service.getTrackedFileCount()).toBe(0);
    });

    it('should throw error when file deletion fails', async () => {
      const filePath = '/tmp/test-file.txt';
      const error = new Error('Permission denied');
      mockExistsSync.mockReturnValue(true);
      mockFs.unlink.mockRejectedValue(error);

      await expect(service.cleanupFile(filePath)).rejects.toThrow(
        'Permission denied',
      );
      expect(mockFs.unlink).toHaveBeenCalledWith(filePath);
    });
  });

  describe('cleanupFiles', () => {
    it('should cleanup multiple files successfully', async () => {
      const filePaths = ['/tmp/file1.txt', '/tmp/file2.txt', '/tmp/file3.txt'];
      mockExistsSync.mockReturnValue(true);
      mockFs.unlink.mockResolvedValue(undefined);

      filePaths.forEach((path) => service.trackFile(path));
      await service.cleanupFiles(filePaths);

      expect(mockFs.unlink).toHaveBeenCalledTimes(3);
      filePaths.forEach((path) => {
        expect(mockFs.unlink).toHaveBeenCalledWith(path);
      });
      expect(service.getTrackedFileCount()).toBe(0);
    });

    it('should handle partial failures gracefully', async () => {
      const filePaths = ['/tmp/file1.txt', '/tmp/file2.txt', '/tmp/file3.txt'];
      mockExistsSync.mockReturnValue(true);
      mockFs.unlink
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(undefined);

      filePaths.forEach((path) => service.trackFile(path));
      await service.cleanupFiles(filePaths);

      expect(mockFs.unlink).toHaveBeenCalledTimes(3);
      // Should still untrack successfully deleted files
      expect(service.getTrackedFileCount()).toBe(1); // Only the failed one remains
    });
  });

  describe('cleanupAllTrackedFiles', () => {
    it('should cleanup all tracked files', async () => {
      const filePaths = ['/tmp/file1.txt', '/tmp/file2.txt'];
      mockExistsSync.mockReturnValue(true);
      mockFs.unlink.mockResolvedValue(undefined);

      filePaths.forEach((path) => service.trackFile(path));
      await service.cleanupAllTrackedFiles();

      expect(mockFs.unlink).toHaveBeenCalledTimes(2);
      expect(service.getTrackedFileCount()).toBe(0);
    });

    it('should handle empty tracked files list', async () => {
      await service.cleanupAllTrackedFiles();

      expect(mockFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOldFiles', () => {
    it('should cleanup files older than specified age', async () => {
      const oldTime = new Date(Date.now() - 7200000); // 2 hours ago
      const recentTime = new Date(Date.now() - 1800000); // 30 minutes ago

      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockResolvedValue([
        'old-file.txt',
        'recent-file.txt',
      ] as any);
      mockFs.stat
        .mockResolvedValueOnce({ mtime: oldTime } as any)
        .mockResolvedValueOnce({ mtime: recentTime } as any);
      mockFs.unlink.mockResolvedValue(undefined);

      await service.cleanupOldFiles(3600000); // 1 hour max age

      expect(mockFs.unlink).toHaveBeenCalledTimes(1);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        join(mockTempDir, 'old-file.txt'),
      );
    });

    it('should handle non-existent temp directory', async () => {
      mockExistsSync.mockReturnValue(false);

      await service.cleanupOldFiles();

      expect(mockFs.readdir).not.toHaveBeenCalled();
      expect(mockFs.unlink).not.toHaveBeenCalled();
    });

    it('should handle readdir errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      await expect(service.cleanupOldFiles()).resolves.not.toThrow();
    });

    it('should handle stat errors for individual files', async () => {
      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockResolvedValue(['file1.txt', 'file2.txt'] as any);
      mockFs.stat
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce({
          mtime: new Date(Date.now() - 7200000),
        } as any);
      mockFs.unlink.mockResolvedValue(undefined);

      await service.cleanupOldFiles(3600000);

      expect(mockFs.unlink).toHaveBeenCalledTimes(1);
    });
  });

  describe('periodic cleanup', () => {
    it('should run periodic cleanup at specified interval', async () => {
      const cleanupOldFilesSpy = jest
        .spyOn(service, 'cleanupOldFiles')
        .mockResolvedValue();

      // Fast forward time to trigger cleanup
      jest.advanceTimersByTime(mockCleanupInterval);

      // Wait for async operations
      await new Promise((resolve) => setImmediate(resolve));

      expect(cleanupOldFilesSpy).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should cleanup all tracked files and stop periodic cleanup', async () => {
      const filePath = '/tmp/test-file.txt';
      mockExistsSync.mockReturnValue(true);
      mockFs.unlink.mockResolvedValue(undefined);

      service.trackFile(filePath);
      await service.onModuleDestroy();

      expect(mockFs.unlink).toHaveBeenCalledWith(filePath);
      expect(service.getTrackedFileCount()).toBe(0);
      expect(clearInterval).toHaveBeenCalled();
    });
  });

  describe('getters', () => {
    it('should return correct temp directory', () => {
      expect(service.getTempDir()).toBe(mockTempDir);
    });

    it('should return correct tracked file count', () => {
      expect(service.getTrackedFileCount()).toBe(0);

      service.trackFile('/tmp/file1.txt');
      service.trackFile('/tmp/file2.txt');

      expect(service.getTrackedFileCount()).toBe(2);
    });

    it('should return list of tracked files', () => {
      const files = ['/tmp/file1.txt', '/tmp/file2.txt'];
      files.forEach((file) => service.trackFile(file));

      const trackedFiles = service.getTrackedFiles();
      expect(trackedFiles).toHaveLength(2);
      files.forEach((file) => {
        expect(trackedFiles).toContain(file);
      });
    });
  });
});
