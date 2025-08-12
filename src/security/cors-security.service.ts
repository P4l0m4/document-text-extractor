import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CorsConfig {
  allowedOrigins: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  maxAge: number;
}

@Injectable()
export class CorsSecurityService {
  private readonly allowedOrigins: string[];

  constructor(private readonly configService: ConfigService) {
    // Get allowed origins from environment or use secure defaults
    const envOrigins = this.configService.get<string>(
      'SECURITY_CORS_ALLOWED_ORIGINS',
    );
    this.allowedOrigins = envOrigins
      ? envOrigins.split(',').map((origin) => origin.trim())
      : ['https://supernotaire.fr', 'http://localhost:3001'];
  }

  /**
   * Validates if the given origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    return this.allowedOrigins.includes(origin);
  }

  /**
   * Gets the CORS configuration for NestJS
   */
  getCorsConfig(): any {
    return {
      origin: (
        origin: string,
        callback: (error: Error | null, allow?: boolean) => void,
      ) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          return callback(null, true);
        }

        if (this.isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          // Create a proper CORS error
          const error = new Error(
            `Origin ${origin} not allowed by CORS policy`,
          );
          error.name = 'CorsError';
          callback(error, false);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
      ],
      credentials: true,
      optionsSuccessStatus: 200, // For legacy browser support
      maxAge: 86400, // Cache preflight response for 24 hours
    };
  }

  /**
   * Gets the list of allowed origins
   */
  getAllowedOrigins(): string[] {
    return [...this.allowedOrigins];
  }
}
