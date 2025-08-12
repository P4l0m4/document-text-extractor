const fs = require('fs');
const path = require('path');

/**
 * Comprehensive test script for PDF-to-image conversion concurrency management
 * This script tests the queue system, concurrent processing limits, and worker pool integration
 */

const API_BASE_URL = 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  maxConcurrentRequests: 10,
  testDuration: 30000, // 30 seconds
  requestInterval: 500, // 500ms between requests
  expectedMaxConcurrent: 3, // Based on PDF_CONVERSION_MAX_CONCURRENT
};

// Test results tracking
const testResults = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  timeouts: 0,
  concurrentPeaks: [],
  averageProcessingTime: 0,
  errors: [],
  queueMetrics: {
    maxQueueSize: 0,
    averageQueueTime: 0,
    queueTimeouts: 0,
  }
};

// Active request tracking
const activeRequests = new Map();
let currentConcurrentCount = 0;
let maxObservedConcurrent = 0;

/**
 * Create a test PDF file for processing
 */
function createTestPdf() {
  const testPdfPath = path.join(__dirname, 'test-concurrency.pdf');
  
  // Create a simple PDF content (this would be a real PDF in practice)
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF for concurrency) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`;

  fs.writeFileSync(testPdfPath, pdfContent);
  return testPdfPath;
}

/**
 * Make a PDF processing request
 */
async function makeProcessingRequest(requestId, pdfPath) {
  const startTime = Date.now();
  
  try {
    // Track concurrent request start
    activeRequests.set(requestId, startTime);
    currentConcurrentCount++;
    maxObservedConcurrent = Math.max(maxObservedConcurrent, currentConcurrentCount);
    
    console.log(`🚀 [${requestId}] Starting request (concurrent: ${currentConcurrentCount})`);
    
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'test-concurrency.pdf');

    const response = await fetch(`${API_BASE_URL}/documents/process`, {
      method: 'POST',
      body: formData,
      timeout: 120000, // 2 minutes timeout
    });

    const processingTime = Date.now() - startTime;
    
    if (response.ok) {
      const result = await response.json();
      testResults.successfulRequests++;
      testResults.averageProcessingTime = 
        (testResults.averageProcessingTime * (testResults.successfulRequests - 1) + processingTime) / 
        testResults.successfulRequests;
      
      console.log(`✅ [${requestId}] Success in ${processingTime}ms (text length: ${result.text?.length || 0})`);
      
      // Log queue metrics if available in response
      if (result.metadata?.queuePosition) {
        testResults.queueMetrics.maxQueueSize = Math.max(
          testResults.queueMetrics.maxQueueSize, 
          result.metadata.queuePosition
        );
      }
      
      return { success: true, processingTime, result };
    } else {
      const errorText = await response.text();
      testResults.failedRequests++;
      testResults.errors.push({
        requestId,
        status: response.status,
        error: errorText,
        processingTime
      });
      
      console.log(`❌ [${requestId}] Failed with status ${response.status}: ${errorText}`);
      return { success: false, processingTime, error: errorText };
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      testResults.timeouts++;
      console.log(`⏰ [${requestId}] Timeout after ${processingTime}ms`);
    } else {
      testResults.failedRequests++;
      testResults.errors.push({
        requestId,
        error: error.message,
        processingTime
      });
      console.log(`💥 [${requestId}] Error: ${error.message}`);
    }
    
    return { success: false, processingTime, error: error.message };
  } finally {
    // Track concurrent request end
    activeRequests.delete(requestId);
    currentConcurrentCount--;
    
    console.log(`📊 [${requestId}] Finished (concurrent: ${currentConcurrentCount})`);
  }
}

/**
 * Monitor concurrent processing metrics
 */
function startConcurrencyMonitoring() {
  const monitoringInterval = setInterval(() => {
    testResults.concurrentPeaks.push({
      timestamp: Date.now(),
      concurrent: currentConcurrentCount,
      queueSize: Math.max(0, testResults.totalRequests - testResults.successfulRequests - testResults.failedRequests)
    });
    
    if (currentConcurrentCount > 0) {
      console.log(`📈 Monitoring: ${currentConcurrentCount} concurrent, max observed: ${maxObservedConcurrent}`);
    }
  }, 1000);
  
  return monitoringInterval;
}

/**
 * Run the concurrency load test
 */
async function runConcurrencyTest() {
  console.log('🧪 Starting PDF-to-image concurrency load test...');
  console.log(`📋 Configuration: ${TEST_CONFIG.maxConcurrentRequests} max requests, ${TEST_CONFIG.testDuration}ms duration`);
  console.log(`⚙️ Expected max concurrent PDF conversions: ${TEST_CONFIG.expectedMaxConcurrent}`);
  
  // Create test PDF
  const testPdfPath = createTestPdf();
  console.log(`📄 Created test PDF: ${testPdfPath}`);
  
  // Start monitoring
  const monitoringInterval = startConcurrencyMonitoring();
  
  // Track test start time
  const testStartTime = Date.now();
  const testEndTime = testStartTime + TEST_CONFIG.testDuration;
  
  // Launch concurrent requests
  const requestPromises = [];
  let requestCounter = 0;
  
  const requestInterval = setInterval(() => {
    if (Date.now() >= testEndTime || requestCounter >= TEST_CONFIG.maxConcurrentRequests) {
      clearInterval(requestInterval);
      return;
    }
    
    const requestId = `req-${++requestCounter}`;
    testResults.totalRequests++;
    
    const requestPromise = makeProcessingRequest(requestId, testPdfPath);
    requestPromises.push(requestPromise);
    
  }, TEST_CONFIG.requestInterval);
  
  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.testDuration));
  
  // Stop monitoring
  clearInterval(monitoringInterval);
  
  // Wait for all remaining requests to complete (with timeout)
  console.log('⏳ Waiting for remaining requests to complete...');
  const remainingTimeout = setTimeout(() => {
    console.log('⚠️ Timeout waiting for remaining requests');
  }, 60000); // 1 minute timeout for cleanup
  
  try {
    await Promise.allSettled(requestPromises);
  } finally {
    clearTimeout(remainingTimeout);
  }
  
  // Cleanup test file
  try {
    fs.unlinkSync(testPdfPath);
    console.log('🧹 Cleaned up test PDF file');
  } catch (error) {
    console.warn('⚠️ Failed to cleanup test PDF:', error.message);
  }
  
  // Generate test report
  generateTestReport();
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  const totalTime = Date.now();
  
  console.log('\n📊 CONCURRENCY TEST REPORT');
  console.log('=' .repeat(50));
  
  // Request statistics
  console.log('\n📈 Request Statistics:');
  console.log(`  Total requests: ${testResults.totalRequests}`);
  console.log(`  Successful: ${testResults.successfulRequests} (${((testResults.successfulRequests / testResults.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${testResults.failedRequests} (${((testResults.failedRequests / testResults.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  Timeouts: ${testResults.timeouts} (${((testResults.timeouts / testResults.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  Average processing time: ${testResults.averageProcessingTime.toFixed(0)}ms`);
  
  // Concurrency statistics
  console.log('\n🔄 Concurrency Statistics:');
  console.log(`  Max observed concurrent: ${maxObservedConcurrent}`);
  console.log(`  Expected max concurrent: ${TEST_CONFIG.expectedMaxConcurrent}`);
  console.log(`  Concurrency limit respected: ${maxObservedConcurrent <= TEST_CONFIG.expectedMaxConcurrent ? '✅ YES' : '❌ NO'}`);
  
  // Queue statistics
  console.log('\n📋 Queue Statistics:');
  console.log(`  Max queue size observed: ${testResults.queueMetrics.maxQueueSize}`);
  console.log(`  Queue timeouts: ${testResults.queueMetrics.queueTimeouts}`);
  
  // Performance analysis
  console.log('\n⚡ Performance Analysis:');
  const successRate = (testResults.successfulRequests / testResults.totalRequests) * 100;
  const throughput = testResults.successfulRequests / (TEST_CONFIG.testDuration / 1000);
  
  console.log(`  Success rate: ${successRate.toFixed(1)}%`);
  console.log(`  Throughput: ${throughput.toFixed(2)} requests/second`);
  
  // Concurrency peaks analysis
  if (testResults.concurrentPeaks.length > 0) {
    const avgConcurrent = testResults.concurrentPeaks.reduce((sum, peak) => sum + peak.concurrent, 0) / testResults.concurrentPeaks.length;
    console.log(`  Average concurrent: ${avgConcurrent.toFixed(1)}`);
  }
  
  // Error analysis
  if (testResults.errors.length > 0) {
    console.log('\n❌ Error Analysis:');
    const errorTypes = {};
    testResults.errors.forEach(error => {
      const type = error.status ? `HTTP ${error.status}` : 'Network/Timeout';
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });
    
    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} occurrences`);
    });
    
    // Show first few errors for debugging
    console.log('\n🔍 Sample Errors:');
    testResults.errors.slice(0, 3).forEach((error, index) => {
      console.log(`  ${index + 1}. [${error.requestId}] ${error.error}`);
    });
  }
  
  // Test verdict
  console.log('\n🏁 Test Verdict:');
  const passed = successRate >= 80 && maxObservedConcurrent <= TEST_CONFIG.expectedMaxConcurrent;
  console.log(`  Overall result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (!passed) {
    console.log('\n💡 Recommendations:');
    if (successRate < 80) {
      console.log('  - Success rate is below 80%, check error handling and system resources');
    }
    if (maxObservedConcurrent > TEST_CONFIG.expectedMaxConcurrent) {
      console.log('  - Concurrency limit was exceeded, verify PDF_CONVERSION_MAX_CONCURRENT configuration');
    }
  }
  
  console.log('\n' + '='.repeat(50));
}

/**
 * Test concurrency statistics endpoint
 */
async function testConcurrencyStatsEndpoint() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/monitoring/concurrency-stats`);
    if (response.ok) {
      const stats = await response.json();
      console.log('📊 Current concurrency stats:', stats);
      return stats;
    } else {
      console.log('⚠️ Concurrency stats endpoint not available');
      return null;
    }
  } catch (error) {
    console.log('⚠️ Failed to fetch concurrency stats:', error.message);
    return null;
  }
}

/**
 * Test queue information endpoint
 */
async function testQueueInfoEndpoint() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/monitoring/queue-info`);
    if (response.ok) {
      const queueInfo = await response.json();
      console.log('📋 Current queue info:', queueInfo);
      return queueInfo;
    } else {
      console.log('⚠️ Queue info endpoint not available');
      return null;
    }
  } catch (error) {
    console.log('⚠️ Failed to fetch queue info:', error.message);
    return null;
  }
}

/**
 * Test specific concurrency scenarios
 */
async function runSpecificConcurrencyTests() {
  console.log('\n🎯 Running specific concurrency scenario tests...');
  
  // Test 0: Check initial system state
  console.log('\n📊 Test 0: Initial System State');
  const initialStats = await testConcurrencyStatsEndpoint();
  const initialQueue = await testQueueInfoEndpoint();
  
  // Test 1: Burst load test
  console.log('\n📈 Test 1: Burst Load (10 simultaneous requests)');
  const burstStartTime = Date.now();
  const burstPromises = [];
  
  for (let i = 0; i < 10; i++) {
    burstPromises.push(makeProcessingRequest(`burst-${i}`, createTestPdf()));
  }
  
  // Monitor concurrency during burst
  const burstMonitoring = setInterval(async () => {
    await testConcurrencyStatsEndpoint();
  }, 1000);
  
  const burstResults = await Promise.allSettled(burstPromises);
  clearInterval(burstMonitoring);
  
  const burstSuccesses = burstResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const burstTime = Date.now() - burstStartTime;
  console.log(`📊 Burst test: ${burstSuccesses}/10 successful in ${burstTime}ms`);
  
  // Wait for system to settle
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Queue overflow test
  console.log('\n📋 Test 2: Queue Overflow (20 requests with small interval)');
  const overflowStartTime = Date.now();
  const overflowPromises = [];
  
  for (let i = 0; i < 20; i++) {
    overflowPromises.push(makeProcessingRequest(`overflow-${i}`, createTestPdf()));
    await new Promise(resolve => setTimeout(resolve, 50)); // 50ms interval
    
    // Check queue status every 5 requests
    if (i % 5 === 0) {
      await testQueueInfoEndpoint();
    }
  }
  
  const overflowResults = await Promise.allSettled(overflowPromises);
  const overflowSuccesses = overflowResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const overflowTime = Date.now() - overflowStartTime;
  console.log(`📊 Overflow test: ${overflowSuccesses}/20 successful in ${overflowTime}ms`);
  
  // Wait for system to settle
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Sustained load test
  console.log('\n⏱️ Test 3: Sustained Load (15 requests over 30 seconds)');
  const sustainedStartTime = Date.now();
  const sustainedPromises = [];
  
  const sustainedInterval = setInterval(async () => {
    if (sustainedPromises.length >= 15) {
      clearInterval(sustainedInterval);
      return;
    }
    
    const requestId = `sustained-${sustainedPromises.length + 1}`;
    sustainedPromises.push(makeProcessingRequest(requestId, createTestPdf()));
    
    // Monitor system every few requests
    if (sustainedPromises.length % 3 === 0) {
      await testConcurrencyStatsEndpoint();
    }
  }, 2000); // Every 2 seconds
  
  // Wait for all sustained requests to complete
  await new Promise(resolve => {
    const checkCompletion = setInterval(() => {
      if (sustainedPromises.length >= 15) {
        clearInterval(checkCompletion);
        resolve();
      }
    }, 500);
  });
  
  const sustainedResults = await Promise.allSettled(sustainedPromises);
  const sustainedSuccesses = sustainedResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const sustainedTime = Date.now() - sustainedStartTime;
  console.log(`📊 Sustained test: ${sustainedSuccesses}/15 successful in ${sustainedTime}ms`);
  
  // Test 4: Mixed workload test (PDFs + Images)
  console.log('\n🔀 Test 4: Mixed Workload (PDFs and Images)');
  const mixedStartTime = Date.now();
  const mixedPromises = [];
  
  // Create a simple test image
  const testImagePath = createTestImage();
  
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) {
      // PDF request
      mixedPromises.push(makeProcessingRequest(`mixed-pdf-${i}`, createTestPdf()));
    } else {
      // Image request
      mixedPromises.push(makeImageProcessingRequest(`mixed-img-${i}`, testImagePath));
    }
    
    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms interval
  }
  
  const mixedResults = await Promise.allSettled(mixedPromises);
  const mixedSuccesses = mixedResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const mixedTime = Date.now() - mixedStartTime;
  console.log(`📊 Mixed workload test: ${mixedSuccesses}/8 successful in ${mixedTime}ms`);
  
  // Cleanup test image
  try {
    fs.unlinkSync(testImagePath);
  } catch (error) {
    console.warn('⚠️ Failed to cleanup test image:', error.message);
  }
  
  // Final system state check
  console.log('\n📊 Final System State:');
  await testConcurrencyStatsEndpoint();
  await testQueueInfoEndpoint();
}

/**
 * Create a simple test image for mixed workload testing
 */
function createTestImage() {
  const testImagePath = path.join(__dirname, 'test-concurrency.png');
  
  // Create a simple PNG image (1x1 pixel black image)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc.
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, // image data
    0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, // checksum
    0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND chunk
    0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  fs.writeFileSync(testImagePath, pngData);
  return testImagePath;
}

/**
 * Make an image processing request for mixed workload testing
 */
async function makeImageProcessingRequest(requestId, imagePath) {
  const startTime = Date.now();
  
  try {
    console.log(`🖼️ [${requestId}] Starting image request`);
    
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    formData.append('file', blob, 'test-concurrency.png');

    const response = await fetch(`${API_BASE_URL}/documents/process`, {
      method: 'POST',
      body: formData,
      timeout: 60000, // 1 minute timeout for images
    });

    const processingTime = Date.now() - startTime;
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ [${requestId}] Image success in ${processingTime}ms`);
      return { success: true, processingTime, result };
    } else {
      const errorText = await response.text();
      console.log(`❌ [${requestId}] Image failed: ${errorText}`);
      return { success: false, processingTime, error: errorText };
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.log(`💥 [${requestId}] Image error: ${error.message}`);
    return { success: false, processingTime, error: error.message };
  }
}

// Main execution
async function main() {
  try {
    // Check if server is running
    try {
      const healthCheck = await fetch(`${API_BASE_URL}/health`);
      if (!healthCheck.ok) {
        throw new Error(`Server health check failed: ${healthCheck.status}`);
      }
      console.log('✅ Server is running and healthy');
    } catch (error) {
      console.error('❌ Server is not accessible:', error.message);
      console.log('💡 Make sure the document processing API is running on port 3000');
      process.exit(1);
    }
    
    // Run main concurrency test
    await runConcurrencyTest();
    
    // Run specific scenario tests
    await runSpecificConcurrencyTests();
    
    console.log('\n🎉 All concurrency tests completed!');
    
  } catch (error) {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Test terminated');
  process.exit(0);
});

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runConcurrencyTest,
  runSpecificConcurrencyTests,
  TEST_CONFIG,
  testResults
};