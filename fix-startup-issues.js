#!/usr/bin/env node

/**
 * Automatic Fix Script for Common Startup Issues
 * This script automatically fixes the most common startup problems
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing common startup issues...\n');

function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  } catch (error) {
    return null;
  }
}

function writeFile(filePath, content) {
  try {
    fs.writeFileSync(path.join(__dirname, filePath), content, 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ Error writing ${filePath}:`, error.message);
    return false;
  }
}

// Fix 1: Ensure .env file exists with basic configuration
console.log('1. Checking .env file...');
const envPath = '.env';
if (!fs.existsSync(path.join(__dirname, envPath))) {
  const envContent = `# Document Processing API Configuration
NODE_ENV=development
PORT=3000

# Temp directory for file processing
TEMP_DIR=./uploads

# Performance optimization settings
MEMORY_ENABLE_GC=true
MEMORY_GC_THRESHOLD_MB=256
MEMORY_ENABLE_PRESSURE_DETECTION=true
MEMORY_PRESSURE_THRESHOLD_MB=512
MEMORY_ENABLE_BUFFER_OPTIMIZATION=true
MEMORY_MAX_BUFFER_SIZE_MB=50

# Performance monitoring thresholds
PERF_MEMORY_WARNING_MB=512
PERF_MEMORY_CRITICAL_MB=1024
PERF_PROCESSING_WARNING_MS=15000
PERF_PROCESSING_CRITICAL_MS=30000
PERF_TEMP_FILES_WARNING=50
PERF_TEMP_FILES_CRITICAL=100

# Temp file management
TEMP_FILE_MAX_COUNT=100
TEMP_FILE_MAX_AGE_MS=3600000
TEMP_FILE_MAX_SIZE_MB=500
TEMP_FILE_CLEANUP_INTERVAL_MS=300000
TEMP_FILE_BATCH_CLEANUP_SIZE=10

# PDF conversion settings
PDF_CONVERSION_ENABLED=true
PDF_CONVERSION_DPI=200
PDF_CONVERSION_FORMAT=png
PDF_CONVERSION_WIDTH=2000
PDF_CONVERSION_HEIGHT=2000
PDF_CONVERSION_MAX_PAGES=1
PDF_CONVERSION_TIMEOUT=30000
PDF_CONVERSION_MAX_CONCURRENT=3
`;

  if (writeFile(envPath, envContent)) {
    console.log('✅ Created .env file with default configuration');
  }
} else {
  console.log('✅ .env file already exists');
}

// Fix 2: Create uploads directory if it doesn't exist
console.log('\n2. Checking uploads directory...');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
  } catch (error) {
    console.log('❌ Failed to create uploads directory:', error.message);
  }
} else {
  console.log('✅ Uploads directory already exists');
}

// Fix 3: Ensure package.json has correct scripts
console.log('\n3. Checking package.json scripts...');
const packageJsonContent = readFile('package.json');
if (packageJsonContent) {
  try {
    const packageJson = JSON.parse(packageJsonContent);
    let modified = false;

    // Ensure essential scripts exist
    const requiredScripts = {
      'start': 'nest start',
      'start:dev': 'nest start --watch',
      'start:debug': 'nest start --debug --watch',
      'start:prod': 'node dist/main',
      'build': 'nest build'
    };

    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    Object.entries(requiredScripts).forEach(([script, command]) => {
      if (!packageJson.scripts[script]) {
        packageJson.scripts[script] = command;
        modified = true;
      }
    });

    if (modified) {
      if (writeFile('package.json', JSON.stringify(packageJson, null, 2))) {
        console.log('✅ Updated package.json scripts');
      }
    } else {
      console.log('✅ Package.json scripts are correct');
    }
  } catch (error) {
    console.log('❌ Error parsing package.json:', error.message);
  }
} else {
  console.log('❌ package.json not found');
}

// Fix 4: Create a simple startup test script
console.log('\n4. Creating startup test script...');
const startupTestContent = `#!/usr/bin/env node

/**
 * Simple startup test to verify the application can start
 */

