const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3001',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, Origin',
  });
  res.end(
    JSON.stringify({
      message: 'Test server is working!',
      timestamp: new Date().toISOString(),
    }),
  );
});

server.listen(3002, () => {
  console.log('Test server running on http://localhost:3002');
});

// Test the server
setTimeout(() => {
  const testReq = http.request('http://localhost:3002', (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      console.log('✅ Test server response:', data);
    });
  });

  testReq.on('error', (err) => {
    console.log('❌ Test server error:', err.message);
  });

  testReq.end();
}, 1000);
