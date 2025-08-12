import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InputSanitizationService } from './input-sanitization.service';
import { CustomThrottlerGuard } from './throttler.guard';
import { CorsSecurityService } from './cors-security.service';
import { CorsExceptionFilter } from './cors-exception.filter';
import { SecurityLoggerService } from './security-logger.service';
import { SecurityConfigService } from '../config/security-config.service';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Use the new environment variables with secure defaults (3 requests per second)
        const windowMs = configService.get<number>(
          'SECURITY_RATE_LIMIT_WINDOW_MS',
          1000, // 1 second window
        );
        const maxRequests = configService.get<number>(
          'SECURITY_RATE_LIMIT_MAX',
          3, // 3 requests maximum
        );

        return [
          {
            ttl: Math.ceil(windowMs / 1000), // Convert to seconds for ThrottlerModule
            limit: maxRequests,
          },
        ];
      },
    }),
  ],
  providers: [
    Reflector,
    SecurityConfigService,
    InputSanitizationService,
    CustomThrottlerGuard,
    CorsSecurityService,
    CorsExceptionFilter,
    SecurityLoggerService,
  ],
  exports: [
    SecurityConfigService,
    InputSanitizationService,
    CustomThrottlerGuard,
    CorsSecurityService,
    CorsExceptionFilter,
    SecurityLoggerService,
  ],
})
export class SecurityModule {}
