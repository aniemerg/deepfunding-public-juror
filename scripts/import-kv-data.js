#!/usr/bin/env node

/**
 * Import KV data from exported JSON file
 * Usage: node scripts/import-kv-data.js <json-file> [--env=production]
 */

const fs = require('fs');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const jsonFile = args[0];
const envArg = args.find(arg => arg.startsWith('--env='));
const env = envArg ? envArg.split('=')[1] : 'preview';

if (!jsonFile) {
  console.error('Usage: node scripts/import-kv-data.js <json-file> [--env=production]');
  process.exit(1);
}

if (!fs.existsSync(jsonFile)) {
  console.error(`Error: File not found: ${jsonFile}`);
  process.exit(1);
}

console.log(`\nImporting KV data from ${jsonFile} to ${env} environment...\n`);

// Read the exported data
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

if (!data.keys || typeof data.keys !== 'object') {
  console.error('Error: Invalid export file format');
  process.exit(1);
}

// Convert keys object to array
const keyEntries = Object.entries(data.keys);

console.log(`Found ${keyEntries.length} keys to import`);
console.log(`User: ${data.user} (${data.address})\n`);

// Get namespace ID from wrangler.jsonc (strip comments)
const wranglerContent = fs.readFileSync('./wrangler.jsonc', 'utf8');
// Remove comments
const wranglerJson = wranglerContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const wranglerConfig = JSON.parse(wranglerJson);
const namespaceId = env === 'production'
  ? wranglerConfig.kv_namespaces[0].id
  : wranglerConfig.kv_namespaces[0].preview_id;

if (!namespaceId) {
  console.error(`Error: Could not find ${env} namespace ID in wrangler.jsonc`);
  process.exit(1);
}

console.log(`Target namespace: ${namespaceId} (${env})\n`);

// Import each key
let successCount = 0;
let errorCount = 0;

for (const [key, value] of keyEntries) {
  try {
    // Escape value for shell
    const valueJson = JSON.stringify(value).replace(/'/g, "\\'");

    // Use wrangler to put the key
    const cmd = env === 'production'
      ? `npx wrangler kv key put "${key}" '${valueJson}' --namespace-id=${namespaceId} --remote`
      : `npx wrangler kv key put "${key}" '${valueJson}' --namespace-id=${namespaceId} --preview --remote`;

    execSync(cmd, { stdio: 'ignore' });

    successCount++;
    process.stdout.write(`\r✓ Imported ${successCount}/${keyEntries.length} keys`);
  } catch (error) {
    errorCount++;
    console.error(`\n✗ Failed to import key: ${key}`);
    console.error(`  Error: ${error.message}`);
  }
}

console.log(`\n\n✓ Import complete!`);
console.log(`  Success: ${successCount}`);
console.log(`  Errors: ${errorCount}`);
