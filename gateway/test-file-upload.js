/**
 * Test script for file upload functionality
 *
 * Usage:
 * 1. Start the gateway server: npm run dev
 * 2. Create a session: POST /api/sessions
 * 3. Run this script: node test-file-upload.js <session-id>
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample test file creation
const testFilePath = join(__dirname, 'test-sample.txt');
writeFileSync(testFilePath, 'This is a test file for upload functionality.', 'utf-8');

console.log('Test file created at:', testFilePath);
console.log('\nTo test file upload:');
console.log('1. Create a session:');
console.log('   curl -X POST http://localhost:3001/api/sessions \\');
console.log('        -H "Content-Type: application/json" \\');
console.log('        -d \'{"topic": "Test Research", "maxRounds": 3}\'');
console.log('\n2. Upload a file (replace SESSION_ID):');
console.log('   curl -X POST http://localhost:3001/api/sessions/SESSION_ID/files \\');
console.log('        -F "files=@test-sample.txt"');
console.log('\n3. List uploaded files:');
console.log('   curl http://localhost:3001/api/sessions/SESSION_ID/files');
