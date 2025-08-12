const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

// Test file upload and check the response
async function testUpload() {
  return new Promise((resolve, reject) => {
    const form = new FormData();

    // Create a simple test file
    const testContent = 'This is a test file for debugging';
    fs.writeFileSync('test-file.txt', testContent);

    form.append('file', fs.createReadStream('test-file.txt'));

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/documents/upload',
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        Origin: 'http://localhost:3001',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Upload Response Status:', res.statusCode);
        console.log('Upload Response:', data);

        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          console.log('Failed to parse JSON:', data);
          resolve({ error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (e) => {
      console.log('Upload Error:', e.message);
      reject(e);
    });

    form.pipe(req);
  });
}

// Test task status
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
        console.log('Status Response Status:', res.statusCode);
        console.log('Status Response:', data);

        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          console.log('Failed to parse JSON:', data);
          resolve({ error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (e) => {
      console.log('Status Error:', e.message);
      reject(e);
    });

    req.end();
  });
}

async function debugProcessing() {
  try {
    console.log('1. Testing file upload...');
    const uploadResult = await testUpload();

    if (uploadResult.taskId) {
      console.log('\n2. Testing task status...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResult = await testTaskStatus(uploadResult.taskId);
      console.log(
        '\nTask Status Result:',
        JSON.stringify(statusResult, null, 2),
      );
    } else {
      console.log('No taskId received from upload');
    }

    // Cleanup
    try {
      fs.unlinkSync('test-file.txt');
    } catch (e) {
      // Ignore cleanup errors
    }
  } catch (error) {
    console.log('Debug failed:', error.message);
  }
}

debugProcessing();
