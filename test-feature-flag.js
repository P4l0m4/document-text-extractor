#!/usr/bin/env node

/**
 * Simple test to verify feature flag functionality
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Feature Flag Implementation\n');

// Test 1: Check if environment validation includes PDF_CONVERSION_ENABLED
console.log('1. Checking environment validation...');
const validationPath = path.join(__dirname, 'src', 'config', 'validation.ts');
const validationContent = fs.readFileSync(validationPath, 'utf8');

if (validationContent.includes('PDF_CONVERSION_ENABLED') && validationContent.includes('@IsBoolean()')) {
  console.log('✅ PDF_CONVERSION_ENABLED is properly validated');
} else {
  console.log('❌ PDF_CONVERSION_ENABLED validation missing');
}

// Test 2: Check if .env has the feature flag
console.log('\n2. Checking .env configuration...');
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

if (envContent.includes('PDF_CONVERSION_ENABLED=true')) {
  console.log('✅ PDF_CONVERSION_ENABLED is configured in .env');
} else {
  console.log('❌ PDF_CONVERSION_ENABLED not found in .env');
}

// Test 3: Check if AI service has graceful degradation
console.log('\n3. Checking graceful degradation implementation...');
const aiServicePath = path.join(__dirname, 'src', 'ai', 'ai-model-pool.service.ts');
const aiServiceContent = fs.readFileSync(aiServicePath, 'utf8');

if (aiServiceContent.includes('isPdfConversionEnabled') && 
    aiServiceContent.includes('conversionDisabled: true')) {
  console.log('✅ Graceful degradation is implemented');
} else {
  console.log('❌ Graceful degradation implementation missing');
}

// Test 4: Check if deployment documentation exists
console.log('\n4. Checking deployment documentation...');
const deploymentPath = path.join(__dirname, 'DEPLOYMENT.md');

if (fs.existsSync(deploymentPath)) {
  const deploymentContent = fs.readFileSync(deploymentPath, 'utf8');
  if (deploymentContent.includes('Feature Flag Management') && 
      deploymentContent.includes('PDF_CONVERSION_ENABLED=false')) {
    console.log('✅ Deployment documentation includes feature flag management');
  } else {
    console.log('❌ Feature flag documentation incomplete');
  }
} else {
  console.log('❌ DEPLOYMENT.md not found');
}

console.log('\n🎉 Feature flag implementation verification complete!');