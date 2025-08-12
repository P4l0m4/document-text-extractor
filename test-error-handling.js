const http = require('http');

// Test error handling by checking task status
async function testTaskStatus(taskId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/${taskId}/status`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3001',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: result,
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
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

// Test with the task IDs from your error
async function checkFailedTasks() {
  const taskIds = [
    '3933b867-e6d2-4653-8b8e-a4569bd08877',
    '96fd345f-0879-4130-b9e6-9c746ee56dcc',
  ];

  for (const taskId of taskIds) {
    try {
      console.log(`\nChecking task: ${taskId}`);
      const result = await testTaskStatus(taskId);
      console.log(`Status Code: ${result.status}`);
      console.log(`Response:`, JSON.stringify(result.data, null, 2));
    } catch (error) {
      console.log(`Error checking task ${taskId}:`, error.message);
    }
  }
}

checkFailedTasks();
