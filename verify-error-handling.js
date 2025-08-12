// Simple test to check if the server is responding to task status requests
const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log(`GET ${path}`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data.substring(0, 500)}`);
        console.log('---');
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.log(`Error for ${path}:`, err.message);
      reject(err);
    });

    req.setTimeout(3000, () => {
      console.log(`Timeout for ${path}`);
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function testEndpoints() {
  try {
    // Test health endpoint
    await makeRequest('/health');

    // Test a non-existent task (should return 404)
    await makeRequest('/api/tasks/test-task-id/status');
  } catch (error) {
    console.log('Test failed:', error.message);
  }
}

testEndpoints();
