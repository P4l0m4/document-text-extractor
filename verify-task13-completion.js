#!/usr/bin/env node

/**
 * Verification script for Task 13: Environment configuration and deployment preparation
 * 
 * This script verifies:
 * 1. Environment variable configuration for PDF conversion settings
 * 2. Feature flag for enabling/disabling PDF-to-image conversion
 * 3. Graceful degradation when feature is disabled
 * 4. Deployment documentation exists
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Task 13: Environment configuration and deployment preparation\n');

let allTestsPassed = true;
const results = [];

function logResult(test, passed, message) {
  const status = passed ? '✅' : '❌';
  const result = `${status} ${test}: ${message}`;
  console.log(result);
  results.push({ test, passed, message });
  if (!passed) allTestsPassed = false;
}

// Test 1: Check environment validation includes PDF conversion settings
console.log('📋 Test 1: Environment variable validation');
try {
  const validationPath = path.join(__dirname, 'src', 'config', 'validation.ts');
  const validationContent = fs.readFileSync(validationPath, 'utf8');
  
  const requiredFields = [
    'PDF_CONVERSION_ENABLED',
    'PDF_CONVERSION_DPI',
    'PDF_CONVERSION_FORMAT',
    'PDF_CONVERSION_WIDTH',
    'PDF_CONVERSION_HEIGHT',
    'PDF_CONVERSION_MAX_PAGES',
    'PDF_CONVERSION_TIMEOUT',
    'PDF_CONVERSION_MAX_CONCURRENT',
    'PDF_TEMP_DIR',
    'DEPENDENCY_CHECK_ON_STARTUP'
  ];
  
  const missingFields = requiredFields.filter(field => !validationContent.includes(field));
  
  if (missingFields.length === 0) {
    logResult('Environment validation', true, 'All PDF conversion environment variables are properly validated');
  } else {
    logResult('Environment validation', false, `Missing validation for: ${missingFields.join(', ')}`);
  }
  
  // Check for proper validation decorators
  const hasValidationDecorators = validationContent.includes('@IsBoolean()') && 
                                  validationContent.includes('@IsInt()') && 
                                  validationContent.includes('@IsIn([');
  
  logResult('Validation decorators', hasValidationDecorators, 
    hasValidationDecorators ? 'Proper validation decorators are used' : 'Missing validation decorators');
  
} catch (error) {
  logResult('Environment validation', false, `Error reading validation file: ${error.message}`);
}

// Test 2: Check .env file has proper documentation and settings
console.log('\n📋 Test 2: Environment file configuration');
try {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const hasDocumentation = envContent.includes('# PDF Conversion Configuration') &&
                          envContent.includes('# Enable/disable PDF-to-image conversion feature');
  
  logResult('Environment documentation', hasDocumentation, 
    hasDocumentation ? 'Environment file has proper documentation' : 'Missing documentation in .env file');
  
  const hasPdfSettings = envContent.includes('PDF_CONVERSION_ENABLED=true') &&
                        envContent.includes('PDF_CONVERSION_DPI=200');
  
  logResult('PDF conversion settings', hasPdfSettings, 
    hasPdfSettings ? 'PDF conversion settings are properly configured' : 'Missing PDF conversion settings');
  
} catch (error) {
  logResult('Environment file', false, `Error reading .env file: ${error.message}`);
}

// Test 3: Check deployment documentation exists
console.log('\n📋 Test 3: Deployment documentation');
try {
  const deploymentPath = path.join(__dirname, 'DEPLOYMENT.md');
  const deploymentContent = fs.readFileSync(deploymentPath, 'utf8');
  
  const hasSystemDependencies = deploymentContent.includes('## System Dependencies') &&
                               deploymentContent.includes('GraphicsMagick or ImageMagick');
  
  logResult('System dependencies documentation', hasSystemDependencies, 
    hasSystemDependencies ? 'System dependencies are documented' : 'Missing system dependencies documentation');
  
  const hasInstallationInstructions = deploymentContent.includes('### Windows') &&
                                     deploymentContent.includes('### macOS') &&
                                     deploymentContent.includes('### Linux');
  
  logResult('Installation instructions', hasInstallationInstructions, 
    hasInstallationInstructions ? 'Installation instructions for all platforms' : 'Missing platform-specific instructions');
  
  const hasFeatureFlagDocs = deploymentContent.includes('## Feature Flag Management') &&
                            deploymentContent.includes('PDF_CONVERSION_ENABLED=false');
  
  logResult('Feature flag documentation', hasFeatureFlagDocs, 
    hasFeatureFlagDocs ? 'Feature flag management is documented' : 'Missing feature flag documentation');
  
  const hasGracefulDegradation = deploymentContent.includes('Graceful Degradation') &&
                                deploymentContent.includes('When disabled, the API will:');
  
  logResult('Graceful degradation documentation', hasGracefulDegradation, 
    hasGracefulDegradation ? 'Graceful degradation behavior is documented' : 'Missing graceful degradation documentation');
  
} catch (error) {
  logResult('Deployment documentation', false, `Error reading DEPLOYMENT.md: ${error.message}`);
}

// Test 4: Check AI service has feature flag implementation
console.log('\n📋 Test 4: Feature flag implementation');
try {
  const aiServicePath = path.join(__dirname, 'src', 'ai', 'ai-model-pool.service.ts');
  const aiServiceContent = fs.readFileSync(aiServicePath, 'utf8');
  
  const hasFeatureFlagCheck = aiServiceContent.includes('isPdfConversionEnabled') &&
                             aiServiceContent.includes('pdfConversionConfigService.isEnabled()');
  
  logResult('Feature flag check', hasFeatureFlagCheck, 
    hasFeatureFlagCheck ? 'Feature flag check is implemented' : 'Missing feature flag check');
  
  const hasGracefulDegradationLogic = aiServiceContent.includes('PDF-to-image conversion is disabled') &&
                                     aiServiceContent.includes('ocrMethod: \'disabled\'') &&
                                     aiServiceContent.includes('conversionDisabled: true');
  
  logResult('Graceful degradation logic', hasGracefulDegradationLogic, 
    hasGracefulDegradationLogic ? 'Graceful degradation logic is implemented' : 'Missing graceful degradation logic');
  
  const hasStartupLogging = aiServiceContent.includes('PDF-to-image conversion feature:') &&
                           aiServiceContent.includes('PDF-to-image conversion is disabled');
  
  logResult('Startup logging', hasStartupLogging, 
    hasStartupLogging ? 'Feature status logging at startup' : 'Missing startup feature status logging');
  
} catch (error) {
  logResult('Feature flag implementation', false, `Error reading AI service file: ${error.message}`);
}

// Test 5: Check PDF conversion config service has isEnabled method
console.log('\n📋 Test 5: PDF conversion configuration service');
try {
  const configServicePath = path.join(__dirname, 'src', 'ai', 'pdf-conversion-config.service.ts');
  const configServiceContent = fs.readFileSync(configServicePath, 'utf8');
  
  const hasIsEnabledMethod = configServiceContent.includes('isEnabled(): boolean') &&
                            configServiceContent.includes('return this.config.enabled');
  
  logResult('isEnabled method', hasIsEnabledMethod, 
    hasIsEnabledMethod ? 'isEnabled method is implemented' : 'Missing isEnabled method');
  
  const hasEnabledConfig = configServiceContent.includes('enabled: this.configService.get<boolean>(\'PDF_CONVERSION_ENABLED\')');
  
  logResult('Enabled configuration', hasEnabledConfig, 
    hasEnabledConfig ? 'Enabled configuration is properly loaded' : 'Missing enabled configuration loading');
  
} catch (error) {
  logResult('PDF conversion config service', false, `Error reading config service file: ${error.message}`);
}

// Test 6: Check PDF conversion interface includes enabled field
console.log('\n📋 Test 6: PDF conversion interface');
try {
  const interfacePath = path.join(__dirname, 'src', 'ai', 'interfaces', 'pdf-conversion.interface.ts');
  const interfaceContent = fs.readFileSync(interfacePath, 'utf8');
  
  const hasEnabledField = interfaceContent.includes('enabled: boolean') &&
                         interfaceContent.includes('Whether PDF conversion is enabled');
  
  logResult('Enabled field in interface', hasEnabledField, 
    hasEnabledField ? 'Enabled field is defined in interface' : 'Missing enabled field in interface');
  
  const hasEnabledDefault = interfaceContent.includes('readonly ENABLED: boolean') &&
                           interfaceContent.includes('ENABLED: true');
  
  logResult('Enabled default value', hasEnabledDefault, 
    hasEnabledDefault ? 'Default enabled value is defined' : 'Missing default enabled value');
  
} catch (error) {
  logResult('PDF conversion interface', false, `Error reading interface file: ${error.message}`);
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 TASK 13 VERIFICATION SUMMARY');
console.log('='.repeat(80));

const passedTests = results.filter(r => r.passed).length;
const totalTests = results.length;

console.log(`\nTests passed: ${passedTests}/${totalTests}`);

if (allTestsPassed) {
  console.log('\n🎉 All tests passed! Task 13 implementation is complete.');
  console.log('\n✅ Environment configuration and deployment preparation:');
  console.log('   • Environment variable validation implemented');
  console.log('   • Feature flag for PDF-to-image conversion added');
  console.log('   • Graceful degradation when feature is disabled');
  console.log('   • Comprehensive deployment documentation created');
  console.log('   • System dependency installation instructions provided');
  console.log('   • Feature flag management documented');
} else {
  console.log('\n❌ Some tests failed. Please review the implementation.');
  console.log('\nFailed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`   • ${r.test}: ${r.message}`);
  });
}

console.log('\n' + '='.repeat(80));

process.exit(allTestsPassed ? 0 : 1);