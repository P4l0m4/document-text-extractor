import { registerAs } from '@nestjs/config';

/**
 * Parse comma-separated origins from environment variable
 * @param originsString - Comma-separated string of origins
 * @returns Array of origin strings
 */
function parseAllowedOrigins(originsString?: string): string[] {
  if (!originsString) {
    return ['https://supernotaire.fr', 'http://localhost:3001']; // Secure defaults
  }

  return originsString
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * Security configuration factory
 * Loads security settings from environment variables with secure defaults
 */
export default registerAs('security', () => {
  const allowedOrigins = parseAllowedOrigins(
    process.env.SECURITY_CORS_ALLOWED_ORIGINS,
  );

  return {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      optionsSuccessStatus: 200, // For legacy browser support
    },
    rateLimit: {
      windowMs:
        parseInt(process.env.SECURITY_RATE_LIMIT_WINDOW_MS || '1000', 10) ||
        1000, // 1 second default
      max: parseInt(process.env.SECURITY_RATE_LIMIT_MAX || '3', 10) || 3, // 3 requests per second default
      message: 'Rate limit exceeded. Maximum 3 requests per second allowed.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for file uploads
    },
    // Configuration metadata for logging
    configSource: {
      corsOriginsFromEnv: !!process.env.SECURITY_CORS_ALLOWED_ORIGINS,
      rateLimitWindowFromEnv: !!process.env.SECURITY_RATE_LIMIT_WINDOW_MS,
      rateLimitMaxFromEnv: !!process.env.SECURITY_RATE_LIMIT_MAX,
    },
  };
});
