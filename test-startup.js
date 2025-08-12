#!/usr/bin/env node

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
