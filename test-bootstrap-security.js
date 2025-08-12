const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testBootstrap() {
  try {
    console.log(
      'Testing application bootstrap with enhanced security configuration...',
    );

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
      abortOnError: false,
    });

    console.log('✅ Application created successfully');

    // Test that security services are available
    try {
      const corsSecurityService = app.get('CorsSecurityService');
      console.log('✅ CorsSecurityService initialized');

      const allowedOrigins = corsSecurityService.getAllowedOrigins();
      console.log('✅ CORS allowed origins:', allowedOrigins);
    } catch (e) {
      console.log('⚠️ CorsSecurityService not available:', e.message);
    }

    try {
      const securityLogger = app.get('SecurityLoggerService');
      console.log('✅ SecurityLoggerService initialized');
    } catch (e) {
      console.log('⚠️ SecurityLoggerService not available:', e.message);
    }

    try {
      const customThrottlerGuard = app.get('CustomThrottlerGuard');
      console.log('✅ CustomThrottlerGuard initialized');
    } catch (e) {
      console.log('⚠️ CustomThrottlerGuard not available:', e.message);
    }

    await app.close();
    console.log('✅ Application bootstrap test completed successfully');
  } catch (error) {
    console.error('❌ Bootstrap test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Add timeout to prevent hanging
setTimeout(() => {
  console.error('❌ Test timed out after 30 seconds');
  process.exit(1);
}, 30000);

testBootstrap();
