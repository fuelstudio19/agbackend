#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript files in src directory
const srcDir = path.join(__dirname, 'src');

// Function to recursively find all .ts files
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Get all TypeScript files
const tsFiles = findTsFiles(srcDir);

// For each file, replace console.* calls with logger.*
let totalReplacements = 0;

tsFiles.forEach(filePath => {
  // Skip the logger.ts file itself
  if (filePath.endsWith('logger.ts')) {
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let replacements = 0;
  
  // Check if file already imports logger
  const hasLoggerImport = content.includes("import { logger }") || 
                           content.includes("import {logger}");
  
  // Replace console.error with logger.error
  const errorRegex = /console\.error\((.*)\)/g;
  const errorMatches = content.match(errorRegex);
  
  if (errorMatches) {
    content = content.replace(errorRegex, 'logger.error($1)');
    replacements += errorMatches.length;
    modified = true;
  }
  
  // Replace console.warn with logger.warn
  const warnRegex = /console\.warn\((.*)\)/g;
  const warnMatches = content.match(warnRegex);
  
  if (warnMatches) {
    content = content.replace(warnRegex, 'logger.warn($1)');
    replacements += warnMatches.length;
    modified = true;
  }
  
  // Replace console.log with logger.info
  const logRegex = /console\.log\((.*)\)/g;
  const logMatches = content.match(logRegex);
  
  if (logMatches) {
    content = content.replace(logRegex, 'logger.info($1)');
    replacements += logMatches.length;
    modified = true;
  }
  
  // Add logger import if needed
  if (modified && !hasLoggerImport) {
    // Find the last import statement
    const importRegex = /^import .* from .*$/gm;
    const imports = [...content.matchAll(importRegex)];
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportEndPos = lastImport.index + lastImport[0].length;
      
      // Insert logger import after the last import
      content = 
        content.slice(0, lastImportEndPos) + 
        '\nimport { logger } from \'../utils/logger\';' + 
        content.slice(lastImportEndPos);
    } else {
      // No imports found, add at the top
      content = 'import { logger } from \'../utils/logger\';\n\n' + content;
    }
  }
  
  // Write the file if changed
  if (modified) {
    // Fix relative import paths if needed
    const relPath = path.relative(path.dirname(filePath), path.join(__dirname, 'src', 'utils'));
    const normalizedPath = relPath.split(path.sep).join('/');
    content = content.replace('../utils/logger', normalizedPath + '/logger');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}: ${replacements} replacements`);
    totalReplacements += replacements;
  }
});

console.log(`\nCompleted! Total replacements: ${totalReplacements}`); 