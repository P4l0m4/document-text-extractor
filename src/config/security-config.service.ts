import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Interface for security configuration
 */
export interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    allowedOrigins: string[];
  };
  logging: {
    enabled: boolean;
    level: 'info' | 'warn' | 'error';
  };
}

/**
 * Interface for rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

/**
 * Interface for CORS configuration
 */
export interface CorsConfig {
  allowedOrigins: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  maxAge: number;
}

/**
 * Service for managing security configuration from environment variables
 * Provides secure defaults when environment variables are not provided
 */
@Injectable()
export class SecurityConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get rate limiting configuration
   * @returns RateLimitConfig with environment values or secure defaults
   */
  getRateLimitConfig(): RateLimitConfig {
    const windowMsValue = this.configService.get<string>(
      'SECURITY_RATE_LIMIT_WINDOW_MS',
      '1000',
    );
    const maxRequestsValue = this.configService.get<string>(
      'SECURITY_RATE_LIMIT_MAX',
      '3',
    );

    const windowMs = this.parseIntWithDefault(windowMsValue, 1000);
    const maxRequests = this.parseIntWithDefault(maxRequestsValue, 3);

    return {
      windowMs,
      maxRequests,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      standardHeaders: true,
      legacyHeaders: false,
    };
  }

  /**
   * Get CORS configuration
   * @returns CorsConfig with environment values or secure defaults
   */
  getCorsConfig(): CorsConfig {
    const allowedOriginsString = this.configService.get<string>(
      'SECURITY_CORS_ALLOWED_ORIGINS',
      'https://supernotaire.fr,http://localhost:3001',
    );

    const allowedOrigins = this.parseAllowedOrigins(allowedOriginsString);

    return {
      allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86400, // 24 hours
    };
  }

  /**
   * Get complete security configuration
   * @returns SecurityConfig with all security settings
   */
  getSecurityConfig(): SecurityConfig {
    const rateLimitConfig = this.getRateLimitConfig();
    const corsConfig = this.getCorsConfig();

    return {
      rateLimit: {
        windowMs: rateLimitConfig.windowMs,
        maxRequests: rateLimitConfig.maxRequests,
      },
      cors: {
        allowedOrigins: corsConfig.allowedOrigins,
      },
      logging: {
        enabled: true,
        level: 'info',
      },
    };
  }

  /**
   * Get configuration metadata for logging purposes
   * @returns Object indicating which values came from environment variables
   */
  getConfigurationMetadata(): Record<string, boolean> {
    return {
      rateLimitWindowFromEnv:
        this.configService.get('SECURITY_RATE_LIMIT_WINDOW_MS') !== undefined,
      rateLimitMaxFromEnv:
        this.configService.get('SECURITY_RATE_LIMIT_MAX') !== undefined,
      corsOriginsFromEnv:
        this.configService.get('SECURITY_CORS_ALLOWED_ORIGINS') !== undefined,
    };
  }

  /**
   * Validate security configuration values
   * @returns Array of validation errors, empty if valid
   */
  validateConfiguration(): string[] {
    const errors: string[] = [];
    const rateLimitConfig = this.getRateLimitConfig();
    const corsConfig = this.getCorsConfig();

    // Validate rate limit configuration
    if (rateLimitConfig.windowMs < 1000) {
      errors.push('SECURITY_RATE_LIMIT_WINDOW_MS must be at least 1000ms');
    }

    if (rateLimitConfig.maxRequests < 1 || rateLimitConfig.maxRequests > 100) {
      errors.push('SECURITY_RATE_LIMIT_MAX must be between 1 and 100');
    }

    // Validate CORS configuration
    if (corsConfig.allowedOrigins.length === 0) {
      errors.push(
        'SECURITY_CORS_ALLOWED_ORIGINS must contain at least one origin',
      );
    }

    // Validate origin formats
    corsConfig.allowedOrigins.forEach((origin, index) => {
      if (!this.isValidOrigin(origin)) {
        errors.push(`Invalid origin at index ${index}: ${origin}`);
      }
    });

    return errors;
  }

  /**
   * Parse integer with default value, handling edge cases like 0
   * @param value - String value to parse
   * @param defaultValue - Default value if parsing fails
   * @returns Parsed integer or default value
   */
  private parseIntWithDefault(value: string, defaultValue: number): number {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Parse comma-separated origins from environment variable
   * @param originsString - Comma-separated string of origins
   * @returns Array of origin strings
   */
  private parseAllowedOrigins(originsString: string): string[] {
    return originsString
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  /**
   * Validate origin format
   * @param origin - Origin string to validate
   * @returns True if origin is valid
   */
  private isValidOrigin(origin: string): boolean {
    try {
      // Allow localhost patterns
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('https://localhost:')
      ) {
        return true;
      }

      // Validate as URL
      const url = new URL(origin);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