const { spawn } = require('child_process');

console.log('🧪 Testing application startup...');

const child = spawn('npm', ['run', 'start:dev'], {
  stdio: 'pipe',
  shell: true
});

let output = '';
let hasError = false;

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log(text);
  
  if (text.includes('Application is running on')) {
    console.log('✅ Application started successfully!');
    child.kill();
    process.exit(0);
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  console.error(text);
  hasError = true;
});

child.on('close', (code) => {
  if (code !== 0 && hasError) {
    console.log('❌ Application failed to start');
    console.log('Check the error messages above for details');
    process.exit(1);
  }
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Startup test timed out');
  child.kill();
  process.exit(1);
}, 30000);
`;

if (writeFile('test-startup.js', startupTestContent)) {
  console.log('✅ Created startup test script');
}

// Fix 5: Create a minimal health check endpoint test
console.log('\n5. Creating health check test...');
const healthCheckTestContent = `#!/usr/bin/env node

/**
 * Test the health endpoint to verify the API is working
 */

const http = require('http');

function testHealthEndpoint() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.status === 'ok') {
          console.log('✅ Health check passed!');
          console.log('📊 Server info:', {
            uptime: response.uptime,
            memory: response.system.memory,
            environment: response.api.environment
          });
        } else {
          console.log('❌ Health check failed - unexpected response');
        }
      } catch (error) {
        console.log('❌ Health check failed - invalid JSON response');
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ Health check failed:', error.message);
    console.log('Make sure the server is running on port 3000');
  });

  req.on('timeout', () => {
    console.log('❌ Health check timed out');
    req.destroy();
  });

  req.end();
}

console.log('🏥 Testing health endpoint...');
testHealthEndpoint();
`;

if (writeFile('test-health.js', healthCheckTestContent)) {
  console.log('✅ Created health check test script');
}

// Fix 6: Create a comprehensive error diagnosis script
console.log('\n6. Creating error diagnosis script...');
const diagnosisContent = `#!/usr/bin/env node

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
      console.log('\\n🎯 Found matching error pattern!');
      console.log('💡 Solution:', solution);
      foundSolution = true;
    }
  });
  
  if (!foundSolution) {
    console.log('\\n❓ No matching error pattern found.');
    console.log('Please check the full error message and consult the troubleshooting guide.');
  }
} else {
  console.log('No startup log found. Run the application first to generate error logs.');
}

console.log('\\n📋 General troubleshooting steps:');
console.log('1. npm install');
console.log('2. npm run build');
console.log('3. Check for TypeScript compilation errors');
console.log('4. Verify all services are properly registered in modules');
console.log('5. Check for circular dependencies');
`;

if (writeFile('diagnose-errors.js', diagnosisContent)) {
  console.log('✅ Created error diagnosis script');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('🎉 STARTUP FIXES COMPLETED');
console.log('='.repeat(50));

console.log('\n✅ Created/verified:');
console.log('   • .env file with default configuration');
console.log('   • uploads directory');
console.log('   • package.json scripts');
console.log('   • startup test script (test-startup.js)');
console.log('   • health check test (test-health.js)');
console.log('   • error diagnosis script (diagnose-errors.js)');

console.log('\n🚀 Next steps:');
console.log('1. Run: npm install');
console.log('2. Run: npm run build');
console.log('3. Run: npm run start:dev');
console.log('4. If errors occur, run: node diagnose-errors.js');
console.log('5. Test health endpoint: node test-health.js');

console.log('\n💡 Troubleshooting tools:');
console.log('   • node troubleshoot-startup.js  - Comprehensive system check');
console.log('   • node test-startup.js          - Test application startup');
console.log('   • node test-health.js           - Test health endpoint');
console.log('   • node diagnose-errors.js       - Diagnose specific errors');

console.log('\n🎯 The most common issues have been addressed!');
console.log('If you still encounter errors, they will likely be more specific');
console.log('and easier to resolve with the diagnostic tools provided.');