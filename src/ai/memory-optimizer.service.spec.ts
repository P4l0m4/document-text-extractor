import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MemoryOptimizerService } from './memory-optimizer.service';

describe('MemoryOptimizerService', () => {
  let service: MemoryOptimizerService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryOptimizerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'MEMORY_ENABLE_GC': true,
                'MEMORY_GC_THRESHOLD_MB': 128,
                'MEMORY_GC_INTERVAL_MS': 30000,
                'MEMORY_ENABLE_PRESSURE_DETECTION': true,
                'MEMORY_PRESSURE_THRESHOLD_MB': 256,
                'MEMORY_ENABLE_BUFFER_OPTIMIZATION': true,
                'MEMORY_MAX_BUFFER_SIZE_MB': 25,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MemoryOptimizerService>(MemoryOptimizerService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('optimizeMemory', () => {
    it('should perform memory optimization and return results', async () => {
      const sessionId = 'test-session';

      const result = await service.optimizeMemory(sessionId);

      expect(result).toHaveProperty('beforeMemory');
      expect(result).toHaveProperty('afterMemory');
      expect(result).toHaveProperty('freedMemoryMB');
      expect(result).toHaveProperty('optimizationTime');
      expect(result).toHaveProperty('optimizationsApplied');

      expect(result.beforeMemory).toHaveProperty('rss');
      expect(result.beforeMemory).toHaveProperty('heapUsed');
      expect(result.beforeMemory).toHaveProperty('heapTotal');

      expect(result.afterMemory).toHaveProperty('rss');
      expect(result.afterMemory).toHaveProperty('heapUsed');
      expect(result.afterMemory).toHaveProperty('heapTotal');

      expect(typeof result.freedMemoryMB).toBe('number');
      expect(typeof result.optimizationTime).toBe('number');
      expect(Array.isArray(result.optimizationsApplied)).toBe(true);
      expect(result.optimizationTime).toBeGreaterThan(0);
    });

    it('should apply buffer pool clearing when enabled', async () => {
      // First create some buffers
      service.getOptimizedBuffer(1024, 'test-buffer-1');
      service.getOptimizedBuffer(2048, 'test-buffer-2');

      const result = await service.optimizeMemory('test-session');

      expect(result.optimizationsApplied).toContain('buffer_pool_cleared');
    });

    it('should apply cache clearing optimization', async () => {
      const result = await service.optimizeMemory('test-session');

      expect(result.optimizationsApplied).toContain('cache_cleared');
    });
  });

  describe('optimizeForPdfConversion', () => {
    it('should perform PDF-specific optimizations', async () => {
      const sessionId = 'pdf-session';

      const result = await service.optimizeForPdfConversion(sessionId);

      expect(result).toHaveProperty('optimizationsApplied');
      expect(result.optimizationsApplied).toContain('image_buffers_preallocated');
    });
  });

  describe('optimizeAfterPdfConversion', () => {
    it('should perform post-PDF cleanup optimizations', async () => {
      const sessionId = 'pdf-cleanup-session';

      const result = await service.optimizeAfterPdfConversion(sessionId);

      expect(result).toHaveProperty('optimizationsApplied');
      expect(result.optimizationsApplied).toContain('image_cache_cleared');
    });
  });

  describe('getOptimizedBuffer', () => {
    it('should create buffer when optimization disabled', () => {
      // Mock config to disable buffer optimization
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'MEMORY_ENABLE_BUFFER_OPTIMIZATION') return false;
        return 128; // Default for other configs
      });

      const buffer = service.getOptimizedBuffer(1024);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(1024);
    });

    it('should create buffer within size limits', () => {
      const size = 1024 * 1024; // 1MB
      const buffer = service.getOptimizedBuffer(size, 'test-buffer');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(size);
    });

    it('should handle buffer size exceeding maximum', () => {
      const largeSize = 50 * 1024 * 1024; // 50MB (exceeds 25MB limit)
      const buffer = service.getOptimizedBuffer(largeSize);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(largeSize);
    });

    it('should reuse existing buffer when available', () => {
      const key = 'reusable-buffer';
      const size = 1024;

      // Create initial buffer
      const buffer1 = service.getOptimizedBuffer(size, key);
      
      // Request smaller buffer with same key - should reuse
      const buffer2 = service.getOptimizedBuffer(512, key);

      expect(buffer2.length).toBe(512);
      // Should be a subarray of the original buffer
    });

    it('should create new buffer when existing is too small', () => {
      const key = 'expandable-buffer';

      // Create small buffer
      const buffer1 = service.getOptimizedBuffer(512, key);
      
      // Request larger buffer - should create new one
      const buffer2 = service.getOptimizedBuffer(2048, key);

      expect(buffer2.length).toBe(2048);
    });
  });

  describe('releaseBuffer', () => {
    it('should release buffer and clear sensitive data', () => {
      const key = 'sensitive-buffer';
      const buffer = service.getOptimizedBuffer(1024, key);
      
      // Fill buffer with test data
      buffer.fill(0xFF);

      service.releaseBuffer(key);

      // Buffer should be cleared (filled with zeros)
      expect(buffer.every(byte => byte === 0)).toBe(true);
    });

    it('should handle release of non-existent buffer', () => {
      expect(() => {
        service.releaseBuffer('non-existent-buffer');
      }).not.toThrow();
    });
  });

  describe('getMemoryStatus', () => {
    it('should return comprehensive memory status', () => {
      const status = service.getMemoryStatus();

      expect(status).toHaveProperty('usage');
      expect(status).toHaveProperty('usageMB');
      expect(status).toHaveProperty('recommendations');
      expect(status).toHaveProperty('bufferPoolSize');
      expect(status).toHaveProperty('gcStats');

      expect(status.usage).toHaveProperty('rss');
      expect(status.usage).toHaveProperty('heapUsed');
      expect(status.usage).toHaveProperty('heapTotal');

      expect(status.usageMB).toHaveProperty('rss');
      expect(status.usageMB).toHaveProperty('heapUsed');
      expect(status.usageMB).toHaveProperty('heapTotal');

      expect(Array.isArray(status.recommendations)).toBe(true);
      expect(typeof status.bufferPoolSize).toBe('number');

      expect(status.gcStats).toHaveProperty('count');
      expect(status.gcStats).toHaveProperty('lastGcTime');
      expect(status.gcStats).toHaveProperty('timeSinceLastGc');
    });

    it('should generate recommendations based on memory usage', () => {
      // Create some buffers to increase buffer pool size
      for (let i = 0; i < 8; i++) {
        service.getOptimizedBuffer(1024, `buffer-${i}`);
      }

      const status = service.getMemoryStatus();

      expect(status.recommendations.length).toBeGreaterThan(0);
      expect(status.recommendations).toContain('Buffer pool nearly full - consider clearing');
    });
  });

  describe('garbage collection', () => {
    it('should handle garbage collection when available', () => {
      // Mock global.gc
      global.gc = jest.fn();

      const result = service.optimizeMemory('gc-test');

      expect(global.gc).toHaveBeenCalled();
    });

    it('should handle missing garbage collection gracefully', async () => {
      // Remove global.gc
      const originalGc = global.gc;
      delete global.gc;

      const result = await service.optimizeMemory('no-gc-test');

      expect(result).toHaveProperty('optimizationsApplied');
      // Should not include garbage_collection in applied optimizations
      expect(result.optimizationsApplied).not.toContain('garbage_collection');

      // Restore original gc if it existed
      if (originalGc) {
        global.gc = originalGc;
      }
    });
  });

  describe('memory pressure detection', () => {
    it('should detect memory pressure based on RSS usage', () => {
      // Mock process.memoryUsage to return high RSS
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 300 * 1024 * 1024, // 300MB (exceeds 256MB threshold)
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 80 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      const status = service.getMemoryStatus();

      expect(status.recommendations).toContain('Memory pressure detected - optimize immediately');

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should detect high heap utilization', () => {
      // Mock process.memoryUsage to return high heap utilization
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 85 * 1024 * 1024, // 85% utilization
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      const status = service.getMemoryStatus();

      expect(status.recommendations).toContain('High heap utilization - consider memory optimization');

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('buffer pool management', () => {
    it('should limit buffer pool size', () => {
      const maxPoolSize = 10; // From the service implementation

      // Try to create more buffers than the pool can hold
      for (let i = 0; i < maxPoolSize + 5; i++) {
        service.getOptimizedBuffer(1024, `buffer-${i}`);
      }

      const status = service.getMemoryStatus();
      expect(status.bufferPoolSize).toBeLessThanOrEqual(maxPoolSize);
    });

    it('should clear buffer pool during optimization', async () => {
      // Create some buffers
      service.getOptimizedBuffer(1024, 'buffer-1');
      service.getOptimizedBuffer(2048, 'buffer-2');

      const statusBefore = service.getMemoryStatus();
      expect(statusBefore.bufferPoolSize).toBeGreaterThan(0);

      await service.optimizeMemory('pool-clear-test');

      const statusAfter = service.getMemoryStatus();
      expect(statusAfter.bufferPoolSize).toBe(0);
    });
  });
});