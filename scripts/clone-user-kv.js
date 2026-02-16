#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Clone user KV data across environments with optional address remapping.
 *
 * Examples:
 *   node scripts/clone-user-kv.js --source-env=production --target-env=preview \
 *     --source=devansh.voicedeck.eth --target=allanniemerg.eth --dry-run
 *
 *   node scripts/clone-user-kv.js --source-env=production --target-env=preview \
 *     --source=devansh.voicedeck.eth --target=allanniemerg.eth --execute
 *
 * Defaults:
 *   --dry-run
 *   Excludes profile + ENS reverse mapping keys
 */

const fs = require('fs');
const { execSync } = require('child_process');

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value !== undefined ? value : true;
    }
  }
  return flags;
}

function loadWranglerConfig() {
  const wranglerContent = fs.readFileSync('./wrangler.jsonc', 'utf8');
  const wranglerJson = wranglerContent
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(wranglerJson);
}

function namespaceIdForEnv(env, wranglerConfig) {
  const kv = (wranglerConfig.kv_namespaces && wranglerConfig.kv_namespaces[0]) || null;
  if (!kv) throw new Error('No kv_namespaces in wrangler.jsonc');
  if (env === 'production') return kv.id;
  if (env === 'preview') return kv.preview_id;
  throw new Error(`Unsupported env: ${env}`);
}

function execWrangler(cmd) {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function listKeys(namespaceId, env) {
  const storageFlag = env === 'preview' ? '--preview --remote' : '--remote';
  const out = execWrangler(`wrangler kv key list --namespace-id=${namespaceId} ${storageFlag}`);
  if (!out) return [];
  return JSON.parse(out).map(k => k.name);
}

function getKey(namespaceId, env, key) {
  const storageFlag = env === 'preview' ? '--preview --remote' : '--remote';
  try {
    const out = execWrangler(`wrangler kv key get "${key}" --namespace-id=${namespaceId} ${storageFlag}`);
    try {
      return JSON.parse(out);
    } catch {
      return out;
    }
  } catch {
    return null;
  }
}

function putKey(namespaceId, env, key, value) {
  const storageFlag = env === 'preview' ? '--preview --remote' : '--remote';
  const valueJson = JSON.stringify(value).replace(/'/g, "\\'");
  execWrangler(`wrangler kv key put "${key}" '${valueJson}' --namespace-id=${namespaceId} ${storageFlag}`);
}

function resolveEnsToAddress(namespaceId, env, ensOrAddress) {
  if (!ensOrAddress) return null;
  if (ensOrAddress.startsWith('0x')) return ensOrAddress.toLowerCase();
  const lookup = getKey(namespaceId, env, `ens:${ensOrAddress}`);
  if (lookup && lookup.address) return String(lookup.address).toLowerCase();
  return null;
}

function main() {
  const flags = parseArgs();

  const sourceEnv = flags['source-env'] || 'production';
  const targetEnv = flags['target-env'] || 'preview';
  const source = flags['source'];
  const target = flags['target'];
  const execute = !!flags['execute'];
  const dryRun = !execute || !!flags['dry-run'];
  const includeProfile = !!flags['include-profile'];
  const includeEnsReverse = !!flags['include-ens'];

  if (!source || !target) {
    console.error('Usage: node scripts/clone-user-kv.js --source=<ens|address> --target=<ens|address> [--source-env=production] [--target-env=preview] [--execute]');
    process.exit(1);
  }

  const wranglerConfig = loadWranglerConfig();
  const sourceNs = namespaceIdForEnv(sourceEnv, wranglerConfig);
  const targetNs = namespaceIdForEnv(targetEnv, wranglerConfig);

  const sourceAddress = resolveEnsToAddress(sourceNs, sourceEnv, source) || (source.startsWith('0x') ? source.toLowerCase() : null);
  const targetAddress = resolveEnsToAddress(targetNs, targetEnv, target) || (target.startsWith('0x') ? target.toLowerCase() : null);

  if (!sourceAddress) {
    console.error(`Could not resolve source "${source}" in ${sourceEnv}. Ensure ENS mapping exists or pass 0x address.`);
    process.exit(1);
  }
  if (!targetAddress) {
    console.error(`Could not resolve target "${target}" in ${targetEnv}. Ensure ENS mapping exists or pass 0x address.`);
    process.exit(1);
  }

  console.log(`Source: ${source} -> ${sourceAddress} (${sourceEnv})`);
  console.log(`Target: ${target} -> ${targetAddress} (${targetEnv})`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`Include profile: ${includeProfile ? 'yes' : 'no'}`);
  console.log(`Include ens reverse: ${includeEnsReverse ? 'yes' : 'no'}`);

  const allKeys = listKeys(sourceNs, sourceEnv);
  const userKeys = allKeys.filter(k => k.startsWith(`user:${sourceAddress}:`));

  const filteredKeys = userKeys.filter(k => {
    if (!includeProfile && k === `user:${sourceAddress}:profile`) return false;
    return true;
  });

  if (filteredKeys.length === 0) {
    console.log('No user keys found to copy.');
    return;
  }

  console.log(`Found ${filteredKeys.length} keys to copy.`);

  // Build mapping: replace source address with target address in key name
  const mappings = filteredKeys.map(k => ({
    from: k,
    to: k.replace(`user:${sourceAddress}:`, `user:${targetAddress}:`)
  }));

  // Optionally include ENS reverse mapping (ens:<name>) if requested
  if (includeEnsReverse && !dryRun) {
    console.log('Note: include-ens requested, but ENS reverse mapping is managed by login. Consider leaving this off.');
  }

  if (dryRun) {
    console.log('Sample key mappings:');
    mappings.slice(0, 5).forEach(m => console.log(`  ${m.from} -> ${m.to}`));
    console.log('Dry-run complete. Use --execute to apply.');
    return;
  }

  let success = 0;
  for (const { from, to } of mappings) {
    const value = getKey(sourceNs, sourceEnv, from);
    if (value == null) continue;
    putKey(targetNs, targetEnv, to, value);
    success++;
  }

  console.log(`Copied ${success}/${mappings.length} keys.`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
