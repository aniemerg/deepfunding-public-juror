#!/usr/bin/env node

/**
 * Populate AI Comparisons Database
 *
 * This script reads AI comparison data from a JSON file and populates the D1 database.
 * It normalizes repo pairs (alphabetical order) and skips if the model is already populated.
 *
 * Usage:
 *   node scripts/populate-ai-comparisons.js <data-file.json> [--model Nalla-1] [--env preview|production] [--force]
 *
 * Options:
 *   --model <name>    Model identifier (default: Nalla-1)
 *   --env <env>       Environment: preview or production (default: preview)
 *   --force           Force repopulation even if data exists
 *
 * Example:
 *   node scripts/populate-ai-comparisons.js design/ai-comparisons.json --model Nalla-1
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const dataFile = args.find(arg => !arg.startsWith('--'));
const modelFlag = args.find(arg => arg.startsWith('--model='));
const envFlag = args.find(arg => arg.startsWith('--env='));
const forceFlag = args.includes('--force');

const modelName = modelFlag ? modelFlag.split('=')[1] : 'Nalla-1';
const environment = envFlag ? envFlag.split('=')[1] : 'preview';

if (!dataFile) {
  console.error('❌ Error: Data file required');
  console.error('\nUsage:');
  console.error('  node scripts/populate-ai-comparisons.js <data-file.json> [options]');
  console.error('\nOptions:');
  console.error('  --model=<name>    Model identifier (default: Nalla-1)');
  console.error('  --env=<env>       Environment: preview or production (default: preview)');
  console.error('  --force           Force repopulation even if data exists');
  process.exit(1);
}

const dataFilePath = path.join(process.cwd(), dataFile);
if (!fs.existsSync(dataFilePath)) {
  console.error(`❌ Error: Data file not found: ${dataFilePath}`);
  process.exit(1);
}

console.log(`🔄 Populating AI Comparisons Database`);
console.log(`   Model: ${modelName}`);
console.log(`   Environment: ${environment}`);
console.log(`   Data file: ${dataFile}`);
console.log(`   Force: ${forceFlag ? 'Yes' : 'No'}\n`);

// Import normalization helper
const { normalizeComparison } = require('../src/lib/aiComparisonHelpers.js');

// Read and parse data file
console.log('📖 Reading data file...');
const rawData = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
console.log(`   Found ${rawData.length} comparisons\n`);

// Check if model is already populated
const envArg = environment === 'production' ? '--remote' : '--local';
const dbName = environment === 'production' ? 'ai-comparisons' : 'ai-comparisons-preview';

if (!forceFlag) {
  console.log('🔍 Checking if model is already populated...');
  try {
    const checkQuery = `SELECT COUNT(*) as count FROM ai_comparisons WHERE model = '${modelName}'`;
    const checkCmd = `npx wrangler d1 execute ${dbName} ${envArg} --command="${checkQuery}"`;
    const result = execSync(checkCmd, { encoding: 'utf-8' });

    // Parse the count from wrangler output
    const countMatch = result.match(/"count":\s*(\d+)/);
    if (countMatch && parseInt(countMatch[1]) > 0) {
      console.log(`   ℹ Model "${modelName}" already has ${countMatch[1]} comparisons in database`);
      console.log(`   Skipping population. Use --force to repopulate.\n`);
      process.exit(0);
    } else {
      console.log(`   ✓ Model "${modelName}" not found in database, proceeding with population\n`);
    }
  } catch (error) {
    console.log(`   ⚠ Could not check database, proceeding with population\n`);
  }
}

// Normalize and prepare data
console.log('🔧 Normalizing comparisons...');
const normalized = rawData.map(raw => {
  const norm = normalizeComparison(raw);
  return {
    repo_a: norm.repo_a,
    repo_b: norm.repo_b,
    model: modelName,
    choice: norm.choice,
    multiplier: norm.multiplier,
    final_reasoning: norm.final_reasoning.replace(/'/g, "''"), // Escape single quotes for SQL
    created_at: new Date().toISOString()
  };
});
console.log(`   ✓ Normalized ${normalized.length} comparisons\n`);

// Insert data in batches
const BATCH_SIZE = 100;
const batches = [];
for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
  batches.push(normalized.slice(i, i + BATCH_SIZE));
}

console.log(`💾 Inserting data in ${batches.length} batches of ${BATCH_SIZE}...\n`);

let totalInserted = 0;
for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  const values = batch.map(item =>
    `('${item.repo_a}', '${item.repo_b}', '${item.model}', ${item.choice}, ${item.multiplier}, '${item.final_reasoning}', '${item.created_at}')`
  ).join(',\n    ');

  const insertSQL = `
INSERT INTO ai_comparisons (repo_a, repo_b, model, choice, multiplier, final_reasoning, created_at)
VALUES
    ${values}
ON CONFLICT(repo_a, repo_b, model) DO UPDATE SET
    choice = excluded.choice,
    multiplier = excluded.multiplier,
    final_reasoning = excluded.final_reasoning,
    created_at = excluded.created_at;
`;

  try {
    // Write SQL to temp file (safer for large batches)
    const tempFile = path.join(__dirname, `temp_batch_${i}.sql`);
    fs.writeFileSync(tempFile, insertSQL);

    const insertCmd = `npx wrangler d1 execute ${dbName} ${envArg} --file=${tempFile}`;
    execSync(insertCmd, { encoding: 'utf-8', stdio: 'pipe' });

    // Clean up temp file
    fs.unlinkSync(tempFile);

    totalInserted += batch.length;
    console.log(`   ✓ Batch ${i + 1}/${batches.length}: Inserted ${batch.length} comparisons (Total: ${totalInserted})`);
  } catch (error) {
    console.error(`   ✗ Batch ${i + 1} failed:`, error.message);
    // Continue with next batch
  }
}

console.log(`\n✨ Population complete!`);
console.log(`   Total inserted: ${totalInserted}/${normalized.length} comparisons`);
console.log(`   Model: ${modelName}\n`);
