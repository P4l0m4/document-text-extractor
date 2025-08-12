import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';
import {
  SecurityLoggerService,
  CorsViolationEvent,
} from './security-logger.service';

@Catch()
@Injectable()
export class CorsExceptionFilter implements ExceptionFilter {
  constructor(private readonly securityLogger: SecurityLoggerService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Check if this is a CORS error
    if (exception.name === 'CorsError' || exception.message?.includes('CORS')) {
      // Get client IP address
      const clientIp =
        request.ip ||
        request.connection?.remoteAddress ||
        request.socket?.remoteAddress ||
        'unknown';

      // Log CORS violation
      const corsViolationEvent: CorsViolationEvent = {
        type: 'CORS_VIOLATION',
        origin: request.headers.origin || 'unknown',
        clientIp,
        endpoint: request.url || request.path || 'unknown',
        method: request.method || 'unknown',
        timestamp: new Date(),
      };

      this.securityLogger.logCorsViolation(corsViolationEvent);

      const corsError = {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden',
        error: 'Origin not allowed by CORS policy',
        timestamp: new Date().toISOString(),
        path: request.url,
        origin: request.headers.origin || 'unknown',
      };

      response.status(HttpStatus.FORBIDDEN).json(corsError);
      return;
    }

    // If it's not a CORS error, let other filters handle it
    throw exception;
  }
}
