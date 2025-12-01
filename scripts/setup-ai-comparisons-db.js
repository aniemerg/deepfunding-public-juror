#!/usr/bin/env node

/**
 * Setup AI Comparisons D1 Database
 *
 * This script creates the D1 database and runs the schema migration.
 * Run this once when setting up a new environment.
 *
 * Usage:
 *   node scripts/setup-ai-comparisons-db.js [--env preview|production]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const envFlag = args.find(arg => arg.startsWith('--env='));
const environment = envFlag ? envFlag.split('=')[1] : 'preview';

console.log(`🔧 Setting up AI Comparisons D1 database for ${environment} environment...\n`);

// Step 1: Create D1 database (if it doesn't exist)
console.log('Step 1: Creating D1 database...');
try {
  const dbName = environment === 'production'
    ? 'ai-comparisons'
    : 'ai-comparisons-preview';

  console.log(`  Creating database: ${dbName}`);
  const createCmd = `npx wrangler d1 create ${dbName}`;
  const result = execSync(createCmd, { encoding: 'utf-8', stdio: 'pipe' });

  // Parse the database ID from output
  const idMatch = result.match(/database_id = "([^"]+)"/);
  if (idMatch) {
    console.log(`  ✓ Database created with ID: ${idMatch[1]}`);
    console.log(`  \n  Add this to your wrangler.jsonc:`);
    console.log(`
  [[d1_databases]]
  binding = "AI_COMPARISONS"
  database_name = "${dbName}"
  database_id = "${idMatch[1]}"
`);
  } else {
    console.log(`  ℹ Database may already exist. Check wrangler.jsonc for binding.`);
  }
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('  ℹ Database already exists, continuing...');
  } else {
    console.error('  ✗ Failed to create database:', error.message);
  }
}

// Step 2: Run migrations
console.log('\nStep 2: Running schema migration...');
try {
  const migrationFile = path.join(__dirname, '../migrations/0001_ai_comparisons.sql');

  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }

  const envArg = environment === 'production' ? '' : '--local';
  const migrateCmd = `npx wrangler d1 execute ai-comparisons ${envArg} --file=${migrationFile}`;

  console.log(`  Running migration: ${migrationFile}`);
  execSync(migrateCmd, { encoding: 'utf-8', stdio: 'inherit' });
  console.log('  ✓ Migration completed successfully');
} catch (error) {
  console.error('  ✗ Migration failed:', error.message);
  process.exit(1);
}

console.log('\n✨ Database setup complete!');
console.log('\nNext steps:');
console.log('  1. Update wrangler.jsonc with the D1 binding (see output above)');
console.log('  2. Run: npm run populate-ai-comparisons (when you have the data file ready)');
