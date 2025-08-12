#!/usr/bin/env node

// Test PDF parsing to see what's wrong
console.log('Testing PDF parsing...');

try {
  // Test different import methods
  console.log('1. Testing require...');
  const pdfParse1 = require('pdf-parse');
  console.log('   require result:', typeof pdfParse1);

  console.log('2. Testing dynamic import...');
  import('pdf-parse').then((module) => {
    console.log('   dynamic import result:', typeof module.default);
    console.log('   module keys:', Object.keys(module));
  });
} catch (error) {
  console.error('Error:', error.message);
}
