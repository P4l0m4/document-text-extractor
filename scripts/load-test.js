#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const CONCURRENT_REQUESTS = 15;
const TEST_ROUNDS = 3;

// Test files (create simple test files)
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.png');
const TEST_PDF_PATH = path.join(__dirname, 'test-document.pdf');

// Performance tracking
const metrics = {
  uploads: [],
  processing: [],
  errors: [],
  startTime: null,
  endTime: null,
};

// Create test files if they don't exist
function createTestFiles() {
  console.log('Creating test files...');

  // Create a minimal PNG (1x1 pixel)
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    const pngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
      0xff, 0xff, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    fs.writeFileSync(TEST_IMAGE_PATH, pngData);
  }

  // Create a minimal PDF
  if (!fs.existsSync(TEST_PDF_PATH)) {
    const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT/F1 12 Tf 72 720 Td(Load Test Document)Tj ET
endstream endobj
xref 0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer<</Size 5/Root 1 0 R>>startxref 300 %%EOF`;
    fs.writeFileSync(TEST_PDF_PATH, pdfContent);
  }

  console.log('Test files created successfully');
}

// Upload a file
function uploadFile(filePath, requestId) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const form = new FormData();

    form.append('file', fs.createReadStream(filePath));
    form.append('generateSummary', 'true');

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/documents/upload',
      method: 'POST',
      headers: form.getHeaders(),
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const uploadTime = Date.now() - startTime;

        if (res.statusCode === 201) {
          try {
            const response = JSON.parse(data);
            resolve({
              requestId,
              taskId: response.taskId,
              uploadTime,
              success: true,
            });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          reject(
            new Error(`Upload failed with status ${res.statusCode}: ${data}`),
          );
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    form.pipe(req);
  });
}

// Check task status
function checkTaskStatus(taskId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/${taskId}/status`,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(
              new Error(`Failed to parse status response: ${error.message}`),
            );
          }
        } else {
          reject(
            new Error(
              `Status check failed with status ${res.statusCode}: ${data}`,
            ),
          );
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Status request failed: ${error.message}`));
    });

    req.end();
  });
}

// Wait for all tasks to complete
async function waitForCompletion(taskIds) {
  const maxWaitTime = 180000; // 3 minutes
  const checkInterval = 2000; // 2 seconds
  const startTime = Date.now();

  console.log(`Waiting for ${taskIds.length} tasks to complete...`);

  while (Date.now() - startTime < maxWaitTime) {
    const statusPromises = taskIds.map(async (taskId) => {
      try {
        const status = await checkTaskStatus(taskId);
        return { taskId, ...status };
      } catch (error) {
        return { taskId, status: 'error', error: error.message };
      }
    });

    const statuses = await Promise.all(statusPromises);
    const completed = statuses.filter(
      (s) => s.status === 'completed' || s.status === 'failed',
    );
    const successful = statuses.filter((s) => s.status === 'completed');
    const failed = statuses.filter((s) => s.status === 'failed');

    console.log(
      `Progress: ${completed.length}/${taskIds.length} completed (${successful.length} successful, ${failed.length} failed)`,
    );

    if (completed.length === taskIds.length) {
      return {
        total: taskIds.length,
        successful: successful.length,
        failed: failed.length,
        processingTime: Date.now() - startTime,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  throw new Error(
    `Timeout: ${taskIds.length} tasks did not complete within ${maxWaitTime}ms`,
  );
}

// Get monitoring metrics
function getMonitoringMetrics() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/monitoring/health',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(
              new Error(
                `Failed to parse monitoring response: ${error.message}`,
              ),
            );
          }
        } else {
          reject(
            new Error(
              `Monitoring request failed with status ${res.statusCode}: ${data}`,
            ),
          );
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Monitoring request failed: ${error.message}`));
    });

    req.end();
  });
}

