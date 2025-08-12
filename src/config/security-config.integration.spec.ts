import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecurityConfigService } from './security-config.service';
import securityConfig from './security.config';

describe('SecurityConfig Integration', () => {
  let service: SecurityConfigService;
  let configService: ConfigService;

  describe('with default environment variables', () => {
    beforeEach(async () => {
      // Clear any existing environment variables
      delete process.env.SECURITY_RATE_LIMIT_WINDOW_MS;
      delete process.env.SECURITY_RATE_LIMIT_MAX;
      delete process.env.SECURITY_CORS_ALLOWED_ORIGINS;

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [securityConfig],
            ignoreEnvFile: true,
          }),
        ],
        providers: [SecurityConfigService],
      }).compile();

      service = module.get<SecurityConfigService>(SecurityConfigService);
      configService = module.get<ConfigService>(ConfigService);
    });

    it('should use secure default values when no environment variables are set', () => {
      const rateLimitConfig = service.getRateLimitConfig();
      const corsConfig = service.getCorsConfig();

      expect(rateLimitConfig.windowMs).toBe(1000);
      expect(rateLimitConfig.maxRequests).toBe(3);
      expect(corsConfig.allowedOrigins).toEqual([
        'https://supernotaire.fr',
        'http://localhost:3001',
      ]);
    });

    it('should indicate that values did not come from environment', () => {
      const metadata = service.getConfigurationMetadata();

      expect(metadata.rateLimitWindowFromEnv).toBe(false);
      expect(metadata.rateLimitMaxFromEnv).toBe(false);
      expect(metadata.corsOriginsFromEnv).toBe(false);
    });

    it('should pass validation with default values', () => {
      const errors = service.validateConfiguration();

      expect(errors).toEqual([]);
    });
  });

  describe('with custom environment variables', () => {
    beforeEach(async () => {
      // Set custom environment variables
      process.env.SECURITY_RATE_LIMIT_WINDOW_MS = '2000';
      process.env.SECURITY_RATE_LIMIT_MAX = '5';
      process.env.SECURITY_CORS_ALLOWED_ORIGINS =
        'https://example.com,http://localhost:3000';

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [securityConfig],
            ignoreEnvFile: true,
          }),
        ],
        providers: [SecurityConfigService],
      }).compile();

      service = module.get<SecurityConfigService>(SecurityConfigService);
      configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env.SECURITY_RATE_LIMIT_WINDOW_MS;
      delete process.env.SECURITY_RATE_LIMIT_MAX;
      delete process.env.SECURITY_CORS_ALLOWED_ORIGINS;
    });

    it('should use custom environment values', () => {
      const rateLimitConfig = service.getRateLimitConfig();
      const corsConfig = service.getCorsConfig();

      expect(rateLimitConfig.windowMs).toBe(2000);
      expect(rateLimitConfig.maxRequests).toBe(5);
      expect(corsConfig.allowedOrigins).toEqual([
        'https://example.com',
        'http://localhost:3000',
      ]);
    });

    it('should indicate that values came from environment', () => {
      const metadata = service.getConfigurationMetadata();

      expect(metadata.rateLimitWindowFromEnv).toBe(true);
      expect(metadata.rateLimitMaxFromEnv).toBe(true);
      expect(metadata.corsOriginsFromEnv).toBe(true);
    });

    it('should pass validation with custom values', () => {
      const errors = service.validateConfiguration();

      expect(errors).toEqual([]);
    });

    it('should provide complete security configuration', () => {
      const securityConfig = service.getSecurityConfig();

      expect(securityConfig).toEqual({
        rateLimit: {
          windowMs: 2000,
          maxRequests: 5,
        },
        cors: {
          allowedOrigins: ['https://example.com', 'http://localhost:3000'],
        },
        logging: {
          enabled: true,
          level: 'info',
        },
      });
    });
  });

  describe('with invalid environment variables', () => {
    beforeEach(async () => {
      // Set invalid environment variables
      process.env.SECURITY_RATE_LIMIT_WINDOW_MS = '500'; // Too low
      process.env.SECURITY_RATE_LIMIT_MAX = '150'; // Too high
      process.env.SECURITY_CORS_ALLOWED_ORIGINS = 'invalid-origin,'; // Invalid format

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [securityConfig],
            ignoreEnvFile: true,
          }),
        ],
        providers: [SecurityConfigService],
      }).compile();

      service = module.get<SecurityConfigService>(SecurityConfigService);
      configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env.SECURITY_RATE_LIMIT_WINDOW_MS;
      delete process.env.SECURITY_RATE_LIMIT_MAX;
      delete process.env.SECURITY_CORS_ALLOWED_ORIGINS;
    });

    it('should fail validation with invalid values', () => {
      const errors = service.validateConfiguration();

      expect(errors).toContain(
        'SECURITY_RATE_LIMIT_WINDOW_MS must be at least 1000ms',
      );
      expect(errors).toContain(
        'SECURITY_RATE_LIMIT_MAX must be between 1 and 100',
      );
      expect(errors).toContain('Invalid origin at index 0: invalid-origin');
    });

    it('should still return configuration values even when invalid', () => {
      const rateLimitConfig = service.getRateLimitConfig();
      const corsConfig = service.getCorsConfig();

      expect(rateLimitConfig.windowMs).toBe(500);
      expect(rateLimitConfig.maxRequests).toBe(150);
      expect(corsConfig.allowedOrigins).toEqual(['invalid-origin']);
    });
  });

  describe('with partial environment variables', () => {
    beforeEach(async () => {
      // Set only some environment variables
      process.env.SECURITY_RATE_LIMIT_WINDOW_MS = '3000';
      // Leave SECURITY_RATE_LIMIT_MAX and SECURITY_CORS_ALLOWED_ORIGINS unset

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [securityConfig],
            ignoreEnvFile: true,
          }),
        ],
        providers: [SecurityConfigService],
      }).compile();

      service = module.get<SecurityConfigService>(SecurityConfigService);
      configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
      delete process.env.SECURITY_RATE_LIMIT_WINDOW_MS;
    });

    it('should use environment values where available and defaults elsewhere', () => {
      const rateLimitConfig = service.getRateLimitConfig();
      const corsConfig = service.getCorsConfig();

      expect(rateLimitConfig.windowMs).toBe(3000); // From environment
      expect(rateLimitConfig.maxRequests).toBe(3); // Default
      expect(corsConfig.allowedOrigins).toEqual([
        'https://supernotaire.fr',
        'http://localhost:3001',
      ]); // Default
    });

    it('should correctly indicate which values came from environment', () => {
      const metadata = service.getConfigurationMetadata();

      expect(metadata.rateLimitWindowFromEnv).toBe(true);
      expect(metadata.rateLimitMaxFromEnv).toBe(false);
      expect(metadata.corsOriginsFromEnv).toBe(false);
    });
  });

  describe('CORS origins parsing edge cases', () => {
    afterEach(() => {
      delete process.env.SECURITY_CORS_ALLOWED_ORIGINS;
    });

    it('should handle origins with extra whitespace', async () => {
      process.env.SECURITY_CORS_ALLOWED_ORIGINS =
        ' https://example.com , http://localhost:3000 ';

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [securityConfig],
            ignoreEnvFile: true,
          }),
        ],
        providers: [SecurityConfigService],
      }).compile();

      const service = module.get<SecurityConfigService>(SecurityConfigService);
      const corsConfig = service.getCorsConfig();

      expect(corsConfig.allowedOrigins).toEqual([
        'https://example.com',
        'http://localhost:3000',
      ]);
    });

    it('should filter out empty origins', async () => {
      process.env.SECURITY_CORS_ALLOWED_ORIGINS =
        'https://example.com,,http://localhost:3000,';

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [securityConfig],
            ignoreEnvFile: true,
          }),
        ],
        providers: [SecurityConfigService],
      }).compile();

      const service = module.get<SecurityConfigService>(SecurityConfigService);
      const corsConfig = service.getCorsConfig();

      expect(corsConfig.allowedOrigins).toEqual([
        'https://example.com',
        'http://localhost:3000',
      ]);
    });

    it('should handle single origin without comma', async () => {
      process.env.SECURITY_CORS_ALLOWED_ORIGINS = 'https://single-origin.com';

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [securityConfig],
            ignoreEnvFile: true,
          }),
        ],
        providers: [SecurityConfigService],
      }).compile();

      const service = module.get<SecurityConfigService>(SecurityConfigService);
      const corsConfig = service.getCorsConfig();

      expect(corsConfig.allowedOrigins).toEqual(['https://single-origin.com']);
    });
  });
});
