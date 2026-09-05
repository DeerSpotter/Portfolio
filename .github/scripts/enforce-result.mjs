import { readFileSync } from 'node:fs';

const result = JSON.parse(readFileSync('.ci-results/result.json', 'utf8'));
if (result.status !== 0) {
  console.error(`Portfolio validation failed: ${result.stage}`);
  console.error(readFileSync('.ci-results/diagnostic.txt', 'utf8'));
  process.exit(1);
}
console.log('Portfolio validation passed.');
