const http = require('http');

function testEndpoint(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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

    req.end();
  });
}

async function testAllEndpoints() {
  console.log('Testing API endpoints...\n');

  // Test root endpoint
  try {
    const rootResponse = await testEndpoint('/');
    console.log('GET / - Status:', rootResponse.status);
    console.log('Response:', rootResponse.data);
  } catch (error) {
    console.log('GET / - Error:', error.message);
  }

  console.log('\n---\n');

  // Test health endpoint
  try {
    const healthResponse = await testEndpoint('/health');
    console.log('GET /health - Status:', healthResponse.status);
    console.log('Response:', healthResponse.data);
  } catch (error) {
    console.log('GET /health - Error:', error.message);
  }

  console.log('\n---\n');

  // Test upload endpoint (should return method not allowed for GET)
  try {
    const uploadResponse = await testEndpoint('/api/documents/upload');
    console.log('GET /api/documents/upload - Status:', uploadResponse.status);
    console.log('Response:', uploadResponse.data);
  } catch (error) {
    console.log('GET /api/documents/upload - Error:', error.message);
  }
}

testAllEndpoints();
