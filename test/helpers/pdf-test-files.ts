import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility class for creating test PDF files for scanned PDF workflow testing
 */
export class PdfTestFiles {
  /**
   * Create a text-based PDF with extractable content
   */
  static createTextBasedPdf(options: {
    pageCount?: number;
    wordsPerPage?: number;
    title?: string;
  } = {}): Buffer {
    const { pageCount = 1, wordsPerPage = 50, title = 'Test Document' } = options;

    let pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/Metadata 3 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [`;

    // Add page references
    const firstPageObj = 4;
    for (let i = 0; i < pageCount; i++) {
      pdfContent += `${firstPageObj + i * 2} 0 R`;
      if (i < pageCount - 1) pdfContent += ' ';
    }

    pdfContent += `]
/Count ${pageCount}
>>
endobj

3 0 obj
<<
/Type /Metadata
/Subtype /XML
/Length 100
>>
stream
<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
stream
endobj

`;

    // Add pages and content
    let objNum = firstPageObj;
    for (let i = 0; i < pageCount; i++) {
      const pageContent = this.generatePageContent(i + 1, wordsPerPage, title);
      
      pdfContent += `${objNum} 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents ${objNum + 1} 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

${objNum + 1} 0 obj
<<
/Length ${pageContent.length}
>>
stream
${pageContent}
endstream
endobj

`;
      objNum += 2;
    }

    // Add xref and trailer
    pdfContent += `xref
0 ${objNum}
0000000000 65535 f `;

    let offset = 9;
    for (let i = 1; i < objNum; i++) {
      pdfContent += `\n${offset.toString().padStart(10, '0')} 00000 n `;
      offset += 200; // Approximate offset increment
    }

    pdfContent += `
trailer
<<
/Size ${objNum}
/Root 1 0 R
>>
startxref
${offset}
%%EOF`;

    return Buffer.from(pdfContent);
  }

  /**
   * Create a scanned PDF with minimal or no extractable text
   */
  static createScannedPdf(options: {
    pageCount?: number;
    hasMinimalText?: boolean;
    title?: string;
  } = {}): Buffer {
    const { pageCount = 1, hasMinimalText = false, title = 'Scanned Document' } = options;

    let pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [`;

    // Add page references
    const firstPageObj = 3;
    for (let i = 0; i < pageCount; i++) {
      pdfContent += `${firstPageObj + i} 0 R`;
      if (i < pageCount - 1) pdfContent += ' ';
    }

    pdfContent += `]
/Count ${pageCount}
>>
endobj

`;

    // Add pages (minimal or no text content to simulate scanned pages)
    let objNum = firstPageObj;
    for (let i = 0; i < pageCount; i++) {
      let pageContent = '';
      
      if (hasMinimalText && i === 0) {
        // Add minimal text that might come from metadata or page numbers
        pageContent = `BT
/F1 8 Tf
550 750 Td
(${i + 1}) Tj
ET`;
      }

      if (pageContent) {
        pdfContent += `${objNum} 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents ${objNum + pageCount} 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

`;
      } else {
        pdfContent += `${objNum} 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj

`;
      }
      objNum++;
    }

    // Add content objects for pages with minimal text
    if (hasMinimalText) {
      const pageContent = `BT
/F1 8 Tf
550 750 Td
(1) Tj
ET`;

      pdfContent += `${objNum} 0 obj
<<
/Length ${pageContent.length}
>>
stream
${pageContent}
endstream
endobj

`;
      objNum++;
    }

    // Add xref and trailer
    pdfContent += `xref
0 ${objNum}
0000000000 65535 f `;

    let offset = 9;
    for (let i = 1; i < objNum; i++) {
      pdfContent += `\n${offset.toString().padStart(10, '0')} 00000 n `;
      offset += 150; // Approximate offset increment
    }

    pdfContent += `
trailer
<<
/Size ${objNum}
/Root 1 0 R
>>
startxref
${offset}
%%EOF`;

    return Buffer.from(pdfContent);
  }

  /**
   * Create a corrupted PDF that will fail processing
   */
  static createCorruptedPdf(): Buffer {
    return Buffer.from(`%PDF-1.4
This is not a valid PDF structure and will cause parsing errors.
The content is intentionally corrupted to test error handling.
%%EOF`);
  }

  /**
   * Create a PDF with mixed content (some text, some scanned-like pages)
   */
  static createMixedContentPdf(options: {
    totalPages?: number;
    textPages?: number[];
  } = {}): Buffer {
    const { totalPages = 3, textPages = [1] } = options;

    let pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [`;

    // Add page references
    const firstPageObj = 3;
    for (let i = 0; i < totalPages; i++) {
      pdfContent += `${firstPageObj + i * 2} 0 R`;
      if (i < totalPages - 1) pdfContent += ' ';
    }

    pdfContent += `]
/Count ${totalPages}
>>
endobj

`;

    // Add pages
    let objNum = firstPageObj;
    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const hasText = textPages.includes(pageNum);
      
      if (hasText) {
        const pageContent = `BT
/F1 12 Tf
72 720 Td
(This is page ${pageNum} with extractable text content.) Tj
0 -20 Td
(It contains readable text that can be extracted directly.) Tj
ET`;

        pdfContent += `${objNum} 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents ${objNum + 1} 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

${objNum + 1} 0 obj
<<
/Length ${pageContent.length}
>>
stream
${pageContent}
endstream
endobj

`;
      } else {
        // Scanned-like page with no text
        pdfContent += `${objNum} 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj

${objNum + 1} 0 obj
<<
/Length 0
>>
stream
endstream
endobj

`;
      }
      objNum += 2;
    }

    // Add xref and trailer
    pdfContent += `xref
0 ${objNum}
0000000000 65535 f `;

    let offset = 9;
    for (let i = 1; i < objNum; i++) {
      pdfContent += `\n${offset.toString().padStart(10, '0')} 00000 n `;
      offset += 200;
    }

    pdfContent += `
trailer
<<
/Size ${objNum}
/Root 1 0 R
>>
startxref
${offset}
%%EOF`;

    return Buffer.from(pdfContent);
  }

  /**
   * Generate realistic page content for text-based PDFs
   */
  private static generatePageContent(pageNum: number, wordsPerPage: number, title: string): string {
    const sentences = [
      'This is a comprehensive test document designed to validate PDF text extraction capabilities.',
      'The document contains multiple paragraphs with varying sentence structures and lengths.',
      'Text extraction should be able to process this content efficiently and accurately.',
      'Each page contains sufficient text density to be classified as a text-based PDF.',
      'The processing system should prioritize direct text extraction over image conversion.',
      'Performance metrics should indicate fast processing times for text-based documents.',
      'Quality assurance requires thorough testing of various document types and formats.',
      'Integration tests validate the complete workflow from upload to final result.',
      'Error handling mechanisms ensure graceful degradation when issues occur.',
      'System monitoring provides insights into processing performance and resource usage.',
    ];

    let content = `BT
/F1 12 Tf
72 720 Td
(${title} - Page ${pageNum}) Tj
0 -30 Td
`;

    let wordCount = 0;
    let yPosition = 690;
    
    while (wordCount < wordsPerPage && yPosition > 100) {
      const sentence = sentences[Math.floor(Math.random() * sentences.length)];
      const words = sentence.split(' ');
      
      // Add sentence if it fits within word limit
      if (wordCount + words.length <= wordsPerPage) {
        content += `(${sentence}) Tj
0 -15 Td
`;
        wordCount += words.length;
        yPosition -= 15;
      } else {
        // Add remaining words to reach target
        const remainingWords = wordsPerPage - wordCount;
        const partialSentence = words.slice(0, remainingWords).join(' ');
        content += `(${partialSentence}) Tj
0 -15 Td
`;
        wordCount = wordsPerPage;
      }
    }

    content += 'ET';
    return content;
  }

  /**
   * Save a PDF buffer to a file for manual testing
   */
  static savePdfToFile(pdfBuffer: Buffer, filename: string, directory: string = './test-pdfs'): string {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    const filePath = path.join(directory, filename);
    fs.writeFileSync(filePath, pdfBuffer);
    return filePath;
  }

  /**
   * Create a set of test PDFs for comprehensive testing
   */
  static createTestSuite(outputDir: string = './test-pdfs'): {
    textBasedSingle: string;
    textBasedMulti: string;
    scannedSingle: string;
    scannedMulti: string;
    scannedMinimal: string;
    mixedContent: string;
    corrupted: string;
  } {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = {
      textBasedSingle: this.savePdfToFile(
        this.createTextBasedPdf({ pageCount: 1, wordsPerPage: 100 }),
        'text-based-single.pdf',
        outputDir
      ),
      textBasedMulti: this.savePdfToFile(
        this.createTextBasedPdf({ pageCount: 5, wordsPerPage: 80 }),
        'text-based-multi.pdf',
        outputDir
      ),
      scannedSingle: this.savePdfToFile(
        this.createScannedPdf({ pageCount: 1 }),
        'scanned-single.pdf',
        outputDir
      ),
      scannedMulti: this.savePdfToFile(
        this.createScannedPdf({ pageCount: 3 }),
        'scanned-multi.pdf',
        outputDir
      ),
      scannedMinimal: this.savePdfToFile(
        this.createScannedPdf({ pageCount: 1, hasMinimalText: true }),
        'scanned-minimal-text.pdf',
        outputDir
      ),
      mixedContent: this.savePdfToFile(
        this.createMixedContentPdf({ totalPages: 4, textPages: [1, 3] }),
        'mixed-content.pdf',
        outputDir
      ),
      corrupted: this.savePdfToFile(
        this.createCorruptedPdf(),
        'corrupted.pdf',
        outputDir
      ),
    };

    console.log('Test PDF suite created in:', outputDir);
    console.log('Files:', Object.keys(files).join(', '));

    return files;
  }
}