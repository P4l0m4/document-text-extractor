const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing PDF scanned detection issue...');

// Read the current service file
const servicePath = path.join(__dirname, 'src/ai/ai-model-pool.service.ts');
let content = fs.readFileSync(servicePath, 'utf8');

// Check if there are any remaining method calls
if (content.includes('this.analyzeScannedPdfContent(')) {
  console.log('❌ Found problematic method call, fixing...');

  // Replace any remaining method calls with inline logic
  content = content.replace(
    /this\.analyzeScannedPdfContent\([^)]+\)/g,
    `{
      isScannedPdf: textLength === 0 || wordCount < 20 || averageWordsPerPage < 50 || textDensity < 200,
      textDensity,
      averageWordsPerPage,
      reason: textLength === 0 ? 'No extractable text found' : 
              wordCount < 20 ? \`Too few total words (\${wordCount} < 20)\` :
              averageWordsPerPage < 50 ? \`Low word density (\${averageWordsPerPage.toFixed(1)} words/page < 50)\` :
              textDensity < 200 ? \`Low character density (\${textDensity.toFixed(1)} chars/page < 200)\` :
              \`Sufficient text content detected (\${wordCount} words, \${averageWordsPerPage.toFixed(1)} words/page)\`
    }`,
  );

  fs.writeFileSync(servicePath, content);
  console.log('✅ Fixed method call');
} else {
  console.log('✅ No problematic method calls found');
}

// Remove any orphaned method definitions
if (content.includes('private analyzeScannedPdfContent(')) {
  console.log('🧹 Removing orphaned method definition...');

  // Find and remove the method definition
  const methodStart = content.indexOf('private analyzeScannedPdfContent(');
  if (methodStart !== -1) {
    // Find the end of the method by counting braces
    let braceCount = 0;
    let methodEnd = methodStart;
    let inMethod = false;

    for (let i = methodStart; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inMethod = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (inMethod && braceCount === 0) {
          methodEnd = i + 1;
          break;
        }
      }
    }

    // Remove the method
    const beforeMethod = content.substring(0, methodStart);
    const afterMethod = content.substring(methodEnd);

    // Also remove the JSDoc comment before the method
    const lines = beforeMethod.split('\n');
    let commentStart = lines.length - 1;

    // Look backwards for the start of the JSDoc comment
    while (commentStart > 0 && !lines[commentStart].trim().startsWith('/**')) {
      commentStart--;
    }

    if (lines[commentStart].trim().startsWith('/**')) {
      lines.splice(commentStart);
      content = lines.join('\n') + afterMethod;
    } else {
      content = beforeMethod + afterMethod;
    }

    fs.writeFileSync(servicePath, content);
    console.log('✅ Removed orphaned method definition');
  }
}

console.log('🎉 PDF detection fix completed!');
console.log('📝 Please restart the server to apply changes');
