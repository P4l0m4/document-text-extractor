const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function testUpload() {
  try {
    // Create a simple test file
    const testContent = 'This is a test PDF content';
    fs.writeFileSync('./test-file.txt', testContent);

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream('./test-file.txt'), {
      filename: 'test.txt',
      contentType: 'text/plain',
    });

    console.log('Uploading test file...');

    // Upload file
    const uploadResponse = await axios.post(
      'http://localhost:3000/api/documents/upload',
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      },
    );

    console.log('Upload response:', uploadResponse.data);

    const taskId = uploadResponse.data.taskId;

    if (!taskId) {
      console.error('No task ID returned!');
      return;
    }

    console.log('Task ID:', taskId);

    // Check task status
    console.log('Checking task status...');
    const statusResponse = await axios.get(
      `http://localhost:3000/api/tasks/${taskId}/status`,
    );

    console.log('Status response:', statusResponse.data);

    // Clean up
    fs.unlinkSync('./test-file.txt');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);

    // Clean up on error
    if (fs.existsSync('./test-file.txt')) {
      fs.unlinkSync('./test-file.txt');
    }
  }
}

testUpload();
