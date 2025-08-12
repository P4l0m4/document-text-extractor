#!/usr/bin/env node

/**
 * Diagnose specific startup errors and provide solutions
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnosing startup errors...');

// Common error patterns and their solutions
const errorPatterns = [
  {
    pattern: /Cannot resolve dependency.*PerformanceMonitorService/,
    solution: 'Service naming conflict. Make sure to use ScannedPdfPerformanceMonitorService in AI module.'
  },
  {
    pattern: /Module not found.*performance-monitor/,
    solution: 'Import path issue. Check that the performance monitor service file exists and is properly imported.'
  },
  {
    pattern: /Cannot find module.*@nestjs/,
    solution: 'Missing NestJS dependencies. Run: npm install @nestjs/common @nestjs/core @nestjs/config'
  },
  {
    pattern: /Cannot find module.*tesseract/,
    solution: 'Missing Tesseract.js. Run: npm install tesseract.js'
  },
  {
    pattern: /Cannot find module.*pdf-parse/,
    solution: 'Missing PDF parsing library. Run: npm install pdf-parse'
  },
  {
    pattern: /Circular dependency detected/,
    solution: 'Circular dependency issue. Check import statements and remove circular references.'
  },
  {
    pattern: /ENOENT.*uploads/,
    solution: 'Uploads directory missing. Create it with: mkdir uploads'
  },
  {
    pattern: /Port.*already in use/,
    solution: 'Port 3000 is busy. Either stop the other process or change PORT in .env file.'
  }
];

// Read the last startup log if available
const logFile = 'startup.log';
if (fs.existsSync(logFile)) {
  const logContent = fs.readFileSync(logFile, 'utf8');
  
  console.log('Analyzing startup log...');
  
  let foundSolution = false;
  errorPatterns.forEach(({ pattern, solution }) => {
    if (pattern.test(logContent)) {
      console.log('\n🎯 Found matching error pattern!');
      console.log('💡 Solution:', solution);
      foundSolution = true;
    }
  });
  
  if (!foundSolution) {
    console.log('\n❓ No matching error pattern found.');
    console.log('Please check the full error message and consult the troubleshooting guide.');
  }
} else {
  console.log('No startup log found. Run the application first to generate error logs.');
}

console.log('\n📋 General troubleshooting steps:');
console.log('1. npm install');
console.log('2. npm run build');
console.log('3. Check for TypeScript compilation errors');
console.log('4. Verify all services are properly registered in modules');
console.log('5. Check for circular dependencies');
