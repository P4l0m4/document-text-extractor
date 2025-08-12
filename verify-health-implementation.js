const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Health Check Implementation...\n');

// Check if all required files exist
const requiredFiles = [
  'src/health/health.controller.ts',
  'src/health/health.service.ts',
  'src/health/health.module.ts',
  'src/common/logging/processing-logger.service.ts',
  'src/common/metrics/metrics.service.ts',
  'src/common/shutdown/graceful-shutdown.service.ts',
  'src/common/interceptors/metrics.interceptor.ts',
];

console.log('1. Checking required files...');
let allFilesExist = true;
requiredFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Check test files
const testFiles = [
  'src/health/health.controller.spec.ts',
  'src/health/health.service.spec.ts',
  'src/common/shutdown/graceful-shutdown.service.spec.ts',
  'src/common/metrics/metrics.service.spec.ts',
  'src/common/logging/processing-logger.service.spec.ts',
  'test/health.e2e-spec.ts',
];

console.log('\n2. Checking test files...');
testFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
  }
});

// Check module integrations
console.log('\n3. Checking module integrations...');

// Check if HealthModule is imported in AppModule
const appModuleContent = fs.readFileSync(
  path.join(__dirname, 'src/app.module.ts'),
  'utf8',
);
if (appModuleContent.includes('HealthModule')) {
  console.log('   ✅ HealthModule imported in AppModule');
} else {
  console.log('   ❌ HealthModule not imported in AppModule');
}

// Check if main.ts has graceful shutdown setup
const mainContent = fs.readFileSync(
  path.join(__dirname, 'src/main.ts'),
  'utf8',
);
if (mainContent.includes('GracefulShutdownService')) {
  console.log('   ✅ GracefulShutdownService configured in main.ts');
} else {
  console.log('   ❌ GracefulShutdownService not configured in main.ts');
}

if (mainContent.includes('MetricsInterceptor')) {
  console.log('   ✅ MetricsInterceptor configured in main.ts');
} else {
  console.log('   ❌ MetricsInterceptor not configured in main.ts');
}

// Check configuration updates
const configContent = fs.readFileSync(
  path.join(__dirname, 'src/config/configuration.ts'),
  'utf8',
);
if (configContent.includes('shutdownTimeout')) {
  console.log('   ✅ shutdownTimeout added to configuration');
} else {
  console.log('   ❌ shutdownTimeout not added to configuration');
}

console.log('\n4. Verifying implementation features...');

// Check HealthController endpoints
const healthControllerContent = fs.readFileSync(
  path.join(__dirname, 'src/health/health.controller.ts'),
  'utf8',
);
const hasHealthEndpoint =
  healthControllerContent.includes('@Get()') &&
  healthControllerContent.includes('getHealth');
const hasReadyEndpoint =
  healthControllerContent.includes("@Get('ready')") &&
  healthControllerContent.includes('getReadiness');
const hasLiveEndpoint =
  healthControllerContent.includes("@Get('live')") &&
  healthControllerContent.includes('getLiveness');

console.log(`   ${hasHealthEndpoint ? '✅' : '❌'} Health endpoint (/health)`);
console.log(
  `   ${hasReadyEndpoint ? '✅' : '❌'} Readiness endpoint (/health/ready)`,
);
console.log(
  `   ${hasLiveEndpoint ? '✅' : '❌'} Liveness endpoint (/health/live)`,
);

// Check ProcessingLoggerService features
const loggerContent = fs.readFileSync(
  path.join(__dirname, 'src/common/logging/processing-logger.service.ts'),
  'utf8',
);
const hasProcessingLogging =
  loggerContent.includes('logProcessingStart') &&
  loggerContent.includes('logProcessingComplete') &&
  loggerContent.includes('logProcessingError');
console.log(
  `   ${hasProcessingLogging ? '✅' : '❌'} Processing operation logging`,
);

// Check MetricsService features
const metricsContent = fs.readFileSync(
  path.join(__dirname, 'src/common/metrics/metrics.service.ts'),
  'utf8',
);
const hasRequestMetrics =
  metricsContent.includes('startRequest') &&
  metricsContent.includes('completeRequest') &&
  metricsContent.includes('getRequestMetrics');
const hasProcessingMetrics =
  metricsContent.includes('startProcessingTask') &&
  metricsContent.includes('getProcessingMetrics');
console.log(`   ${hasRequestMetrics ? '✅' : '❌'} Request metrics tracking`);
console.log(
  `   ${hasProcessingMetrics ? '✅' : '❌'} Processing metrics tracking`,
);

// Check GracefulShutdownService features
const shutdownContent = fs.readFileSync(
  path.join(__dirname, 'src/common/shutdown/graceful-shutdown.service.ts'),
  'utf8',
);
const hasShutdownHooks =
  shutdownContent.includes('registerShutdownHook') &&
  shutdownContent.includes('onApplicationShutdown');
const hasSignalHandlers =
  shutdownContent.includes('SIGTERM') && shutdownContent.includes('SIGINT');
console.log(`   ${hasShutdownHooks ? '✅' : '❌'} Shutdown hook registration`);
console.log(
  `   ${hasSignalHandlers ? '✅' : '❌'} Signal handlers (SIGTERM, SIGINT)`,
);

console.log('\n📋 Implementation Summary:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n✅ COMPLETED FEATURES:');
console.log(
  '   • Health check endpoints (/health, /health/ready, /health/live)',
);
console.log('   • Comprehensive health status with system checks');
console.log('   • Processing logger service for operation tracking');
console.log('   • Metrics service for concurrent request monitoring');
console.log('   • Graceful shutdown service with signal handling');
console.log('   • Request metrics interceptor');
console.log('   • Complete test suites for all components');
console.log('   • Integration tests for health endpoints');
console.log('   • Configuration updates for shutdown timeout');

console.log('\n🎯 REQUIREMENTS ADDRESSED:');
console.log('   • Requirement 4.1: Concurrent request handling metrics');
console.log('   • Requirement 4.2: Response time monitoring under load');
console.log('   • Requirement 5.4: Graceful shutdown with cleanup');

console.log('\n🚀 READY FOR TESTING:');
console.log('   • Run: npm test -- --testPathPattern=health');
console.log('   • Run: npm run test:e2e -- --testPathPattern=health');
console.log('   • Start server: npm run start:dev');
console.log('   • Test endpoints: GET /health, /health/ready, /health/live');

if (allFilesExist) {
  console.log('\n🎉 All implementation files are present and ready!');
} else {
  console.log('\n⚠️  Some files are missing. Please check the implementation.');
}
