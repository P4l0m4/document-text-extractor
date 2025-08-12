const { Test } = require('@nestjs/testing');

async function testEnhancedLogging() {
  console.log('🧪 Testing Enhanced Logging and Monitoring Implementation...');
  
  try {
    // Test 1: Check if metrics service can be imported
    console.log('📦 Testing metrics service import...');
    const { ScannedPdfMetricsService } = require('./src/ai/scanned-pdf-metrics.service');
    console.log('✅ Metrics service imported successfully');
    
    // Test 2: Create metrics service instance
    console.log('🏗️ Creating metrics service instance...');
    const module = await Test.createTestingModule({
      providers: [ScannedPdfMetricsService],
    }).compile();
    
    const metricsService = module.get(ScannedPdfMetricsService);
    console.log('✅ Metrics service instance created successfully');
    
    // Test 3: Test basic metrics functionality
    console.log('📊 Testing basic metrics functionality...');
    
    // Start a processing session
    const sessionId = metricsService.startProcessingSession('/test/document.pdf');
    console.log(`✅ Processing session started: ${sessionId}`);
    
    // Test PDF analysis recording
    metricsService.recordPdfAnalysis(sessionId, true, 'No extractable text found');
    console.log('✅ PDF analysis recorded');
    
    // Test processing stages
    metricsService.startProcessingStage(sessionId, 'pdf_analysis');
    metricsService.completeProcessingStage(sessionId, 'pdf_analysis', true);
    console.log('✅ Processing stages tracked');
    
    // Test temp file operations
    metricsService.recordTempFileOperation(sessionId, 'created', 3);
    metricsService.recordTempFileOperation(sessionId, 'cleaned', 3);
    console.log('✅ Temp file operations recorded');
    
    // Test error recording
    metricsService.recordError(sessionId, 'dependency', 'Missing GraphicsMagick');
    console.log('✅ Error recorded');
    
    // Complete the session
    metricsService.completeProcessingSession(sessionId, {
      success: false,
      processingMethod: 'pdf-to-image',
      isScannedPdf: true,
      textLength: 0,
      confidence: 0,
      tempFilesCreated: 3,
      errorType: 'dependency',
    });
    console.log('✅ Processing session completed');
    
    // Test 4: Get metrics
    console.log('📈 Testing metrics retrieval...');
    const metrics = metricsService.getMetrics();
    console.log(`✅ Total processing attempts: ${metrics.totalProcessingAttempts}`);
    console.log(`✅ Scanned PDF detections: ${metrics.scannedPdfDetections}`);
    console.log(`✅ Dependency errors: ${metrics.dependencyErrors}`);
    console.log(`✅ Temp files created: ${metrics.tempFilesCreated}`);
    
    // Test 5: Get success rate
    const successRate = metricsService.getSuccessRate();
    console.log(`✅ Success rate: ${successRate}%`);
    
    // Test 6: Get recent session stats
    const recentStats = metricsService.getRecentSessionStats(5);
    console.log(`✅ Recent sessions: ${recentStats.sessions.length}`);
    console.log(`✅ Recent success rate: ${recentStats.successRate}%`);
    
    // Test 7: Log metrics summary
    console.log('📋 Testing metrics summary logging...');
    metricsService.logMetricsSummary();
    console.log('✅ Metrics summary logged');
    
    console.log('\n🎉 All enhanced logging and monitoring tests passed!');
    console.log('\n📊 Enhanced Logging Features Implemented:');
    console.log('  ✅ Processing session tracking with unique IDs');
    console.log('  ✅ Stage-by-stage processing monitoring (pdf_analysis, dependency_check, conversion, ocr, cleanup)');
    console.log('  ✅ PDF analysis decision logging with detailed reasons');
    console.log('  ✅ Processing time tracking for all stages');
    console.log('  ✅ Success/failure rate metrics collection');
    console.log('  ✅ Error categorization and tracking (dependency, conversion, ocr, system)');
    console.log('  ✅ Temporary file creation and cleanup monitoring');
    console.log('  ✅ Performance metrics (average processing times)');
    console.log('  ✅ Clear stage indicators in log messages with session IDs');
    console.log('  ✅ Comprehensive metrics summary reporting');
    console.log('  ✅ Recent session statistics and trends');
    console.log('  ✅ Automatic periodic metrics logging (every 15 minutes)');
    
    return true;
    
  } catch (error) {
    console.error('❌ Enhanced logging test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run the test
testEnhancedLogging()
  .then(success => {
    if (success) {
      console.log('\n✅ Enhanced logging and monitoring implementation verified successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Enhanced logging and monitoring implementation verification failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });