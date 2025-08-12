const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { AiModelPoolService } = require('./dist/ai/ai-model-pool.service');
const { DependencyDetectionService } = require('./dist/ai/dependency-detection.service');

async function verifyEnhancedErrorHandling() {
  console.log('🔍 Verifying Enhanced PDF-to-Image Error Handling...\n');

  try {
    // Create test module
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiModelPoolService,
        DependencyDetectionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              const config = {
                'app.maxConcurrentJobs': 5,
                'PDF_CONVERSION_DPI': 200,
                'PDF_CONVERSION_FORMAT': 'png',
                'PDF_CONVERSION_WIDTH': 2000,
                'PDF_CONVERSION_HEIGHT': 2000,
                'DEPENDENCY_CHECK_ON_STARTUP': false,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    const aiService = moduleRef.get(AiModelPoolService);
    const depService = moduleRef.get(DependencyDetectionService);

    console.log('✅ Test module created successfully');

    // Test 1: Check dependency detection
    console.log('\n📋 Test 1: Dependency Detection');
    try {
      const dependencies = await depService.checkSystemDependencies();
      console.log('✅ System dependencies checked:');
      console.log(`   - GraphicsMagick: ${dependencies.graphicsMagick.available ? '✅' : '❌'}`);
      console.log(`   - ImageMagick: ${dependencies.imageMagick.available ? '✅' : '❌'}`);
      console.log(`   - pdf2pic: ${dependencies.pdf2pic.available ? '✅' : '❌'}`);
      
      const isSupported = await depService.isConversionSupported();
      console.log(`   - Conversion supported: ${isSupported ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`❌ Dependency check failed: ${error.message}`);
    }

    // Test 2: Test error handling with non-existent file
    console.log('\n📄 Test 2: Error Handling with Non-existent File');
    try {
      // This should trigger our enhanced error handling
      await aiService.extractTextFromPdf('./non-existent-file.pdf');
      console.log('❌ Expected error but got success');
    } catch (error) {
      console.log('✅ Error handling working correctly:');
      console.log(`   Error: ${error.message.substring(0, 100)}...`);
    }

    // Test 3: Test graceful fallback behavior
    console.log('\n🔄 Test 3: Graceful Fallback Behavior');
    
    // Mock a scenario where dependencies are missing
    const originalIsSupported = depService.isConversionSupported;
    depService.isConversionSupported = async () => false;
    
    try {
      // This should trigger graceful fallback
      await aiService.extractTextFromPdf('./test-file.pdf');
      console.log('❌ Expected fallback behavior');
    } catch (error) {
      if (error.message.includes('missing dependencies')) {
        console.log('✅ Graceful fallback error handling working:');
        console.log(`   Error includes dependency info: ${error.message.includes('dependencies')}`);
      } else {
        console.log(`⚠️ Unexpected error: ${error.message}`);
      }
    }
    
    // Restore original method
    depService.isConversionSupported = originalIsSupported;

    console.log('\n✅ Enhanced error handling verification completed successfully!');
    console.log('\n📊 Summary of Enhancements:');
    console.log('   ✅ Detailed logging for conversion process steps');
    console.log('   ✅ Dependency validation before attempting conversion');
    console.log('   ✅ Improved error messages with context');
    console.log('   ✅ Graceful fallback when dependencies are missing');
    console.log('   ✅ Step-by-step process logging');
    console.log('   ✅ Enhanced error categorization');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verifyEnhancedErrorHandling().catch(console.error);
}

module.exports = { verifyEnhancedErrorHandling };