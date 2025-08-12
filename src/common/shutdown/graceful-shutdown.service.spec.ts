import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GracefulShutdownService } from './graceful-shutdown.service';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GracefulShutdownService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GracefulShutdownService>(GracefulShutdownService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock the signal handlers to prevent actual process listeners
    jest.spyOn(process, 'on').mockImplementation(() => process);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerShutdownHook', () => {
    it('should register a shutdown hook', () => {
      const hookName = 'test-hook';
      const hookFunction = jest.fn().mockResolvedValue(undefined);
      const priority = 50;

      service.registerShutdownHook(hookName, hookFunction, priority);

      expect(service['shutdownHooks']).toHaveLength(1);
      expect(service['shutdownHooks'][0]).toEqual({
        name: hookName,
        hook: hookFunction,
        priority: priority,
      });
    });

    it('should sort hooks by priority', () => {
      const hook1 = jest.fn().mockResolvedValue(undefined);
      const hook2 = jest.fn().mockResolvedValue(undefined);
      const hook3 = jest.fn().mockResolvedValue(undefined);

      service.registerShutdownHook('high-priority', hook1, 10);
      service.registerShutdownHook('low-priority', hook2, 100);
      service.registerShutdownHook('medium-priority', hook3, 50);

      expect(service['shutdownHooks'][0].name).toBe('high-priority');
      expect(service['shutdownHooks'][1].name).toBe('medium-priority');
      expect(service['shutdownHooks'][2].name).toBe('low-priority');
    });
  });

  describe('onApplicationShutdown', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue(5000); // 5 second timeout
    });

    it('should execute shutdown hooks in order', async () => {
      const executionOrder: string[] = [];

      const hook1 = jest.fn().mockImplementation(async () => {
        executionOrder.push('hook1');
      });
      const hook2 = jest.fn().mockImplementation(async () => {
        executionOrder.push('hook2');
      });

      service.registerShutdownHook('first', hook1, 10);
      service.registerShutdownHook('second', hook2, 20);

      await service.onApplicationShutdown('SIGTERM');

      expect(executionOrder).toEqual(['hook1', 'hook2']);
      expect(hook1).toHaveBeenCalledTimes(1);
      expect(hook2).toHaveBeenCalledTimes(1);
    });

    it('should continue executing hooks even if one fails', async () => {
      const hook1 = jest.fn().mockRejectedValue(new Error('Hook 1 failed'));
      const hook2 = jest.fn().mockResolvedValue(undefined);

      service.registerShutdownHook('failing-hook', hook1, 10);
      service.registerShutdownHook('working-hook', hook2, 20);

      await service.onApplicationShutdown('SIGTERM');

      expect(hook1).toHaveBeenCalledTimes(1);
      expect(hook2).toHaveBeenCalledTimes(1);
    });

    it('should not execute shutdown twice', async () => {
      const hook = jest.fn().mockResolvedValue(undefined);
      service.registerShutdownHook('test-hook', hook, 10);

      // First shutdown
      await service.onApplicationShutdown('SIGTERM');
      expect(hook).toHaveBeenCalledTimes(1);

      // Second shutdown should be ignored
      await service.onApplicationShutdown('SIGINT');
      expect(hook).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should handle shutdown timeout', async () => {
      mockConfigService.get.mockReturnValue(100); // 100ms timeout

      const slowHook = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200)); // Takes 200ms
      });

      service.registerShutdownHook('slow-hook', slowHook, 10);

      // Mock process.exit to prevent actual exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      await expect(service.onApplicationShutdown('SIGTERM')).rejects.toThrow(
        'Process exit called',
      );

      mockExit.mockRestore();
    });
  });

  describe('isShutdownInProgress', () => {
    it('should return false initially', () => {
      expect(service.isShutdownInProgress()).toBe(false);
    });

    it('should return true during shutdown', async () => {
      const hook = jest.fn().mockImplementation(async () => {
        expect(service.isShutdownInProgress()).toBe(true);
      });

      service.registerShutdownHook('test-hook', hook, 10);
      await service.onApplicationShutdown('SIGTERM');
    });
  });
});
