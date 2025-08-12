#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testApiMultiPage() {
  console.log('Testing API with multi-page PDF...');

  try {
    // Use the first PDF file
    const pdfPath = './uploads/4b3c8b9a-c9d4-47c2-810f-fb0daccfecef.pdf';

    if (!fs.existsSync(pdfPath)) {
      console.error('PDF file not found:', pdfPath);
      return;
    }

    console.log('Uploading PDF to API...');

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(pdfPath));

    // Upload the file
    const uploadResponse = await fetch(
      'http://localhost:3000/api/documents/upload',
      {
        method: 'POST',
        body: form,
      },
    );

    if (!uploadResponse.ok) {
      console.error(
        'Upload failed:',
        uploadResponse.status,
        uploadResponse.statusText,
      );
      const errorText = await uploadResponse.text();
      console.error('Error details:', errorText);
      return;
    }

    const uploadResult = await uploadResponse.json();
    console.log('Upload successful, task ID:', uploadResult.taskId);

    // Wait a bit for processing
    console.log('Waiting for processing...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check task status
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(
        `http://localhost:3000/api/tasks/${uploadResult.taskId}/status`,
      );

      if (!statusResponse.ok) {
        console.error('Status check failed:', statusResponse.status);
        break;
      }

      const status = await statusResponse.json();
      console.log(
        `Attempt ${attempts + 1}: Status = ${status.status}, Progress = ${status.progress}%`,
      );

      if (status.status === 'completed') {
        console.log('Processing completed! Getting results...');

        // Get the result
        const resultResponse = await fetch(
          `http://localhost:3000/api/tasks/${uploadResult.taskId}/result`,
        );

        if (!resultResponse.ok) {
          console.error('Result fetch failed:', resultResponse.status);
          break;
        }

        const result = await resultResponse.json();

        console.log('\n=== PROCESSING RESULTS ===');
        console.log('Extracted text length:', result.extractedText.length);
        console.log(
          'First 300 characters:',
          result.extractedText.substring(0, 300),
        );
        console.log('\nMetadata:');
        console.log('- Page count:', result.metadata.pageCount);
        console.log(
          '- Original page count:',
          result.metadata.originalPageCount,
        );
        console.log('- Processed pages:', result.metadata.processedPages);
        console.log('- Is scanned PDF:', result.metadata.isScannedPdf);
        console.log('- OCR method:', result.metadata.ocrMethod);
        console.log('- Processing time:', result.metadata.processingTime, 'ms');

        // Check if we got text from multiple pages
        const pageMarkers = (
          result.extractedText.match(/--- Page \d+ ---/g) || []
        ).length;
        console.log('- Page markers found:', pageMarkers);

        if (pageMarkers > 1) {
          console.log('✅ SUCCESS: Multiple pages detected in extracted text');
        } else if (pageMarkers === 1) {
          console.log('⚠️  WARNING: Only one page marker found');
        } else {
          console.log(
            '❌ ISSUE: No page markers found - may only be processing first page',
          );
        }

        break;
      } else if (status.status === 'failed') {
        console.log('Processing failed!');
        break;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (attempts >= maxAttempts) {
      console.log('Timeout waiting for processing to complete');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  }
}

testApiMultiPage();
