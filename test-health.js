#!/usr/bin/env node

/**
 * Test the health endpoint to verify the API is working
 */

const http = require('http');

function testHealthEndpoint() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.status === 'ok') {
          console.log('✅ Health check passed!');
          console.log('📊 Server info:', {
            uptime: response.uptime,
            memory: response.system.memory,
            environment: response.api.environment
          });
        } else {
          console.log('❌ Health check failed - unexpected response');
        }
      } catch (error) {
        console.log('❌ Health check failed - invalid JSON response');
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ Health check failed:', error.message);
    console.log('Make sure the server is running on port 3000');
  });

  req.on('timeout', () => {
    console.log('❌ Health check timed out');
    req.destroy();
  });

  req.end();
}

console.log('🏥 Testing health endpoint...');
testHealthEndpoint();
