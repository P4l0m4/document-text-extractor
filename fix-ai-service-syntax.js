#!/usr/bin/env node

/**
 * Fix syntax issues in the AI Model Pool Service
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing AI Model Pool Service syntax issues...\n');

const filePath = path.join(__dirname, 'src/ai/ai-model-pool.service.ts');

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  console.log('📄 Original file size:', content.length, 'characters');
  
  // Check for common syntax issues
  let fixes = 0;
  
  // Fix 1: Check for unterminated template literals
  const templateLiteralMatches = content.match(/`[^`]*$/gm);
  if (templateLiteralMatches) {
    console.log('❌ Found potential unterminated template literals:', templateLiteralMatches.length);
    templateLiteralMatches.forEach((match, index) => {
      console.log(`   ${index + 1}: ${match.substring(0, 50)}...`);
    });
  }
  
  // Fix 2: Check for unmatched braces
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  console.log('🔍 Brace count - Open:', openBraces, 'Close:', closeBraces);
  
  if (openBraces !== closeBraces) {
    console.log('❌ Unmatched braces detected!');
  }
  
  // Fix 3: Check for unmatched parentheses
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  console.log('🔍 Parentheses count - Open:', openParens, 'Close:', closeParens);
  
  if (openParens !== closeParens) {
    console.log('❌ Unmatched parentheses detected!');
  }
  
  // Fix 4: Check for incomplete method definitions
  const incompleteMethodMatches = content.match(/async\s+\w+\([^)]*\)\s*:\s*[^{]*$/gm);
  if (incompleteMethodMatches) {
    console.log('❌ Found potential incomplete method definitions:', incompleteMethodMatches.length);
  }
  
  // Fix 5: Look for the specific error locations
  const lines = content.split('\n');
  
  // Check line 2899 (if it exists)
  if (lines.length > 2899) {
    console.log('🔍 Line 2899:', lines[2898].substring(0, 100));
    
    // Check if there's a template literal issue
    if (lines[2898].includes('`') && !lines[2898].includes('`;')) {
      console.log('❌ Potential template literal issue on line 2899');
    }
  }
  
  // Check line 2997 (if it exists)
  if (lines.length > 2997) {
    console.log('🔍 Line 2997:', lines[2996].substring(0, 100));
  } else {
    console.log('🔍 File has', lines.length, 'lines (line 2997 does not exist)');
  }
  
  // Fix 6: Check for duplicate imports
  const importLines = lines.filter(line => line.trim().startsWith('import'));
  const importSet = new Set();
  const duplicateImports = [];
  
  importLines.forEach(line => {
    if (importSet.has(line.trim())) {
      duplicateImports.push(line.trim());
    } else {
      importSet.add(line.trim());
    }
  });
  
  if (duplicateImports.length > 0) {
    console.log('❌ Found duplicate imports:', duplicateImports.length);
    duplicateImports.forEach(imp => console.log('   ', imp));
  }
  
  // Fix 7: Remove any duplicate configuration imports
  if (content.includes('import configuration from') && content.match(/import configuration from/g).length > 1) {
    console.log('🔧 Fixing duplicate configuration imports...');
    content = content.replace(/import configuration from 'src\/config\/configuration';\s*\n/g, '');
    content = content.replace(/import configuration from 'src\/config\/configuration';\s*\n/g, '');
    content = content.replace(/import configuration from 'src\/config\/configuration';\s*\n/g, '');
    fixes++;
  }
  
  // Fix 8: Ensure the file ends properly
  if (!content.trim().endsWith('}')) {
    console.log('🔧 Adding missing closing brace...');
    content = content.trim() + '\n}\n';
    fixes++;
  }
  
  // Fix 9: Remove any trailing incomplete lines
  const lastLines = lines.slice(-10);
  console.log('🔍 Last 10 lines:');
  lastLines.forEach((line, index) => {
    const lineNum = lines.length - 10 + index + 1;
    console.log(`   ${lineNum}: ${line.substring(0, 80)}`);
  });
  
  // Fix 10: Check for specific error patterns
  const errorPatterns = [
    /this\.logger\.error\(`❌[^`]*$/m,  // Unterminated error message
    /\$\{[^}]*$/m,                      // Unterminated template expression
    /`[^`]*\n[^`]*$/m                   // Multi-line unterminated template
  ];
  
  errorPatterns.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`❌ Found error pattern ${index + 1}:`, matches[0].substring(0, 50));
    }
  });
  
  if (fixes > 0) {
    // Create backup
    fs.writeFileSync(filePath + '.backup', fs.readFileSync(filePath));
    console.log('💾 Created backup:', filePath + '.backup');
    
    // Write fixed content
    fs.writeFileSync(filePath, content);
    console.log('✅ Applied', fixes, 'fixes to the file');
  } else {
    console.log('✅ No automatic fixes needed');
  }
  
  console.log('\n📋 Manual fixes may be needed for:');
  console.log('   • Unterminated template literals');
  console.log('   • Unmatched braces or parentheses');
  console.log('   • Incomplete method definitions');
  console.log('   • Missing semicolons or commas');
  
  console.log('\n🔧 Try running: npm run build');
  console.log('   This will show the exact TypeScript errors');
  
} catch (error) {
  console.error('❌ Error processing file:', error.message);
}