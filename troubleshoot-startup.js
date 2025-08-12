#!/usr/bin/env node

/**
 * Startup Troubleshooting Script for Document Processing API
 * This script helps identify and resolve common startup errors
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Document Processing API - Startup Troubleshooting\n');

// Color codes for better output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(path.join(__dirname, filePath));
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  } catch (error) {
    return null;
  }
}

// 1. Check Node.js and npm versions
log('1. Checking Node.js and npm versions...', 'blue');
try {
  const nodeVersion = process.version;
  log(`   Node.js version: ${nodeVersion}`, nodeVersion.startsWith('v18') || nodeVersion.startsWith('v20') ? 'green' : 'yellow');
  
  if (!nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20')) {
    log('   ⚠️  Recommended: Node.js 18.x or 20.x', 'yellow');
  }
} catch (error) {
  log('   ❌ Error checking Node.js version', 'red');
}

// 2. Check if all required files exist
log('\n2. Checking required files...', 'blue');
const requiredFiles = [
  'package.json',
  'src/main.ts',
  'src/app.module.ts',
  'src/ai/ai.module.ts',
  'src/ai/ai-model-pool.service.ts',
  'src/ai/performance-monitor.service.ts',
  'src/ai/optimized-temp-file.service.ts',
  'src/ai/memory-optimizer.service.ts',
  'src/ai/metrics-dashboard.service.ts',
  'src/ai/scanned-pdf-metrics.service.ts',
  'src/common/common.module.ts',
  'src/health/health.controller.ts'
];

let missingFiles = [];
requiredFiles.forEach(file => {
  const exists = checkFileExists(file);
  const status = exists ? '✅' : '❌';
  log(`   ${status} ${file}`, exists ? 'green' : 'red');
  if (!exists) missingFiles.push(file);
});

if (missingFiles.length > 0) {
  log(`\n   ❌ Missing ${missingFiles.length} required files!`, 'red');
  log('   Please ensure all files are present before starting the server.', 'yellow');
}

// 3. Check package.json dependencies
log('\n3. Checking package.json dependencies...', 'blue');
const packageJson = readFileContent('package.json');
if (packageJson) {
  try {
    const pkg = JSON.parse(packageJson);
    const requiredDeps = [
      '@nestjs/common',
      '@nestjs/core',
      '@nestjs/config',
      '@nestjs/platform-express',
      'tesseract.js',
      'pdf-parse',
      'pdf2pic',
      'multer',
      'uuid'
    ];

    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    
    requiredDeps.forEach(dep => {
      const exists = dependencies[dep];
      const status = exists ? '✅' : '❌';
      log(`   ${status} ${dep}${exists ? ` (${exists})` : ''}`, exists ? 'green' : 'red');
    });

    if (!dependencies['@nestjs/common']) {
      log('\n   ❌ Critical NestJS dependencies missing!', 'red');
      log('   Run: npm install', 'yellow');
    }
  } catch (error) {
    log('   ❌ Error parsing package.json', 'red');
  }
} else {
  log('   ❌ package.json not found', 'red');
}

// 4. Check TypeScript configuration
log('\n4. Checking TypeScript configuration...', 'blue');
const tsConfig = checkFileExists('tsconfig.json');
log(`   ${tsConfig ? '✅' : '❌'} tsconfig.json`, tsConfig ? 'green' : 'red');

if (tsConfig) {
  const tsConfigContent = readFileContent('tsconfig.json');
  if (tsConfigContent) {
    try {
      const config = JSON.parse(tsConfigContent);
      const hasExperimentalDecorators = config.compilerOptions?.experimentalDecorators;
      const hasEmitDecoratorMetadata = config.compilerOptions?.emitDecoratorMetadata;
      
      log(`   ${hasExperimentalDecorators ? '✅' : '❌'} experimentalDecorators`, hasExperimentalDecorators ? 'green' : 'red');
      log(`   ${hasEmitDecoratorMetadata ? '✅' : '❌'} emitDecoratorMetadata`, hasEmitDecoratorMetadata ? 'green' : 'red');
    } catch (error) {
      log('   ❌ Error parsing tsconfig.json', 'red');
    }
  }
}

// 5. Check module imports and exports
log('\n5. Checking module configurations...', 'blue');

// Check AI Module
const aiModuleContent = readFileContent('src/ai/ai.module.ts');
if (aiModuleContent) {
  const hasScannedPdfMetrics = aiModuleContent.includes('ScannedPdfMetricsService');
  const hasPerformanceMonitor = aiModuleContent.includes('ScannedPdfPerformanceMonitorService');
  const hasOptimizedTempFile = aiModuleContent.includes('OptimizedTempFileService');
  const hasMemoryOptimizer = aiModuleContent.includes('MemoryOptimizerService');
  const hasMetricsDashboard = aiModuleContent.includes('MetricsDashboardService');

  log(`   AI Module:`, 'blue');
  log(`     ${hasScannedPdfMetrics ? '✅' : '❌'} ScannedPdfMetricsService`, hasScannedPdfMetrics ? 'green' : 'red');
  log(`     ${hasPerformanceMonitor ? '✅' : '❌'} ScannedPdfPerformanceMonitorService`, hasPerformanceMonitor ? 'green' : 'red');
  log(`     ${hasOptimizedTempFile ? '✅' : '❌'} OptimizedTempFileService`, hasOptimizedTempFile ? 'green' : 'red');
  log(`     ${hasMemoryOptimizer ? '✅' : '❌'} MemoryOptimizerService`, hasMemoryOptimizer ? 'green' : 'red');
  log(`     ${hasMetricsDashboard ? '✅' : '❌'} MetricsDashboardService`, hasMetricsDashboard ? 'green' : 'red');

  if (!hasPerformanceMonitor) {
    log('     ⚠️  Make sure to use ScannedPdfPerformanceMonitorService (not PerformanceMonitorService)', 'yellow');
  }
} else {
  log('   ❌ AI Module not found', 'red');
}

// Check App Module
const appModuleContent = readFileContent('src/app.module.ts');
if (appModuleContent) {
  const hasAiModule = appModuleContent.includes('AiModule');
  const hasCommonModule = appModuleContent.includes('CommonModule');
  const hasHealthModule = appModuleContent.includes('HealthModule');

  log(`   App Module:`, 'blue');
  log(`     ${hasAiModule ? '✅' : '❌'} AiModule imported`, hasAiModule ? 'green' : 'red');
  log(`     ${hasCommonModule ? '✅' : '❌'} CommonModule imported`, hasCommonModule ? 'green' : 'red');
  log(`     ${hasHealthModule ? '✅' : '❌'} HealthModule imported`, hasHealthModule ? 'green' : 'red');
} else {
  log('   ❌ App Module not found', 'red');
}

// 6. Check for common import/export issues
log('\n6. Checking for common import issues...', 'blue');

const performanceMonitorContent = readFileContent('src/ai/performance-monitor.service.ts');
if (performanceMonitorContent) {
  const hasCorrectClassName = performanceMonitorContent.includes('export class ScannedPdfPerformanceMonitorService');
  const hasCorrectLogger = performanceMonitorContent.includes('ScannedPdfPerformanceMonitorService.name');
  
  log(`   Performance Monitor Service:`, 'blue');
  log(`     ${hasCorrectClassName ? '✅' : '❌'} Correct class name (ScannedPdfPerformanceMonitorService)`, hasCorrectClassName ? 'green' : 'red');
  log(`     ${hasCorrectLogger ? '✅' : '❌'} Correct logger name`, hasCorrectLogger ? 'green' : 'red');

  if (!hasCorrectClassName) {
    log('     ⚠️  Class should be named ScannedPdfPerformanceMonitorService', 'yellow');
  }
}

// 7. Check environment variables
log('\n7. Checking environment configuration...', 'blue');
const envFile = checkFileExists('.env');
log(`   ${envFile ? '✅' : '⚠️'} .env file`, envFile ? 'green' : 'yellow');

if (!envFile) {
  log('   ⚠️  Consider creating a .env file with required configuration', 'yellow');
}

// Check for common environment variables
const commonEnvVars = [
  'NODE_ENV',
  'PORT',
  'TEMP_DIR'
];

commonEnvVars.forEach(envVar => {
  const exists = process.env[envVar];
  log(`   ${exists ? '✅' : '⚠️'} ${envVar}${exists ? ` = ${exists}` : ' (not set)'}`, exists ? 'green' : 'yellow');
});

// 8. Check for circular dependencies
log('\n8. Checking for potential circular dependencies...', 'blue');
const aiPoolContent = readFileContent('src/ai/ai-model-pool.service.ts');
if (aiPoolContent) {
  const imports = aiPoolContent.match(/import.*from.*['"]\.\/.*['"];/g) || [];
  const localImports = imports.filter(imp => imp.includes('./'));
  
  log(`   AI Model Pool Service has ${localImports.length} local imports`, localImports.length < 10 ? 'green' : 'yellow');
  
  if (localImports.length > 8) {
    log('   ⚠️  High number of local imports - check for circular dependencies', 'yellow');
  }
}

// 9. Generate startup command recommendations
log('\n9. Startup recommendations...', 'blue');

log('   Recommended startup commands:', 'green');
log('   Development: npm run start:dev', 'green');
log('   Production: npm run build && npm run start:prod', 'green');
log('   Debug: npm run start:debug', 'green');

// 10. Common fixes
log('\n10. Common fixes for startup errors...', 'blue');

log('   If you see "Cannot resolve dependency" errors:', 'yellow');
log('   • Check that all services are properly exported in their modules', 'yellow');
log('   • Ensure circular dependencies are avoided', 'yellow');
log('   • Verify import paths are correct', 'yellow');

log('\n   If you see "Module not found" errors:', 'yellow');
log('   • Run: npm install', 'yellow');
log('   • Check that all required dependencies are in package.json', 'yellow');
log('   • Clear node_modules and reinstall: rm -rf node_modules && npm install', 'yellow');

log('\n   If you see TypeScript compilation errors:', 'yellow');
log('   • Run: npm run build', 'yellow');
log('   • Check tsconfig.json configuration', 'yellow');
log('   • Ensure all imports have correct types', 'yellow');

log('\n   If you see "Cannot find module" for custom services:', 'yellow');
log('   • Check that the service is properly exported from its module', 'yellow');
log('   • Verify the import path is correct', 'yellow');
log('   • Ensure the service is added to the module providers array', 'yellow');

// 11. Quick fix script
log('\n11. Quick fix commands...', 'blue');
log('   Run these commands to fix common issues:', 'green');
log('   npm install                    # Install dependencies', 'green');
log('   npm run build                  # Compile TypeScript', 'green');
log('   npm run start:dev              # Start in development mode', 'green');

// 12. Environment setup for performance optimization
log('\n12. Performance optimization setup...', 'blue');
log('   For optimal performance, set these environment variables:', 'green');
log('   NODE_OPTIONS="--expose-gc"     # Enable garbage collection', 'green');
log('   MEMORY_ENABLE_GC=true          # Enable memory optimization', 'green');
log('   TEMP_DIR=/tmp/document-processing  # Set temp directory', 'green');

// Summary
log('\n' + '='.repeat(60), 'blue');
log('TROUBLESHOOTING SUMMARY', 'blue');
log('='.repeat(60), 'blue');

if (missingFiles.length === 0) {
  log('✅ All required files are present', 'green');
} else {
  log(`❌ ${missingFiles.length} files are missing`, 'red');
}

log('\nNext steps:', 'blue');
log('1. Fix any issues identified above', 'yellow');
log('2. Run: npm install', 'yellow');
log('3. Run: npm run build', 'yellow');
log('4. Run: npm run start:dev', 'yellow');
log('5. Check the console output for any remaining errors', 'yellow');

log('\nIf you still have issues:', 'blue');
log('• Check the full error message in the console', 'yellow');
log('• Look for specific module or dependency errors', 'yellow');
log('• Ensure all TypeScript files compile without errors', 'yellow');
log('• Verify that all services are properly registered in their modules', 'yellow');

log('\n🚀 Good luck with your startup!', 'green');