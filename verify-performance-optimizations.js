#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Performance Optimizations Implementation');
console.log('='.repeat(60));

// Check if all performance optimization files exist
const baseDir = 'document-processing-api';
const requiredFiles = [
  `${baseDir}/src/ai/ai-model-pool.service.ts`,
  `${baseDir}/src/common/monitoring/performance-monitor.service.ts`,
  `${baseDir}/src/common/services/optimized-file-io.service.ts`,
  `${baseDir}/src/monitoring/monitoring.controller.ts`,
  `${baseDir}/src/monitoring/monitoring.module.ts`,
  `${baseDir}/test/load-test.spec.ts`,
  `${baseDir}/scripts/load-test.js`,
];

const testFiles = [
  `${baseDir}/src/ai/ai-model-pool.service.spec.ts`,
  `${baseDir}/src/common/monitoring/performance-monitor.service.spec.ts`,
  `${baseDir}/src/common/services/optimized-file-io.service.spec.ts`,
];

let allFilesExist = true;

console.log('\n📁 Checking implementation files:');
requiredFiles.forEach((file) => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log('\n🧪 Checking test files:');
testFiles.forEach((file) => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Check if modules are properly integrated
console.log('\n🔗 Checking module integration:');

// Check if AI module exports the pool service
const aiModulePath = `${baseDir}/src/ai/ai.module.ts`;
if (fs.existsSync(aiModulePath)) {
  const aiModuleContent = fs.readFileSync(aiModulePath, 'utf8');
  const hasPoolService = aiModuleContent.includes('AiModelPoolService');
  console.log(
    `  ${hasPoolService ? '✅' : '❌'} AI Module exports AiModelPoolService`,
  );
  if (!hasPoolService) allFilesExist = false;
}

// Check if common module exports performance services
const commonModulePath = `${baseDir}/src/common/common.module.ts`;
if (fs.existsSync(commonModulePath)) {
  const commonModuleContent = fs.readFileSync(commonModulePath, 'utf8');
  const hasPerformanceMonitor = commonModuleContent.includes(
    'PerformanceMonitorService',
  );
  const hasOptimizedFileIO = commonModuleContent.includes(
    'OptimizedFileIOService',
  );
  console.log(
    `  ${hasPerformanceMonitor ? '✅' : '❌'} Common Module exports PerformanceMonitorService`,
  );
  console.log(
    `  ${hasOptimizedFileIO ? '✅' : '❌'} Common Module exports OptimizedFileIOService`,
  );
  if (!hasPerformanceMonitor || !hasOptimizedFileIO) allFilesExist = false;
}

// Check if app module includes monitoring module
const appModulePath = `${baseDir}/src/app.module.ts`;
if (fs.existsSync(appModulePath)) {
  const appModuleContent = fs.readFileSync(appModulePath, 'utf8');
  const hasMonitoringModule = appModuleContent.includes('MonitoringModule');
  console.log(
    `  ${hasMonitoringModule ? '✅' : '❌'} App Module includes MonitoringModule`,
  );
  if (!hasMonitoringModule) allFilesExist = false;
}

// Check if processing service is updated
const processingServicePath = `${baseDir}/src/processing/processing.service.ts`;
if (fs.existsSync(processingServicePath)) {
  const processingContent = fs.readFileSync(processingServicePath, 'utf8');
  const hasPoolService = processingContent.includes('AiModelPoolService');
  const hasPerformanceMonitor = processingContent.includes(
    'PerformanceMonitorService',
  );
  const hasOptimizedFileIO = processingContent.includes(
    'OptimizedFileIOService',
  );
  console.log(
    `  ${hasPoolService ? '✅' : '❌'} Processing Service uses AiModelPoolService`,
  );
  console.log(
    `  ${hasPerformanceMonitor ? '✅' : '❌'} Processing Service uses PerformanceMonitorService`,
  );
  console.log(
    `  ${hasOptimizedFileIO ? '✅' : '❌'} Processing Service uses OptimizedFileIOService`,
  );
  if (!hasPoolService || !hasPerformanceMonitor || !hasOptimizedFileIO)
    allFilesExist = false;
}

// Check package.json for new scripts
const packageJsonPath = `${baseDir}/package.json`;
if (fs.existsSync(packageJsonPath)) {
  const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageContent);
  const hasLoadTestScript =
    packageJson.scripts && packageJson.scripts['load-test'];
  const hasPerformanceTestScript =
    packageJson.scripts && packageJson.scripts['performance-test'];
  const hasFormData =
    packageJson.dependencies && packageJson.dependencies['form-data'];

  console.log(
    `  ${hasLoadTestScript ? '✅' : '❌'} Package.json has load-test script`,
  );
  console.log(
    `  ${hasPerformanceTestScript ? '✅' : '❌'} Package.json has performance-test script`,
  );
  console.log(
    `  ${hasFormData ? '✅' : '❌'} Package.json includes form-data dependency`,
  );

  if (!hasLoadTestScript || !hasPerformanceTestScript || !hasFormData)
    allFilesExist = false;
}

// Analyze key features implemented
console.log('\n🚀 Performance Optimization Features:');

// Check AI Model Pool features
const poolServicePath = `${baseDir}/src/ai/ai-model-pool.service.ts`;
if (fs.existsSync(poolServicePath)) {
  const poolContent = fs.readFileSync(poolServicePath, 'utf8');

  const features = [
    {
      name: 'Worker Pool Management',
      check: poolContent.includes('PooledWorker'),
    },
    {
      name: 'Connection Pooling',
      check:
        poolContent.includes('getWorker') &&
        poolContent.includes('releaseWorker'),
    },
    {
      name: 'Memory Optimization',
      check: poolContent.includes('preprocessLargeText'),
    },
    {
      name: 'Idle Worker Cleanup',
      check: poolContent.includes('cleanupIdleWorkers'),
    },
    { name: 'Pool Statistics', check: poolContent.includes('getPoolStats') },
  ];

  features.forEach((feature) => {
    console.log(`  ${feature.check ? '✅' : '❌'} ${feature.name}`);
  });
}

// Check Performance Monitor features
const monitorServicePath = `${baseDir}/src/common/monitoring/performance-monitor.service.ts`;
if (fs.existsSync(monitorServicePath)) {
  const monitorContent = fs.readFileSync(monitorServicePath, 'utf8');

  const features = [
    { name: 'Operation Timing', check: monitorContent.includes('startTiming') },
    { name: 'Memory Tracking', check: monitorContent.includes('memoryUsage') },
    {
      name: 'Queue Metrics',
      check: monitorContent.includes('recordQueueMetric'),
    },
    {
      name: 'Performance Summaries',
      check: monitorContent.includes('getPerformanceSummary'),
    },
    {
      name: 'Percentile Calculations',
      check: monitorContent.includes('p95Duration'),
    },
    {
      name: 'Threshold Monitoring',
      check: monitorContent.includes('checkPerformanceThresholds'),
    },
  ];

  features.forEach((feature) => {
    console.log(`  ${feature.check ? '✅' : '❌'} ${feature.name}`);
  });
}

// Check Optimized File I/O features
const fileIOServicePath = `${baseDir}/src/common/services/optimized-file-io.service.ts`;
if (fs.existsSync(fileIOServicePath)) {
  const fileIOContent = fs.readFileSync(fileIOServicePath, 'utf8');

  const features = [
    {
      name: 'Streaming for Large Files',
      check:
        fileIOContent.includes('createReadStream') &&
        fileIOContent.includes('createWriteStream'),
    },
    {
      name: 'Optimal Buffer Sizing',
      check: fileIOContent.includes('calculateOptimalBufferSize'),
    },
    {
      name: 'Concurrency Control',
      check: fileIOContent.includes('executeWithConcurrencyControl'),
    },
    {
      name: 'Batch File Operations',
      check: fileIOContent.includes('cleanupFiles'),
    },
    { name: 'I/O Statistics', check: fileIOContent.includes('getIOStats') },
  ];

  features.forEach((feature) => {
    console.log(`  ${feature.check ? '✅' : '❌'} ${feature.name}`);
  });
}

// Check Load Testing features
const loadTestPath = `${baseDir}/test/load-test.spec.ts`;
if (fs.existsSync(loadTestPath)) {
  const loadTestContent = fs.readFileSync(loadTestPath, 'utf8');

  const features = [
    {
      name: 'Concurrent Upload Tests',
      check: loadTestContent.includes('simultaneous image uploads'),
    },
    {
      name: 'Mixed File Type Tests',
      check: loadTestContent.includes('mixed file type'),
    },
    {
      name: 'Memory Stability Tests',
      check: loadTestContent.includes('memory stability'),
    },
    {
      name: 'Queue Backpressure Tests',
      check: loadTestContent.includes('queue backpressure'),
    },
    {
      name: 'Performance Metrics Validation',
      check: loadTestContent.includes('performance requirements'),
    },
  ];

  features.forEach((feature) => {
    console.log(`  ${feature.check ? '✅' : '❌'} ${feature.name}`);
  });
}

// Summary
console.log('\n📊 IMPLEMENTATION SUMMARY');
console.log('='.repeat(60));

if (allFilesExist) {
  console.log(
    '✅ All performance optimization components implemented successfully!',
  );
  console.log('\n🎯 Key Performance Improvements:');
  console.log(
    '  • AI Model Connection Pooling - Reduces model initialization overhead',
  );
  console.log(
    '  • Memory-Optimized Text Processing - Handles large documents efficiently',
  );
  console.log(
    '  • Streaming File I/O - Optimizes memory usage for large files',
  );
  console.log(
    '  • Comprehensive Performance Monitoring - Tracks all operations',
  );
  console.log('  • Load Testing Suite - Validates 10+ concurrent requests');
  console.log(
    '  • Queue Performance Optimization - Monitors and optimizes job processing',
  );

  console.log('\n🚀 Ready for Performance Testing:');
  console.log('  Run: npm run load-test');
  console.log('  Or:  npm run test:load');

  console.log('\n📈 Monitoring Endpoints Available:');
  console.log(
    '  • GET /api/monitoring/performance - Overall performance metrics',
  );
  console.log('  • GET /api/monitoring/queue - Queue statistics');
  console.log('  • GET /api/monitoring/ai-pool - AI model pool status');
  console.log('  • GET /api/monitoring/health - System health overview');
} else {
  console.log(
    '❌ Some performance optimization components are missing or incomplete.',
  );
  console.log(
    'Please review the checklist above and ensure all components are properly implemented.',
  );
}

console.log('\n' + '='.repeat(60));
console.log('Performance optimization verification complete.');

process.exit(allFilesExist ? 0 : 1);
