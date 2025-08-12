#!/usr/bin/env node

// Test multi-page PDF extraction
const fs = require('fs');
const path = require('path');

async function testMultiPagePdf() {
  console.log('Testing multi-page PDF extraction...');

  try {
    // Import pdf-parse
    const pdfParse = require('pdf-parse');
    console.log('pdf-parse loaded successfully');

    // Check if we have any PDF files in uploads
    const uploadsDir = './uploads';
    const files = fs.readdirSync(uploadsDir);
    const pdfFiles = files.filter((file) => file.endsWith('.pdf'));

    console.log(`Found ${pdfFiles.length} PDF files:`, pdfFiles);

    if (pdfFiles.length === 0) {
      console.log('No PDF files found to test with');
      return;
    }

    // Test all PDF files
    for (let i = 0; i < pdfFiles.length; i++) {
      const pdfPath = path.join(uploadsDir, pdfFiles[i]);
      console.log(
        `\n=== Testing PDF ${i + 1}/${pdfFiles.length}: ${pdfPath} ===`,
      );

      const dataBuffer = fs.readFileSync(pdfPath);
      console.log(`PDF file size: ${dataBuffer.length} bytes`);

      // Parse with max: 0 (should extract all pages)
      const pdfData = await pdfParse(dataBuffer, {
        max: 0,
        version: 'v1.10.100',
      });

      console.log(`\nPDF Analysis Results:`);
      console.log(`- Number of pages: ${pdfData.numpages}`);
      console.log(`- Text length: ${pdfData.text.length} characters`);
      console.log(
        `- First 200 characters: "${pdfData.text.substring(0, 200)}..."`,
      );

      // Check if text contains page breaks or multiple page content
      const lines = pdfData.text
        .split('\n')
        .filter((line) => line.trim().length > 0);
      console.log(`- Number of non-empty lines: ${lines.length}`);

      // Look for page indicators
      const pageIndicators = pdfData.text.match(/page\s*\d+/gi) || [];
      console.log(
        `- Found page indicators: ${pageIndicators.length}`,
        pageIndicators,
      );

      // Test with different max values
      console.log(`\nTesting with max: 1 (first page only):`);
      const firstPageOnly = await pdfParse(dataBuffer, {
        max: 1,
        version: 'v1.10.100',
      });
      console.log(
        `- First page text length: ${firstPageOnly.text.length} characters`,
      );
      console.log(`- First page pages: ${firstPageOnly.numpages}`);

      // Compare
      if (pdfData.text.length === firstPageOnly.text.length) {
        console.log(
          '\n⚠️  WARNING: Full PDF and first-page-only extractions are identical!',
        );
        console.log('   This suggests only the first page is being extracted.');
      } else {
        console.log(
          '\n✅ SUCCESS: Full PDF extraction contains more text than first page only.',
        );
      }

      // Check if this appears to be a scanned PDF
      if (pdfData.text.length < 50) {
        console.log(
          '\n📄 This appears to be a scanned PDF (minimal text extracted)',
        );
        console.log('   This would trigger PDF-to-image conversion in the API');
      }
    }
  } catch (error) {
    console.error('Error testing PDF:', error.message);
    console.error(error.stack);
  }
}

testMultiPagePdf();
