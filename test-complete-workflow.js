const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Test the complete workflow
async function testCompleteWorkflow() {
  console.log('Testing complete API workflow...\n');

  // First test if server is responding
  console.log('1. Testing server connectivity...');
  try {
    const response = await makeRequest('GET', '/');
    console.log('✅ Server is responding:', response.status);
    console.log('Response:', response.data.substring(0, 100));
  } catch (error) {
    console.log('❌ Server connectivity failed:', error.message);
    return;
  }

  console.log('\n2. Testing health endpoint...');
  try {
    const healthResponse = await makeRequest('GET', '/health');
    console.log('✅ Health endpoint:', healthResponse.status);
    console.log('Response:', healthResponse.data.substring(0, 200));
  } catch (error) {
    console.log('❌ Health endpoint failed:', error.message);
  }

  console.log('\n3. Testing upload endpoint with OPTIONS (CORS preflight)...');
  try {
    const optionsResponse = await makeRequest(
      'OPTIONS',
      '/api/documents/upload',
    );
    console.log('✅ OPTIONS request:', optionsResponse.status);
    console.log(
      'CORS headers:',
      JSON.stringify(optionsResponse.headers, null, 2),
    );
  } catch (error) {
    console.log('❌ OPTIONS request failed:', error.message);
  }

  console.log(
    '\n4. Testing upload endpoint with GET (should return method not allowed)...',
  );
  try {
    const getResponse = await makeRequest('GET', '/api/documents/upload');
    console.log('✅ GET upload endpoint:', getResponse.status);
    console.log('Response:', getResponse.data);
  } catch (error) {
    console.log('❌ GET upload endpoint failed:', error.message);
  }
}

function makeRequest(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3001',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

testCompleteWorkflow();
