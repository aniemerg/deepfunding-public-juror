#!/usr/bin/env node

/**
 * KV Manager - Development tool for managing Cloudflare KV data
 *
 * Usage:
 *   node scripts/kv-manager.js list [--env=preview|production]
 *   node scripts/kv-manager.js inspect <user> [--verbose] [--env=preview|production]
 *   node scripts/kv-manager.js export <user> <file> [--env=preview|production]
 *   node scripts/kv-manager.js clear <user> [--env=preview|production]
 *   node scripts/kv-manager.js clear-pattern <pattern> [--env=preview|production]
 *   node scripts/kv-manager.js clear-local
 *
 * For standalone execution: chmod +x scripts/kv-manager.js && ./scripts/kv-manager.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// KV namespace IDs from wrangler.jsonc
const KV_NAMESPACES = {
  preview: '221e8a16f90a4ae8bf4025f471d4c31c',
  production: 'd5dc344ae45b41b88f0f0ae11cefa8ba'
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = '') {
  console.log(color + message + colors.reset);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message) {
  log(message, colors.cyan);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const params = args.slice(1).filter(arg => !arg.startsWith('--'));

  const flags = {};
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value || true;
    }
  });

  // Default to preview environment
  flags.env = flags.env || 'preview';

  return { command, params, flags };
}

// Execute wrangler command and return output
function execWrangler(command, env = 'preview', useLocal = false) {
  const namespaceId = KV_NAMESPACES[env === 'preview' ? 'preview' : 'production'];

  // When using --local, don't specify --preview or --remote flags
  // Local storage is persisted per namespace-id, not per environment
  const storageFlag = useLocal ? '--local' : (env === 'preview' ? '--preview --remote' : '--remote');

  try {
    const output = execSync(
      `wrangler kv key ${command} --namespace-id=${namespaceId} ${storageFlag}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return output.trim();
  } catch (err) {
    error(`Wrangler command failed: ${err.message}`);
    if (err.stderr) {
      console.error(err.stderr.toString());
    }
    throw err;
  }
}

// Get user profile from KV (contains ENS name)
function getUserProfile(address, env = 'preview', useLocal = false) {
  const profileKey = `user:${address.toLowerCase()}:profile`;
  try {
    const value = getKeyValue(profileKey, env, useLocal);
    return value;
  } catch (err) {
    return null;
  }
}

// Resolve ENS name to address - check reverse mapping first for speed
function resolveENS(ensNameOrAddress, env = 'preview', useLocal = false) {
  // If it looks like an address, return it
  if (ensNameOrAddress.startsWith('0x')) {
    return ensNameOrAddress.toLowerCase();
  }

  // Try fast lookup via reverse mapping (ens:{name} → address)
  const ensLookupKey = `ens:${ensNameOrAddress}`;
  const ensMapping = getKeyValue(ensLookupKey, env, useLocal);
  if (ensMapping && ensMapping.address) {
    return ensMapping.address.toLowerCase();
  }

  // Fallback: scan all profiles (for backwards compatibility with old data)
  const allKeys = getAllKeys(env, useLocal);
  const profileKeys = allKeys.filter(k => k.includes(':profile'));

  for (const key of profileKeys) {
    const profile = getKeyValue(key, env, useLocal);
    if (profile && profile.ensName === ensNameOrAddress) {
      return profile.address.toLowerCase();
    }
  }

  error(`ENS name ${ensNameOrAddress} not found in KV. User may need to log in first.`);
  throw new Error('ENS name not found');
}

// Get ENS name from KV (no RPC calls)
function getENSFromKV(address, env = 'preview', useLocal = false) {
  const profile = getUserProfile(address, env, useLocal);
  return profile?.ensName || null;
}

// Get all keys from KV
function getAllKeys(env = 'preview', useLocal = false) {
  try {
    const output = execWrangler('list', env, useLocal);
    if (!output) return [];

    const keys = JSON.parse(output);
    return keys.map(k => k.name);
  } catch (err) {
    error(`Failed to list keys: ${err.message}`);
    return [];
  }
}

// Get value for a specific key
function getKeyValue(key, env = 'preview', useLocal = false) {
  try {
    const output = execWrangler(`get "${key}"`, env, useLocal);
    try {
      return JSON.parse(output);
    } catch {
      return output;
    }
  } catch (err) {
    return null;
  }
}

// Delete a specific key
function deleteKey(key, env = 'preview', useLocal = false) {
  try {
    execWrangler(`delete "${key}"`, env, useLocal);
    return true;
  } catch (err) {
    error(`Failed to delete key ${key}: ${err.message}`);
    return false;
  }
}

// Ask for confirmation
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

// Extract user addresses from keys
function extractUsers(keys) {
  const users = new Map();

  keys.forEach(key => {
    const match = key.match(/^user:([^:]+):/);
    if (match) {
      const address = match[1];
      if (!users.has(address)) {
        users.set(address, []);
      }
      users.get(address).push(key);
    }
  });

  return users;
}

// Command: list - Show all users
function cmdList(env, useLocal = false) {
  const storageType = useLocal ? 'local' : 'remote';
  info(`\nListing users in ${storageType} KV (${env})...\n`);

  const keys = getAllKeys(env, useLocal);
  const users = extractUsers(keys);

  if (users.size === 0) {
    log('No users found in KV.');
    return;
  }

  log(`Found ${users.size} user(s):\n`, colors.bright);

  for (const [address, userKeys] of users) {
    // Get ENS name from KV (fast, only reads profile key)
    const ensName = getENSFromKV(address, env, useLocal);
    const displayName = ensName ? `${ensName} (${address.slice(0, 10)}...)` : address;

    // Count keys by type for quick summary
    const dataKeys = userKeys.filter(k => k.includes(':data')).length;
    const navigationKeys = userKeys.filter(k => k.includes(':navigation')).length;
    const profileKeys = userKeys.filter(k => k.includes(':profile')).length;

    log(`- ${displayName}`, colors.cyan);
    log(`  → ${userKeys.length} keys total (${dataKeys} data, ${navigationKeys} nav, ${profileKeys} profile)`);
  }

  log('\nTip: Use "inspect <user>" to see detailed data', colors.yellow);
  log('');
}

// Command: inspect - View user data
function cmdInspect(user, env, verbose = false, useLocal = false) {
  const storageType = useLocal ? 'local' : 'remote';
  info(`\nInspecting data for ${user} in ${storageType} KV (${env})...\n`);

  // Resolve ENS to address (from KV or assume it's an address)
  const address = resolveENS(user, env, useLocal);
  const ensName = getENSFromKV(address, env, useLocal);
  const displayName = ensName ? `${ensName} (${address})` : address;

  log(`User: ${displayName}\n`);

  // Get all keys for this user
  const allKeys = getAllKeys(env, useLocal);
  const userKeys = allKeys.filter(key => key.startsWith(`user:${address}:`));

  if (userKeys.length === 0) {
    warning('No data found for this user.');
    return;
  }

  log(`Found ${userKeys.length} keys:\n`, colors.bright);

  // Show key list
  userKeys.forEach(key => {
    log(`  ${key}`, colors.cyan);
  });

  log('');

  // Parse and categorize data
  const navigation = userKeys.find(k => k.includes(':navigation:'));
  if (navigation) {
    const navData = getKeyValue(navigation, env, useLocal);
    if (navData) {
      log('Navigation State:', colors.bright);
      log(`  Current Screen: ${navData.currentScreen || 'unknown'}`);
      if (navData.completedScreens) {
        log(`  Completed: [${navData.completedScreens.join(', ')}]`);
      }
      log('');
    }
  }

  // Show recent submissions
  log('Recent Data:', colors.bright);
  const dataKeys = userKeys.filter(k => k.includes(':data'));
  for (const key of dataKeys.slice(0, 5)) {
    const value = getKeyValue(key, env, useLocal);
    if (value) {
      const screenName = key.split(':')[2];
      if (value.submittedAt) {
        log(`  ${screenName}: submitted ${value.submittedAt}`);
      } else if (value.timestamp) {
        log(`  ${screenName}: updated ${value.timestamp}`);
      }

      // Show key data points
      if (verbose && value) {
        log(`    ${JSON.stringify(value, null, 2).split('\n').slice(0, 10).join('\n    ')}`);
      }
    }
  }

  if (verbose) {
    log('\n' + '='.repeat(60), colors.bright);
    log('FULL DATA DUMP:', colors.bright);
    log('='.repeat(60) + '\n', colors.bright);

    for (const key of userKeys) {
      log(`\n[${key}]`, colors.yellow);
      const value = getKeyValue(key, env, useLocal);
      log(JSON.stringify(value, null, 2));
    }
  }

  log('');
}

// Command: export - Save user data to file
function cmdExport(user, filename, env, useLocal = false) {
  const storageType = useLocal ? 'local' : 'remote';
  info(`\nExporting data for ${user} from ${storageType} KV to ${filename}...\n`);

  // Resolve ENS to address (from KV or assume it's an address)
  const address = resolveENS(user, env, useLocal);
  const ensName = getENSFromKV(address, env, useLocal);
  log(`User: ${ensName || address}`);

  // Get all keys for this user
  const allKeys = getAllKeys(env, useLocal);
  const userKeys = allKeys.filter(key => key.startsWith(`user:${address}:`));

  if (userKeys.length === 0) {
    warning('No data found for this user.');
    return;
  }

  // Collect all data
  const exportData = {
    user: user,
    address: address,
    environment: env,
    storage: storageType,
    exportedAt: new Date().toISOString(),
    keys: {}
  };

  for (const key of userKeys) {
    exportData.keys[key] = getKeyValue(key, env, useLocal);
  }

  // Write to file
  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
  success(`Exported ${userKeys.length} keys to ${filename}`);
}

// Command: clear - Delete all user data
async function cmdClear(user, env, useLocal = false) {
  const storageType = useLocal ? 'local' : 'remote';
  warning(`\nAbout to delete ALL data for ${user}`);
  log(`Storage: ${storageType}`);
  log(`Environment: ${env}\n`);

  // Resolve ENS to address (from KV or assume it's an address)
  const address = resolveENS(user, env, useLocal);
  const ensName = getENSFromKV(address, env, useLocal);
  log(`User: ${ensName || address}\n`);

  // Get all keys for this user
  const allKeys = getAllKeys(env, useLocal);
  const userKeys = allKeys.filter(key => key.startsWith(`user:${address}:`));

  if (userKeys.length === 0) {
    warning('No data found for this user.');
    return;
  }

  log(`Keys to delete: ${userKeys.length}\n`, colors.red);
  userKeys.forEach(key => log(`  ${key}`, colors.red));
  log('');

  // Extra confirmation for production
  if (env === 'production' && !useLocal) {
    error('WARNING: You are about to delete PRODUCTION data!');
    const confirm1 = await askConfirmation('Type "yes" to confirm production delete');
    if (!confirm1) {
      log('Cancelled.');
      return;
    }
  }

  const confirmed = await askConfirmation('Are you sure?');
  if (!confirmed) {
    log('Cancelled.');
    return;
  }

  // Delete all keys
  let deleted = 0;
  for (const key of userKeys) {
    if (deleteKey(key, env, useLocal)) {
      deleted++;
    }
  }

  success(`Deleted ${deleted} keys`);
}

// Command: clear-pattern - Delete keys matching pattern
async function cmdClearPattern(pattern, env) {
  warning(`\nAbout to delete keys matching pattern: ${pattern}`);
  log(`Environment: ${env}\n`);

  // Get all keys and filter by pattern
  const allKeys = getAllKeys(env);
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  const matchingKeys = allKeys.filter(key => regex.test(key));

  if (matchingKeys.length === 0) {
    warning('No keys match this pattern.');
    return;
  }

  log(`Keys to delete: ${matchingKeys.length}\n`, colors.red);
  matchingKeys.slice(0, 20).forEach(key => log(`  ${key}`, colors.red));
  if (matchingKeys.length > 20) {
    log(`  ... and ${matchingKeys.length - 20} more`, colors.red);
  }
  log('');

  // Extra confirmation for production
  if (env === 'production') {
    error('WARNING: You are about to delete PRODUCTION data!');
    const confirm1 = await askConfirmation('Type "yes" to confirm production delete');
    if (!confirm1) {
      log('Cancelled.');
      return;
    }
  }

  const confirmed = await askConfirmation('Are you sure?');
  if (!confirmed) {
    log('Cancelled.');
    return;
  }

  // Delete all matching keys
  let deleted = 0;
  for (const key of matchingKeys) {
    if (deleteKey(key, env)) {
      deleted++;
    }
  }

  success(`Deleted ${deleted} keys`);
}

// Clear local development storage
async function cmdClearLocal() {
  const localStoragePath = path.join(process.cwd(), '.wrangler', 'state');

  warning('\nAbout to delete LOCAL development storage');
  log('This will clear data stored by "npm run preview"');
  log(`Path: ${localStoragePath}\n`);

  if (!fs.existsSync(localStoragePath)) {
    warning('Local storage directory does not exist. Nothing to clear.');
    return;
  }

  // Check if there's data
  try {
    const files = fs.readdirSync(localStoragePath, { recursive: true });
    const kvFiles = files.filter(f => f.includes('kv'));
    if (kvFiles.length === 0) {
      warning('No KV storage files found. Nothing to clear.');
      return;
    }
    log(`Found ${kvFiles.length} KV storage file(s)\n`, colors.yellow);
  } catch (err) {
    error(`Error reading storage directory: ${err.message}`);
    return;
  }

  const confirmed = await askConfirmation('Delete local development storage?');
  if (!confirmed) {
    log('Cancelled.');
    return;
  }

  try {
    fs.rmSync(localStoragePath, { recursive: true, force: true });
    success('Local development storage cleared!');
    info('Note: Remote KV (preview/production) is not affected.');
    info('Run "npm run preview" to start fresh.');
  } catch (err) {
    error(`Failed to clear local storage: ${err.message}`);
    throw err;
  }
}

// Show help
function showHelp() {
  log('\nKV Manager - Development tool for managing Cloudflare KV data\n', colors.bright);
  log('Usage:', colors.cyan);
  log('  kv-manager list [--local] [--env=preview|production]');
  log('  kv-manager inspect <user> [--verbose] [--local] [--env=preview|production]');
  log('  kv-manager export <user> <file> [--local] [--env=preview|production]');
  log('  kv-manager clear <user> [--local] [--env=preview|production]');
  log('  kv-manager clear-pattern <pattern> [--env=preview|production]');
  log('  kv-manager clear-local');
  log('\nCommands:', colors.cyan);
  log('  list              List all users');
  log('  inspect <user>    View data for a user (ENS name or address)');
  log('  export <user> <file>   Export user data to JSON file');
  log('  clear <user>      Delete all data for a user');
  log('  clear-pattern <pattern>   Delete keys matching pattern from remote KV');
  log('  clear-local       Delete local development storage (.wrangler/state)');
  log('\nFlags:', colors.cyan);
  log('  --local           Use local KV storage (for "npm run preview")');
  log('  --env=preview     Use preview KV namespace (default)');
  log('  --env=production  Use production KV namespace (requires extra confirmation)');
  log('  --verbose         Show full data in inspect command');
  log('\nExamples:', colors.cyan);
  log('  kv-manager list --local                    # List users in local dev storage');
  log('  kv-manager clear allanniemerg.eth --local  # Clear local dev data');
  log('  kv-manager inspect vitalik.eth --verbose   # Inspect remote KV');
  log('  kv-manager export alice.eth backup.json --local');
  log('  kv-manager clear vitalik.eth --env=production');
  log('  kv-manager clear-local                     # Alternative to clear all local data');
  log('');
}

// Main
async function main() {
  const { command, params, flags } = parseArgs();

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  const env = flags.env;
  const useLocal = flags.local || false;

  if (!['preview', 'production'].includes(env)) {
    error('Invalid environment. Use --env=preview or --env=production');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'list':
        cmdList(env, useLocal);
        break;

      case 'inspect':
        if (params.length < 1) {
          error('Usage: kv-manager inspect <user> [--verbose] [--local]');
          process.exit(1);
        }
        cmdInspect(params[0], env, flags.verbose, useLocal);
        break;

      case 'export':
        if (params.length < 2) {
          error('Usage: kv-manager export <user> <file> [--local]');
          process.exit(1);
        }
        cmdExport(params[0], params[1], env, useLocal);
        break;

      case 'clear':
        if (params.length < 1) {
          error('Usage: kv-manager clear <user> [--local]');
          process.exit(1);
        }
        await cmdClear(params[0], env, useLocal);
        break;

      case 'clear-pattern':
        if (params.length < 1) {
          error('Usage: kv-manager clear-pattern <pattern> [--local]');
          process.exit(1);
        }
        await cmdClearPattern(params[0], env);
        break;

      case 'clear-local':
        await cmdClearLocal();
        break;

      default:
        error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    error(`Command failed: ${err.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };
