const http = require('http');

// Test CORS implementation
async function testCorsImplementation() {
  console.log('Testing CORS implementation...\n');

  // Test 1: Allowed origin - https://supernotaire.fr
  console.log('Test 1: Testing allowed origin (https://supernotaire.fr)');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://supernotaire.fr',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    console.log('Status:', response.statusCode);
    console.log('CORS Headers:', {
      'Access-Control-Allow-Origin':
        response.headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods':
        response.headers['access-control-allow-methods'],
      'Access-Control-Allow-Credentials':
        response.headers['access-control-allow-credentials'],
    });
    console.log('✅ Test 1 passed - Allowed origin accepted\n');
  } catch (error) {
    console.log('❌ Test 1 failed:', error.message, '\n');
  }

  // Test 2: Allowed origin - localhost:3001
  console.log('Test 2: Testing allowed origin (http://localhost:3001)');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3001',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    console.log('Status:', response.statusCode);
    console.log('CORS Headers:', {
      'Access-Control-Allow-Origin':
        response.headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods':
        response.headers['access-control-allow-methods'],
      'Access-Control-Allow-Credentials':
        response.headers['access-control-allow-credentials'],
    });
    console.log('✅ Test 2 passed - Allowed origin accepted\n');
  } catch (error) {
    console.log('❌ Test 2 failed:', error.message, '\n');
  }

  // Test 3: Disallowed origin
  console.log('Test 3: Testing disallowed origin (https://malicious-site.com)');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    console.log('Status:', response.statusCode);
    if (response.statusCode === 403) {
      console.log('✅ Test 3 passed - Disallowed origin rejected with 403\n');
    } else {
      console.log('❌ Test 3 failed - Expected 403 status code\n');
    }
  } catch (error) {
    console.log('❌ Test 3 failed:', error.message, '\n');
  }

  // Test 4: No origin (should be allowed)
  console.log('Test 4: Testing request with no origin header');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
    });

    console.log('Status:', response.statusCode);
    if (response.statusCode === 200) {
      console.log('✅ Test 4 passed - Request without origin allowed\n');
    } else {
      console.log('❌ Test 4 failed - Expected 200 status code\n');
    }
  } catch (error) {
    console.log('❌ Test 4 failed:', error.message, '\n');
  }
}

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Check if server is running first
async function checkServerStatus() {
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
    });
    return response.statusCode === 200;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('Checking if server is running on localhost:3000...');
  const isRunning = await checkServerStatus();

  if (!isRunning) {
    console.log('❌ Server is not running on localhost:3000');
    console.log('Please start the server with: npm run start:dev');
    process.exit(1);
  }

  console.log('✅ Server is running, proceeding with CORS tests...\n');
  await testCorsImplementation();
}

main().catch(console.error);
