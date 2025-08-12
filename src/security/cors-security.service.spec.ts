import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CorsSecurityService } from './cors-security.service';

describe('CorsSecurityService', () => {
  let service: CorsSecurityService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorsSecurityService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CorsSecurityService>(CorsSecurityService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isOriginAllowed', () => {
    it('should allow https://supernotaire.fr', () => {
      expect(service.isOriginAllowed('https://supernotaire.fr')).toBe(true);
    });

    it('should allow http://localhost:3001', () => {
      expect(service.isOriginAllowed('http://localhost:3001')).toBe(true);
    });

    it('should reject unauthorized origins', () => {
      expect(service.isOriginAllowed('https://malicious-site.com')).toBe(false);
      expect(service.isOriginAllowed('http://localhost:3000')).toBe(false);
      expect(service.isOriginAllowed('https://example.com')).toBe(false);
    });
  });

  describe('getCorsConfig', () => {
    it('should return proper CORS configuration', () => {
      const config = service.getCorsConfig();

      expect(config).toHaveProperty('origin');
      expect(config).toHaveProperty('methods');
      expect(config).toHaveProperty('allowedHeaders');
      expect(config).toHaveProperty('credentials');
      expect(config).toHaveProperty('optionsSuccessStatus');
      expect(config).toHaveProperty('maxAge');

      expect(config.credentials).toBe(true);
      expect(config.optionsSuccessStatus).toBe(200);
      expect(config.maxAge).toBe(86400);
      expect(config.methods).toEqual([
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'OPTIONS',
      ]);
    });

    it('should handle origin validation correctly', () => {
      const config = service.getCorsConfig();
      const originCallback = config.origin;

      // Test allowed origin
      const mockCallback = jest.fn();
      originCallback('https://supernotaire.fr', mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(null, true);

      // Test disallowed origin
      const mockCallback2 = jest.fn();
      originCallback('https://malicious-site.com', mockCallback2);
      expect(mockCallback2).toHaveBeenCalledWith(expect.any(Error), false);

      // Test no origin (should be allowed)
      const mockCallback3 = jest.fn();
      originCallback(undefined, mockCallback3);
      expect(mockCallback3).toHaveBeenCalledWith(null, true);
    });
  });

  describe('getAllowedOrigins', () => {
    it('should return default allowed origins', () => {
      const origins = service.getAllowedOrigins();
      expect(origins).toEqual([
        'https://supernotaire.fr',
        'http://localhost:3001',
      ]);
    });
  });

  describe('environment configuration', () => {
    it('should use environment variable when provided', async () => {
      const mockConfigService = {
        get: jest
          .fn()
          .mockReturnValue('https://custom.com,http://localhost:4000'),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CorsSecurityService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const customService =
        module.get<CorsSecurityService>(CorsSecurityService);

      expect(customService.getAllowedOrigins()).toEqual([
        'https://custom.com',
        'http://localhost:4000',
      ]);
      expect(customService.isOriginAllowed('https://custom.com')).toBe(true);
      expect(customService.isOriginAllowed('https://supernotaire.fr')).toBe(
        false,
      );
    });
  });
});
