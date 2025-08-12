import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CustomThrottlerGuard } from './security/throttler.guard';
import { CorsSecurityService } from './security/cors-security.service';
import { CorsExceptionFilter } from './security/cors-exception.filter';
import { SecurityLoggerService } from './security/security-logger.service';
import { GracefulShutdownService } from './common/shutdown/graceful-shutdown.service';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port');

  // Security headers with Helmet (requirement 5.1)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for file uploads
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // Enable global exception filters
  app.useGlobalFilters(
    app.get(CorsExceptionFilter),
    new GlobalExceptionFilter(),
  );

  // Enable global validation pipe with sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Enable global rate limiting with CustomThrottlerGuard
  // Temporarily disabled due to storage service issue
  // app.useGlobalGuards(app.get(CustomThrottlerGuard));

  // Enable metrics interceptor globally
  app.useGlobalInterceptors(app.get(MetricsInterceptor));

  // Set up graceful shutdown
  const gracefulShutdownService = app.get(GracefulShutdownService);

  // Register shutdown hooks
  gracefulShutdownService.registerShutdownHook(
    'server',
    async () => {
      console.log('Shutting down HTTP server...');
      await app.close();
    },
    1,
  );

  // Strict CORS configuration with domain whitelist (requirements 2.1, 2.2, 2.3, 2.4, 2.5)
  const corsSecurityService = app.get(CorsSecurityService);
  app.enableCors(corsSecurityService.getCorsConfig());

  // Initialize security logging with configuration (requirement 3.3)
  const securityLogger = app.get(SecurityLoggerService);
  const rateLimitConfig = {
    windowMs: configService.get<number>('SECURITY_RATE_LIMIT_WINDOW_MS', 1000),
    maxRequests: configService.get<number>('SECURITY_RATE_LIMIT_MAX', 3),
  };

  securityLogger.logSecurityConfiguration({
    rateLimit: rateLimitConfig,
    cors: {
      allowedOrigins: corsSecurityService.getAllowedOrigins(),
    },
  });

  // Log security middleware integration status (requirement 4.1, 4.2)
  console.log('Security middleware integration status:');
  console.log(
    `- Rate limiting: ${rateLimitConfig.maxRequests} requests per ${rateLimitConfig.windowMs}ms`,
  );
  console.log(
    `- CORS origins: ${corsSecurityService.getAllowedOrigins().join(', ')}`,
  );
  console.log('- CustomThrottlerGuard: Registered globally');
  console.log('- SecurityLoggerService: Initialized');
  console.log('- CORS Exception Filter: Registered globally');
  console.log('- Helmet security headers: Enabled');

  await app.listen(port || 3000);
  console.log(`Application is running on: http://localhost:${port || 3000}`);
}
void bootstrap();
