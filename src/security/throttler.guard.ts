import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import {
  SecurityLoggerService,
  RateLimitEvent,
} from './security-logger.service';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly securityLogger: SecurityLoggerService,
  ) {
    super(options, storageService, reflector);
  }
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use IP address for tracking
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    // Generate a unique key for rate limiting
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;

    return `${className}-${methodName}-${suffix}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse<Response>();

    try {
      // Call the parent canActivate method
      const result = await super.canActivate(context);

      // If successful, add rate limit headers
      const throttlers = this.reflector.getAllAndOverride('throttlers', [
        context.getHandler(),
        context.getClass(),
      ]) || [{ limit: 3, ttl: 1 }]; // Default values

      const throttler = throttlers[0];
      const limit = throttler.limit;
      const ttl = throttler.ttl;

      // Get the tracker (IP address)
      const request = context.switchToHttp().getRequest();
      const tracker = await this.getTracker(request);
      const key = this.generateKey(
        context,
        tracker,
        throttler.name || 'default',
      );

      // Get current record from storage to calculate remaining requests
      const record = await (this as any).storageService.getRecord(key);
      const now = Date.now();
      const windowStart = now - ttl * 1000;

      let requestsInWindow = 0;
      if (record && record.length > 0) {
        requestsInWindow = record.filter(
          (timestamp: number) => timestamp > windowStart,
        ).length;
      }

      const remaining = Math.max(0, limit - requestsInWindow - 1); // Account for current request
      const resetTime = Math.ceil((windowStart + ttl * 1000) / 1000);

      // Add rate limit headers
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', remaining.toString());
      response.setHeader('X-RateLimit-Reset', resetTime.toString());

      return result;
    } catch (error) {
      // If it's a throttler exception, enhance it with additional headers and details
      if (error instanceof ThrottlerException) {
        const throttlers = this.reflector.getAllAndOverride('throttlers', [
          context.getHandler(),
          context.getClass(),
        ]) || [{ limit: 3, ttl: 1 }];

        const throttler = throttlers[0];
        const limit = throttler.limit;
        const ttl = throttler.ttl;

        // Get request details for logging
        const request = context.switchToHttp().getRequest();
        const tracker = await this.getTracker(request);
        const key = this.generateKey(
          context,
          tracker,
          throttler.name || 'default',
        );

        // Get current record from storage to calculate request count
        const record = await (this as any).storageService.getRecord(key);
        const now = Date.now();
        const windowStart = now - ttl * 1000;

        let requestsInWindow = 0;
        if (record && record.length > 0) {
          requestsInWindow = record.filter(
            (timestamp: number) => timestamp > windowStart,
          ).length;
        }

        // Log rate limit violation
        const rateLimitEvent: RateLimitEvent = {
          type: 'RATE_LIMIT_EXCEEDED',
          clientIp: tracker,
          endpoint: request.url || request.path || 'unknown',
          requestCount: requestsInWindow + 1, // Include current request
          windowStart: new Date(windowStart),
          timestamp: new Date(),
        };

        this.securityLogger.logRateLimitViolation(rateLimitEvent);

        // Check for suspicious patterns (multiple violations)
        this.securityLogger.checkSuspiciousPatterns(tracker);

        // Add retry-after header and rate limit headers
        response.setHeader('Retry-After', Math.ceil(ttl).toString());
        response.setHeader('X-RateLimit-Limit', limit.toString());
        response.setHeader('X-RateLimit-Remaining', '0');
        response.setHeader(
          'X-RateLimit-Reset',
          Math.ceil((Date.now() + ttl * 1000) / 1000).toString(),
        );

        // Throw enhanced exception with detailed message
        throw new ThrottlerException(
          `Rate limit exceeded. Maximum ${limit} requests per second allowed.`,
        );
      }

      throw error;
    }
  }
}
