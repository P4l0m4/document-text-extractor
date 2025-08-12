// Simple test script to verify dependency detection service
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testDependencyDetection() {
  console.log('Testing dependency detection...');
  
  try {
    // Test GraphicsMagick
    console.log('\n=== Testing GraphicsMagick ===');
    try {
      const { stdout } = await execAsync('gm version');
      const versionMatch = stdout.match(/GraphicsMagick\s+([\d.]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      console.log(`✅ GraphicsMagick found: version ${version}`);
    } catch (error) {
      console.log(`❌ GraphicsMagick not found: ${error.message}`);
    }

    // Test ImageMagick
    console.log('\n=== Testing ImageMagick ===');
    try {
      const { stdout } = await execAsync('convert -version');
      const versionMatch = stdout.match(/ImageMagick\s+([\d.-]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      console.log(`✅ ImageMagick found: version ${version}`);
    } catch (error) {
      console.log(`❌ ImageMagick not found: ${error.message}`);
    }

    // Test pdf2pic
    console.log('\n=== Testing pdf2pic ===');
    try {
      const pdf2pic = require('pdf2pic');
      if (typeof pdf2pic.fromPath === 'function') {
        console.log('✅ pdf2pic npm package found and functional');
      } else {
        console.log('❌ pdf2pic module loaded but fromPath function not available');
      }
    } catch (error) {
      console.log(`❌ pdf2pic not found: ${error.message}`);
    }

    console.log('\n=== Platform Information ===');
    console.log(`Platform: ${process.platform}`);
    console.log(`Architecture: ${process.arch}`);
    console.log(`Node version: ${process.version}`);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDependencyDetection();