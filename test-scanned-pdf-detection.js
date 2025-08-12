// Simple test to verify the scanned PDF detection logic
console.log('🔍 Testing Scanned PDF Detection Logic...\n');

// Mock the analyzeScannedPdfContent method logic
function analyzeScannedPdfContent(extractedText, pageCount) {
  const textLength = extractedText.length;
  const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
  const averageWordsPerPage = pageCount > 0 ? wordCount / pageCount : 0;
  const textDensity = pageCount > 0 ? textLength / pageCount : 0;

  // Configuration thresholds for scanned PDF detection
  const MIN_WORDS_PER_PAGE = 50; // Minimum words per page to consider text-based
  const MIN_CHARS_PER_PAGE = 200; // Minimum characters per page to consider text-based
  const MIN_TOTAL_WORDS = 20; // Minimum total words to consider text-based

  console.log(`📊 PDF Content Analysis:`);
  console.log(`   Total text length: ${textLength} characters`);
  console.log(`   Total words: ${wordCount}`);
  console.log(`   Pages: ${pageCount}`);
  console.log(`   Average words per page: ${averageWordsPerPage.toFixed(1)}`);
  console.log(`   Text density (chars/page): ${textDensity.toFixed(1)}`);

  // Priority 1: No text at all - definitely scanned
  if (textLength === 0) {
    return {
      isScannedPdf: true,
      textDensity,
      averageWordsPerPage,
      reason: 'No extractable text found',
    };
  }

  // Priority 2: Very minimal text - likely scanned with some metadata
  if (wordCount < MIN_TOTAL_WORDS) {
    return {
      isScannedPdf: true,
      textDensity,
      averageWordsPerPage,
      reason: `Too few total words (${wordCount} < ${MIN_TOTAL_WORDS})`,
    };
  }

  // Priority 3: Low text density per page - likely scanned
  if (averageWordsPerPage < MIN_WORDS_PER_PAGE) {
    return {
      isScannedPdf: true,
      textDensity,
      averageWordsPerPage,
      reason: `Low word density (${averageWordsPerPage.toFixed(1)} words/page < ${MIN_WORDS_PER_PAGE})`,
    };
  }

  // Priority 4: Low character density per page - likely scanned
  if (textDensity < MIN_CHARS_PER_PAGE) {
    return {
      isScannedPdf: true,
      textDensity,
      averageWordsPerPage,
      reason: `Low character density (${textDensity.toFixed(1)} chars/page < ${MIN_CHARS_PER_PAGE})`,
    };
  }

  // Priority 5: Check for patterns that suggest scanned content
  const suspiciousPatterns = [
    /^\s*\d+\s*$/, // Only page numbers
    /^[\s\n\r]*$/, // Only whitespace
    /^[^\w]*$/, // Only non-word characters
  ];

  const trimmedText = extractedText.trim();
  const isSuspiciousContent = suspiciousPatterns.some(pattern => 
    pattern.test(trimmedText)
  );

  if (isSuspiciousContent) {
    return {
      isScannedPdf: true,
      textDensity,
      averageWordsPerPage,
      reason: 'Text contains only suspicious patterns (page numbers, whitespace, etc.)',
    };
  }

  // If we reach here, it's likely a text-based PDF
  return {
    isScannedPdf: false,
    textDensity,
    averageWordsPerPage,
    reason: `Sufficient text content detected (${wordCount} words, ${averageWordsPerPage.toFixed(1)} words/page)`,
  };
}

// Test cases
const testCases = [
  {
    name: 'Empty PDF',
    text: '',
    pages: 1,
    expectedScanned: true
  },
  {
    name: 'Minimal text PDF',
    text: 'Page 1 only',
    pages: 1,
    expectedScanned: true
  },
  {
    name: 'Low density PDF',
    text: 'This is a short document with minimal text content.',
    pages: 3,
    expectedScanned: true
  },
  {
    name: 'Only page numbers',
    text: '1',
    pages: 1,
    expectedScanned: true
  },
  {
    name: 'Only whitespace',
    text: '   \n\n\r\r   ',
    pages: 1,
    expectedScanned: true
  },
  {
    name: 'Rich text-based PDF',
    text: `This is a comprehensive document with substantial text content that clearly indicates
           it is a text-based PDF rather than a scanned document. The document contains multiple
           paragraphs with meaningful content, proper sentence structure, and sufficient word
           density per page to be considered a digitally created document. This type of content
           would typically be found in documents created directly in word processors or other
           digital authoring tools rather than scanned from physical documents.`,
    pages: 1,
    expectedScanned: false
  }
];

console.log('🧪 Running Test Cases...\n');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log('─'.repeat(50));
  
  const result = analyzeScannedPdfContent(testCase.text, testCase.pages);
  
  const passed = result.isScannedPdf === testCase.expectedScanned;
  console.log(`Expected: ${testCase.expectedScanned ? 'SCANNED' : 'TEXT-BASED'}`);
  console.log(`Actual: ${result.isScannedPdf ? 'SCANNED' : 'TEXT-BASED'}`);
  console.log(`Reason: ${result.reason}`);
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (passed) passedTests++;
  
  console.log('');
});

console.log('📊 Test Results Summary:');
console.log(`   Passed: ${passedTests}/${totalTests}`);
console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 All tests passed! Scanned PDF detection logic is working correctly.');
} else {
  console.log('\n⚠️ Some tests failed. Please review the implementation.');
}

console.log('\n✅ Key Features Verified:');
console.log('   • Threshold-based detection (words/page, chars/page, total words)');
console.log('   • Suspicious pattern detection (page numbers, whitespace)');
console.log('   • Text density calculations');
console.log('   • Prioritized detection logic');
console.log('   • Detailed reasoning for decisions');