// Run concurrent upload test
async function runConcurrentTest(fileType, filePath, concurrentRequests) {
  console.log(
    `\n=== Running ${concurrentRequests} concurrent ${fileType} uploads ===`,
  );

  const uploadPromises = [];
  const startTime = Date.now();

  // Create concurrent upload requests
  for (let i = 0; i < concurrentRequests; i++) {
    uploadPromises.push(
      uploadFile(filePath, i).catch((error) => ({
        requestId: i,
        success: false,
        error: error.message,
        uploadTime: Date.now() - startTime,
      })),
    );
  }

  // Wait for all uploads to complete
  const uploadResults = await Promise.all(uploadPromises);
  const uploadEndTime = Date.now();
  const totalUploadTime = uploadEndTime - startTime;

  // Analyze upload results
  const successfulUploads = uploadResults.filter((r) => r.success);
  const failedUploads = uploadResults.filter((r) => !r.success);

  console.log(`Upload Results:`);
  console.log(`  Total: ${uploadResults.length}`);
  console.log(`  Successful: ${successfulUploads.length}`);
  console.log(`  Failed: ${failedUploads.length}`);
  console.log(`  Total upload time: ${totalUploadTime}ms`);
  console.log(
    `  Average upload time: ${Math.round(totalUploadTime / uploadResults.length)}ms`,
  );

  if (failedUploads.length > 0) {
    console.log(
      `  Failed uploads:`,
      failedUploads.map((f) => `${f.requestId}: ${f.error}`),
    );
  }

  // Wait for processing to complete
  if (successfulUploads.length > 0) {
    const taskIds = successfulUploads.map((r) => r.taskId);

    try {
      const processingResults = await waitForCompletion(taskIds);
      console.log(`Processing Results:`);
      console.log(
        `  Total processing time: ${processingResults.processingTime}ms`,
      );
      console.log(`  Successful: ${processingResults.successful}`);
      console.log(`  Failed: ${processingResults.failed}`);
      console.log(
        `  Success rate: ${((processingResults.successful / processingResults.total) * 100).toFixed(1)}%`,
      );

      return {
        fileType,
        concurrentRequests,
        uploadTime: totalUploadTime,
        processingTime: processingResults.processingTime,
        totalTime: Date.now() - startTime,
        successfulUploads: successfulUploads.length,
        failedUploads: failedUploads.length,
        successfulProcessing: processingResults.successful,
        failedProcessing: processingResults.failed,
      };
    } catch (error) {
      console.error(`Processing failed: ${error.message}`);
      return {
        fileType,
        concurrentRequests,
        uploadTime: totalUploadTime,
        error: error.message,
        successfulUploads: successfulUploads.length,
        failedUploads: failedUploads.length,
      };
    }
  }

  return {
    fileType,
    concurrentRequests,
    uploadTime: totalUploadTime,
    successfulUploads: successfulUploads.length,
    failedUploads: failedUploads.length,
    error: 'No successful uploads to process',
  };
}

