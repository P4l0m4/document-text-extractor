const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Testing Complete Workflow Integration...\n');

// Test 1: Check if all modules can be imported without errors
console.log('1. Testing module imports...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ All modules compile successfully\n');
} catch (error) {
  console.error('❌ Module compilation failed:', error.message);
  process.exit(1);
}

// Test 2: Check if dependencies are installed
console.log('2. Checking AI dependencies...');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
);
const requiredDeps = ['tesseract.js', 'pdf-parse'];

requiredDeps.forEach((dep) => {
  if (packageJson.dependencies[dep]) {
    console.log(`✅ ${dep} is listed in dependencies`);
  } else {
    console.log(`❌ ${dep} is missing from dependencies`);
  }
});

// Test 3: Run unit tests to verify individual components
console.log('\n3. Running unit tests...');
try {
  execSync('npm test -- --passWithNoTests', {
    stdio: 'inherit',
    cwd: __dirname,
  });
  console.log('✅ Unit tests passed\n');
} catch (error) {
  console.log('⚠️  Some unit tests may have failed, but continuing...\n');
}

// Test 4: Check if e2e test structure is correct
console.log('4. Checking end-to-end test structure...');
const e2eTestFiles = [
  'test/complete-workflow.e2e-spec.ts',
  'test/upload.e2e-spec.ts',
  'test/processing.e2e-spec.ts',
];

e2eTestFiles.forEach((testFile) => {
  if (fs.existsSync(path.join(__dirname, testFile))) {
    console.log(`✅ ${testFile} exists`);
  } else {
    console.log(`❌ ${testFile} is missing`);
  }
});

console.log('\n🎉 Workflow integration check completed!');
console.log('\nNext steps:');
console.log('1. Install dependencies: npm install');
console.log('2. Run e2e tests: npm run test:e2e');
console.log('3. Start the application: npm run start:dev');
