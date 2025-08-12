import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  const mockHealthService = {
    getHealthStatus: jest.fn(),
    getReadinessStatus: jest.fn(),
    getLivenessStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const mockHealthStatus = {
        status: 'ok' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 1000,
        version: '1.0.0',
        environment: 'test',
        checks: {
          memory: { status: 'ok' as const, message: 'Memory OK' },
        },
        metrics: {
          activeConnections: 0,
          totalRequests: 0,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          processing: {
            activeProcessingTasks: 0,
            completedProcessingTasks: 0,
            failedProcessingTasks: 0,
            averageProcessingTime: 0,
            queueSize: 0,
          },
          requests: {
            requestsPerMinute: 0,
            averageResponseTime: 0,
            peakConcurrentRequests: 0,
          },
        },
      };

      mockHealthService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      const result = await controller.getHealth();

      expect(result).toEqual(mockHealthStatus);
      expect(healthService.getHealthStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('getReadiness', () => {
    it('should return readiness status when ready', async () => {
      const mockReadinessStatus = {
        status: 'ready',
        message: 'Service is ready to accept requests',
      };

      mockHealthService.getReadinessStatus.mockResolvedValue(
        mockReadinessStatus,
      );

      const result = await controller.getReadiness();

      expect(result).toEqual(mockReadinessStatus);
      expect(healthService.getReadinessStatus).toHaveBeenCalledTimes(1);
    });

    it('should return not ready status when not ready', async () => {
      const mockReadinessStatus = {
        status: 'not ready',
        message: 'Service is not ready',
      };

      mockHealthService.getReadinessStatus.mockResolvedValue(
        mockReadinessStatus,
      );

      const result = await controller.getReadiness();

      expect(result).toEqual(mockReadinessStatus);
      expect(healthService.getReadinessStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLiveness', () => {
    it('should return liveness status when alive', async () => {
      const mockLivenessStatus = {
        status: 'alive',
        message: 'Service is alive and responding',
      };

      mockHealthService.getLivenessStatus.mockResolvedValue(mockLivenessStatus);

      const result = await controller.getLiveness();

      expect(result).toEqual(mockLivenessStatus);
      expect(healthService.getLivenessStatus).toHaveBeenCalledTimes(1);
    });
  });
});
