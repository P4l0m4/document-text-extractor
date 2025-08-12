import { Injectable, Logger } from '@nestjs/common';

export interface SecurityLogEntry {
  timestamp: Date;
  type: 'RATE_LIMIT' | 'CORS_VIOLATION' | 'SECURITY_CONFIG';
  clientIp: string;
  origin?: string;
  endpoint: string;
  userAgent?: string;
  details: Record<string, any>;
}

export interface RateLimitEvent {
  type: 'RATE_LIMIT_EXCEEDED';
  clientIp: string;
  endpoint: string;
  requestCount: number;
  windowStart: Date;
  timestamp: Date;
}

export interface CorsViolationEvent {
  type: 'CORS_VIOLATION';
  origin: string;
  clientIp: string;
  endpoint: string;
  method: string;
  timestamp: Date;
}

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);
  private securityLogs: SecurityLogEntry[] = [];
  private readonly maxLogEntries = 1000; // Keep last 1000 entries

  /**
   * Log rate limit violations with IP, timestamp, and endpoint details
   */
  logRateLimitViolation(event: RateLimitEvent): void {
    const entry: SecurityLogEntry = {
      timestamp: event.timestamp,
      type: 'RATE_LIMIT',
      clientIp: event.clientIp,
      endpoint: event.endpoint,
      details: {
        requestCount: event.requestCount,
        windowStart: event.windowStart,
        violationType: 'RATE_LIMIT_EXCEEDED',
      },
    };

    this.addLogEntry(entry);
    this.logger.warn(
      `Rate limit exceeded for IP ${event.clientIp} on endpoint ${event.endpoint} - ${event.requestCount} requests since ${event.windowStart.toISOString()}`,
    );
  }

  /**
   * Log CORS violations with origin, timestamp, and endpoint details
   */
  logCorsViolation(event: CorsViolationEvent): void {
    const entry: SecurityLogEntry = {
      timestamp: event.timestamp,
      type: 'CORS_VIOLATION',
      clientIp: event.clientIp,
      origin: event.origin,
      endpoint: event.endpoint,
      details: {
        method: event.method,
        violationType: 'CORS_VIOLATION',
      },
    };

    this.addLogEntry(entry);
    this.logger.warn(
      `CORS violation from origin ${event.origin} for IP ${event.clientIp} on ${event.method} ${event.endpoint}`,
    );
  }

  /**
   * Log security configuration initialization and changes
   */
  logSecurityConfiguration(config: {
    rateLimit: { windowMs: number; maxRequests: number };
    cors: { allowedOrigins: string[] };
  }): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date(),
      type: 'SECURITY_CONFIG',
      clientIp: 'system',
      endpoint: 'configuration',
      details: {
        rateLimitWindowMs: config.rateLimit.windowMs,
        rateLimitMaxRequests: config.rateLimit.maxRequests,
        corsAllowedOrigins: config.cors.allowedOrigins,
        configType: 'INITIALIZATION',
      },
    };

    this.addLogEntry(entry);
    this.logger.log(
      `Security configuration initialized - Rate limit: ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs}ms, CORS origins: ${config.cors.allowedOrigins.join(', ')}`,
    );
  }

  /**
   * Log enhanced security alerts for suspicious patterns
   */
  logSecurityAlert(
    clientIp: string,
    alertType: string,
    details: Record<string, any>,
  ): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date(),
      type: 'RATE_LIMIT',
      clientIp,
      endpoint: 'multiple',
      details: {
        alertType,
        ...details,
      },
    };

    this.addLogEntry(entry);
    this.logger.error(
      `Security alert for IP ${clientIp}: ${alertType} - ${JSON.stringify(details)}`,
    );
  }

  /**
   * Get recent security logs
   */
  getRecentLogs(limit: number = 100): SecurityLogEntry[] {
    return this.securityLogs.slice(-limit);
  }

  /**
   * Get security logs by IP address
   */
  getLogsByIp(clientIp: string): SecurityLogEntry[] {
    return this.securityLogs.filter((log) => log.clientIp === clientIp);
  }

  /**
   * Get security logs by type
   */
  getLogsByType(type: SecurityLogEntry['type']): SecurityLogEntry[] {
    return this.securityLogs.filter((log) => log.type === type);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalEvents: number;
    rateLimitViolations: number;
    corsViolations: number;
    configEvents: number;
    uniqueIps: number;
    recentActivity: SecurityLogEntry[];
  } {
    const rateLimitViolations = this.securityLogs.filter(
      (log) => log.type === 'RATE_LIMIT',
    ).length;
    const corsViolations = this.securityLogs.filter(
      (log) => log.type === 'CORS_VIOLATION',
    ).length;
    const configEvents = this.securityLogs.filter(
      (log) => log.type === 'SECURITY_CONFIG',
    ).length;

    const uniqueIps = new Set(
      this.securityLogs
        .filter((log) => log.clientIp !== 'system')
        .map((log) => log.clientIp),
    ).size;

    return {
      totalEvents: this.securityLogs.length,
      rateLimitViolations,
      corsViolations,
      configEvents,
      uniqueIps,
      recentActivity: this.getRecentLogs(10),
    };
  }

  /**
   * Check for suspicious patterns and log alerts
   */
  checkSuspiciousPatterns(clientIp: string): void {
    const recentLogs = this.securityLogs
      .filter(
        (log) =>
          log.clientIp === clientIp &&
          log.timestamp > new Date(Date.now() - 60000), // Last minute
      )
      .filter((log) => log.type === 'RATE_LIMIT');

    if (recentLogs.length >= 5) {
      this.logSecurityAlert(clientIp, 'MULTIPLE_RATE_LIMIT_VIOLATIONS', {
        violationCount: recentLogs.length,
        timeWindow: '1 minute',
        endpoints: [...new Set(recentLogs.map((log) => log.endpoint))],
      });
    }
  }

  private addLogEntry(entry: SecurityLogEntry): void {
    this.securityLogs.push(entry);

    // Keep only the most recent entries
    if (this.securityLogs.length > this.maxLogEntries) {
      this.securityLogs = this.securityLogs.slice(-this.maxLogEntries);
    }
  }
}