// Main load test function
async function runLoadTest() {
  console.log('🚀 Starting Document Processing API Load Test');
  console.log(`Target: ${API_BASE_URL}`);
  console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Test rounds: ${TEST_ROUNDS}`);

  // Create test files
  createTestFiles();

  // Check if API is available
  try {
    await getMonitoringMetrics();
    console.log('✅ API is available');
  } catch (error) {
    console.error('❌ API is not available:', error.message);
    console.error(
      'Please make sure the API is running on http://localhost:3000',
    );
    process.exit(1);
  }

  const testResults = [];
  metrics.startTime = Date.now();

  try {
    // Test 1: Image uploads
    const imageResult = await runConcurrentTest(
      'image',
      TEST_IMAGE_PATH,
      CONCURRENT_REQUESTS,
    );
    testResults.push(imageResult);

    // Brief pause between tests
    console.log('\n⏳ Pausing for 5 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 2: PDF uploads
    const pdfResult = await runConcurrentTest(
      'PDF',
      TEST_PDF_PATH,
      Math.floor(CONCURRENT_REQUESTS * 0.8),
    );
    testResults.push(pdfResult);

    // Brief pause
    console.log('\n⏳ Pausing for 5 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 3: Mixed uploads
    console.log(`\n=== Running mixed file type test ===`);
    const mixedPromises = [];
    const mixedStartTime = Date.now();

    for (let i = 0; i < 12; i++) {
      const filePath = i % 2 === 0 ? TEST_IMAGE_PATH : TEST_PDF_PATH;
      mixedPromises.push(
        uploadFile(filePath, i).catch((error) => ({
          requestId: i,
          success: false,
          error: error.message,
        })),
      );
    }

    const mixedResults = await Promise.all(mixedPromises);
    const mixedSuccessful = mixedResults.filter((r) => r.success);

    if (mixedSuccessful.length > 0) {
      const mixedTaskIds = mixedSuccessful.map((r) => r.taskId);
      const mixedProcessing = await waitForCompletion(mixedTaskIds);

      testResults.push({
        fileType: 'mixed',
        concurrentRequests: 12,
        totalTime: Date.now() - mixedStartTime,
        successfulUploads: mixedSuccessful.length,
        failedUploads: mixedResults.length - mixedSuccessful.length,
        successfulProcessing: mixedProcessing.successful,
        failedProcessing: mixedProcessing.failed,
      });
    }

    metrics.endTime = Date.now();

    // Get final system metrics
    console.log('\n=== Final System Health ===');
    try {
      const healthMetrics = await getMonitoringMetrics();
      console.log(
        `Overall Health: ${healthMetrics.overallHealth}% (${healthMetrics.status})`,
      );
      console.log(
        `Memory Usage: ${healthMetrics.components.memory.metrics.heapUtilization.toFixed(1)}%`,
      );
      console.log(`Queue Health: ${healthMetrics.components.queue.health}%`);
      console.log(`AI Pool Health: ${healthMetrics.components.aiPool.health}%`);
      console.log(
        `File I/O Health: ${healthMetrics.components.fileIO.health}%`,
      );
    } catch (error) {
      console.warn('Could not retrieve final health metrics:', error.message);
    }

    // Print summary
    console.log('\n📊 LOAD TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(
      `Total test duration: ${metrics.endTime - metrics.startTime}ms`,
    );

    testResults.forEach((result, index) => {
      console.log(`\nTest ${index + 1} (${result.fileType}):`);
      console.log(`  Concurrent requests: ${result.concurrentRequests}`);
      console.log(
        `  Upload success rate: ${((result.successfulUploads / result.concurrentRequests) * 100).toFixed(1)}%`,
      );

      if (result.successfulProcessing !== undefined) {
        console.log(
          `  Processing success rate: ${((result.successfulProcessing / result.successfulUploads) * 100).toFixed(1)}%`,
        );
        console.log(`  Total time: ${result.totalTime}ms`);
      }

      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });

    // Performance requirements check
    console.log('\n✅ PERFORMANCE REQUIREMENTS CHECK');
    console.log('='.repeat(50));

    const allSuccessful = testResults.every(
      (r) =>
        r.successfulUploads / r.concurrentRequests >= 0.9 && // 90% upload success
        (!r.successfulProcessing ||
          r.successfulProcessing / r.successfulUploads >= 0.9), // 90% processing success
    );

    const reasonableTime = testResults.every(
      (r) => !r.totalTime || r.totalTime < 180000, // Under 3 minutes
    );

    console.log(
      `✅ Concurrent processing (10+ requests): ${testResults.some((r) => r.concurrentRequests >= 10) ? 'PASS' : 'FAIL'}`,
    );
    console.log(`✅ Success rate (>90%): ${allSuccessful ? 'PASS' : 'FAIL'}`);
    console.log(
      `✅ Response time (<3min): ${reasonableTime ? 'PASS' : 'FAIL'}`,
    );

    if (allSuccessful && reasonableTime) {
      console.log('\n🎉 All performance requirements met!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some performance requirements not met');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Load test failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⏹️  Load test interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Load test terminated');
  process.exit(1);
});

// Run the load test
if (require.main === module) {
  runLoadTest().catch((error) => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest };
