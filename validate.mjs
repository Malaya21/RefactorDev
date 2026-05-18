// Quick syntax check - validate that files can be parsed
import fs from 'fs';
import path from 'path';

const filesToCheck = [
  'client/src/context/AppContext.jsx',
  'client/src/services/habitService.js',
  'client/src/services/noteService.js'
];

console.log('Checking files for syntax...\n');

for (const file of filesToCheck) {
  const content = fs.readFileSync(path.resolve(file), 'utf-8');
  try {
    // Just ensure it's valid JavaScript syntax
    new Function(content);
    console.log(`✓ ${file}`);
  } catch (e) {
    console.log(`✗ ${file}`);
    console.log(`  Error: ${e.message}\n`);
  }
}

console.log('\nFile syntax validation complete!');
