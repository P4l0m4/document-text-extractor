const http = require('http');

// Simple health check test
function testHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log('Health Check Status:', res.statusCode);
        console.log('Health Check Response:', data.substring(0, 200));
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.log('Health Check Error:', err.message);
      reject(err);
    });

    req.setTimeout(5000, () => {
      console.log('Health Check Timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Test root endpoint
function testRoot() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log('Root Endpoint Status:', res.statusCode);
        console.log('Root Endpoint Response:', data.substring(0, 100));
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.log('Root Endpoint Error:', err.message);
      reject(err);
    });

    req.setTimeout(5000, () => {
      console.log('Root Endpoint Timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function runTests() {
  console.log('Testing API endpoints...\n');

  try {
    await testRoot();
    console.log('\n---\n');
    await testHealth();
  } catch (error) {
    console.log('Test failed:', error.message);
  }
}

runTests();
