import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { CorsExceptionFilter } from './cors-exception.filter';
import { SecurityLoggerService } from './security-logger.service';

describe('CorsExceptionFilter', () => {
  let filter: CorsExceptionFilter;
  let securityLogger: SecurityLoggerService;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(async () => {
    const mockSecurityLogger = {
      logCorsViolation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorsExceptionFilter,
        {
          provide: SecurityLoggerService,
          useValue: mockSecurityLogger,
        },
      ],
    }).compile();

    securityLogger = module.get<SecurityLoggerService>(SecurityLoggerService);

    filter = module.get<CorsExceptionFilter>(CorsExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test-endpoint',
      headers: {
        origin: 'https://malicious-site.com',
      },
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle CORS errors with proper HTTP 403 response', () => {
    const corsError = new Error('Origin not allowed by CORS policy');
    corsError.name = 'CorsError';

    mockRequest.ip = '192.168.1.1';
    mockRequest.method = 'GET';

    filter.catch(corsError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Forbidden',
      error: 'Origin not allowed by CORS policy',
      timestamp: expect.any(String),
      path: '/test-endpoint',
      origin: 'https://malicious-site.com',
    });

    // Verify security logging
    expect(securityLogger.logCorsViolation).toHaveBeenCalledWith({
      type: 'CORS_VIOLATION',
      origin: 'https://malicious-site.com',
      clientIp: '192.168.1.1',
      endpoint: '/test-endpoint',
      method: 'GET',
      timestamp: expect.any(Date),
    });
  });

  it('should handle CORS errors with message containing CORS', () => {
    const corsError = new Error('Request blocked by CORS');

    mockRequest.ip = '10.0.0.1';
    mockRequest.method = 'POST';

    filter.catch(corsError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Forbidden',
      error: 'Origin not allowed by CORS policy',
      timestamp: expect.any(String),
      path: '/test-endpoint',
      origin: 'https://malicious-site.com',
    });

    // Verify security logging
    expect(securityLogger.logCorsViolation).toHaveBeenCalledWith({
      type: 'CORS_VIOLATION',
      origin: 'https://malicious-site.com',
      clientIp: '10.0.0.1',
      endpoint: '/test-endpoint',
      method: 'POST',
      timestamp: expect.any(Date),
    });
  });

  it('should handle unknown origin in request headers', () => {
    const corsError = new Error('Origin not allowed by CORS policy');
    corsError.name = 'CorsError';

    mockRequest.headers = {}; // No origin header
    mockRequest.ip = '127.0.0.1';
    mockRequest.method = 'OPTIONS';

    filter.catch(corsError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Forbidden',
      error: 'Origin not allowed by CORS policy',
      timestamp: expect.any(String),
      path: '/test-endpoint',
      origin: 'unknown',
    });

    // Verify security logging with unknown origin
    expect(securityLogger.logCorsViolation).toHaveBeenCalledWith({
      type: 'CORS_VIOLATION',
      origin: 'unknown',
      clientIp: '127.0.0.1',
      endpoint: '/test-endpoint',
      method: 'OPTIONS',
      timestamp: expect.any(Date),
    });
  });

  it('should re-throw non-CORS errors', () => {
    const nonCorsError = new Error('Some other error');

    expect(() => {
      filter.catch(nonCorsError, mockHost);
    }).toThrow('Some other error');

    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });
});
