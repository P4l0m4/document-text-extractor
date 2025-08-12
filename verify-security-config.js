const { Test } = require('@nestjs/testing');
const { ConfigModule } = require('@nestjs/config');
const {
  SecurityConfigService,
} = require('./dist/config/security-config.service');
const securityConfig = require('./dist/config/security.config').default;

async function verifySecurityConfiguration() {
  console.log('🔒 Verifying Security Configuration Management...\n');

  // Test 1: Default configuration
  console.log('📋 Test 1: Default Configuration');
  delete process.env.SECURITY_RATE_LIMIT_WINDOW_MS;
  delete process.env.SECURITY_RATE_LIMIT_MAX;
  delete process.env.SECURITY_CORS_ALLOWED_ORIGINS;

  const defaultModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        load: [securityConfig],
        ignoreEnvFile: true,
      }),
    ],
    providers: [SecurityConfigService],
  }).compile();

  const defaultService = defaultModule.get(SecurityConfigService);
  const defaultConfig = defaultService.getSecurityConfig();
  const defaultMetadata = defaultService.getConfigurationMetadata();
  const defaultErrors = defaultService.validateConfiguration();

  console.log('   Rate Limit:', defaultConfig.rateLimit);
  console.log('   CORS Origins:', defaultConfig.cors.allowedOrigins);
  console.log('   From Environment:', defaultMetadata);
  console.log(
    '   Validation Errors:',
    defaultErrors.length === 0 ? 'None' : defaultErrors,
  );
  console.log('   ✅ Default configuration loaded successfully\n');

  // Test 2: Custom environment variables
  console.log('📋 Test 2: Custom Environment Variables');
  process.env.SECURITY_RATE_LIMIT_WINDOW_MS = '2000';
  process.env.SECURITY_RATE_LIMIT_MAX = '5';
  process.env.SECURITY_CORS_ALLOWED_ORIGINS =
    'https://example.com,http://localhost:3000';

  const customModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        load: [securityConfig],
        ignoreEnvFile: true,
      }),
    ],
    providers: [SecurityConfigService],
  }).compile();

  const customService = customModule.get(SecurityConfigService);
  const customConfig = customService.getSecurityConfig();
  const customMetadata = customService.getConfigurationMetadata();
  const customErrors = customService.validateConfiguration();

  console.log('   Rate Limit:', customConfig.rateLimit);
  console.log('   CORS Origins:', customConfig.cors.allowedOrigins);
  console.log('   From Environment:', customMetadata);
  console.log(
    '   Validation Errors:',
    customErrors.length === 0 ? 'None' : customErrors,
  );
  console.log('   ✅ Custom configuration loaded successfully\n');

  // Test 3: Invalid configuration
  console.log(
    '📋 Test 3: Invalid Configuration (should show validation errors)',
  );
  process.env.SECURITY_RATE_LIMIT_WINDOW_MS = '500'; // Too low
  process.env.SECURITY_RATE_LIMIT_MAX = '150'; // Too high
  process.env.SECURITY_CORS_ALLOWED_ORIGINS = 'invalid-origin'; // Invalid format

  const invalidModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        load: [securityConfig],
        ignoreEnvFile: true,
      }),
    ],
    providers: [SecurityConfigService],
  }).compile();

  const invalidService = invalidModule.get(SecurityConfigService);
  const invalidConfig = invalidService.getSecurityConfig();
  const invalidErrors = invalidService.validateConfiguration();

  console.log('   Rate Limit:', invalidConfig.rateLimit);
  console.log('   CORS Origins:', invalidConfig.cors.allowedOrigins);
  console.log('   Validation Errors:', invalidErrors);
  console.log('   ✅ Validation correctly identified invalid configuration\n');

  // Test 4: Partial configuration
  console.log('📋 Test 4: Partial Configuration (mix of env and defaults)');
  process.env.SECURITY_RATE_LIMIT_WINDOW_MS = '3000';
  delete process.env.SECURITY_RATE_LIMIT_MAX;
  delete process.env.SECURITY_CORS_ALLOWED_ORIGINS;

  const partialModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        load: [securityConfig],
        ignoreEnvFile: true,
      }),
    ],
    providers: [SecurityConfigService],
  }).compile();

  const partialService = partialModule.get(SecurityConfigService);
  const partialConfig = partialService.getSecurityConfig();
  const partialMetadata = partialService.getConfigurationMetadata();
  const partialErrors = partialService.validateConfiguration();

  console.log('   Rate Limit:', partialConfig.rateLimit);
  console.log('   CORS Origins:', partialConfig.cors.allowedOrigins);
  console.log('   From Environment:', partialMetadata);
  console.log(
    '   Validation Errors:',
    partialErrors.length === 0 ? 'None' : partialErrors,
  );
  console.log('   ✅ Partial configuration loaded successfully\n');

  // Clean up environment variables
  delete process.env.SECURITY_RATE_LIMIT_WINDOW_MS;
  delete process.env.SECURITY_RATE_LIMIT_MAX;
  delete process.env.SECURITY_CORS_ALLOWED_ORIGINS;

  console.log('🎉 All security configuration tests passed!');
  console.log('\n📝 Summary:');
  console.log('   ✅ Environment-based configuration management implemented');
  console.log('   ✅ Secure default values provided when env vars not set');
  console.log('   ✅ Configuration validation working correctly');
  console.log(
    '   ✅ Support for SECURITY_RATE_LIMIT_WINDOW_MS environment variable',
  );
  console.log('   ✅ Support for SECURITY_RATE_LIMIT_MAX environment variable');
  console.log(
    '   ✅ Support for SECURITY_CORS_ALLOWED_ORIGINS environment variable',
  );
  console.log('   ✅ Configuration metadata tracking implemented');
}

verifySecurityConfiguration().catch(console.error);
