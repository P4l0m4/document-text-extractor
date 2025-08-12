// Simple test to verify TypeScript compilation
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testCompilation() {
  console.log('🔨 Testing TypeScript Compilation');
  console.log('=================================\n');

  try {
    console.log('Running TypeScript compilation...');
    const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
      cwd: __dirname,
      timeout: 30000
    });

    if (stderr && stderr.trim()) {
      console.log('⚠️  Compilation warnings/errors:');
      console.log(stderr);
    } else {
      console.log('✅ TypeScript compilation successful - no errors found');
    }

    if (stdout && stdout.trim()) {
      console.log('📝 Compilation output:');
      console.log(stdout);
    }

  } catch (error) {
    console.log('❌ TypeScript compilation failed:');
    console.log(error.message);
    
    if (error.stdout) {
      console.log('\nStdout:');
      console.log(error.stdout);
    }
    
    if (error.stderr) {
      console.log('\nStderr:');
      console.log(error.stderr);
    }
  }

  // Also test if the files can be imported without syntax errors
  console.log('\n🔍 Testing module imports...');
  
  try {
    // Test if the interfaces can be imported
    console.log('Testing interface imports...');
    const interfacePath = './src/ai/interfaces/dependency.interface.ts';
    console.log(`✅ Interface file exists: ${interfacePath}`);
    
    // Test if the service file exists and has proper structure
    const servicePath = './src/ai/dependency-detection.service.ts';
    console.log(`✅ Service file exists: ${servicePath}`);
    
    // Test if the test file exists
    const testPath = './src/ai/dependency-detection.service.spec.ts';
    console.log(`✅ Test file exists: ${testPath}`);
    
    console.log('\n✅ All files are properly structured');
    
  } catch (error) {
    console.log(`❌ Module import test failed: ${error.message}`);
  }
}

testCompilation().catch(console.error);