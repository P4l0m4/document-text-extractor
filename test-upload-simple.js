const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
  try {
    // Create a simple test PDF file (we'll use an existing one)
    const form = new FormData();

    // Use one of the existing PDF files
    const pdfPath = './uploads/4b3c8b9a-c9d4-47c2-810f-fb0daccfecef.pdf';

    if (!fs.existsSync(pdfPath)) {
      console.error('Test PDF file not found:', pdfPath);
      return;
    }

    form.append('file', fs.createReadStream(pdfPath), {
      filename: 'test.pdf',
      contentType: 'application/pdf',
    });

    console.log('Testing upload endpoint...');

    const response = await axios.post(
      'http://localhost:3000/api/documents/upload',
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 10000,
      },
    );

    console.log('Upload successful!');
    console.log('Response:', response.data);

    if (response.data.taskId) {
      console.log('Task ID received:', response.data.taskId);

      // Test status endpoint
      console.log('Testing status endpoint...');
      const statusResponse = await axios.get(
        `http://localhost:3000/api/tasks/${response.data.taskId}/status`,
      );
      console.log('Status response:', statusResponse.data);
    }
  } catch (error) {
    console.error('Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testUpload();
