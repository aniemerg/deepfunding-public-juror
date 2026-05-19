#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Find users whose repo_selection draft exists but has empty selections.
 *
 * Usage:
 *   node scripts/find-empty-repo-selection.js --env=production
 *   node scripts/find-empty-repo-selection.js --env=preview
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

function extractAddressFromKey(key) {
  const match = key.match(/^user:([^:]+):/);
  return match ? match[1] : null;
}

function isEmptyRepoSelection(value) {
  const data = value && value.data ? value.data : null;
  if (!data) return false;
  const initial = Array.isArray(data.initialRepos) ? data.initialRepos.length : 0;
  const final = Array.isArray(data.finalSelectedRepos) ? data.finalSelectedRepos.length : 0;
  return initial === 0 && final === 0;
}

function main() {
  const flags = parseArgs();
  const env = flags.env || 'production';

  const wranglerConfig = loadWranglerConfig();
  const ns = namespaceIdForEnv(env, wranglerConfig);

  console.log(`Scanning ${env} KV for empty repo_selection drafts...`);

  const allKeys = listKeys(ns, env);
  const repoSelectionKeys = allKeys.filter(k => k.endsWith(':repo_selection:repo-selection'));

  const results = [];

  for (const key of repoSelectionKeys) {
    const value = getKey(ns, env, key);
    if (!value) continue;
    if (!isEmptyRepoSelection(value)) continue;

    const address = extractAddressFromKey(key);
    const profileKey = `user:${address}:profile`;
    const profile = getKey(ns, env, profileKey);
    const ens = profile && profile.ensName ? profile.ensName : null;

    results.push({
      address,
      ensName: ens,
      updatedAt: value.updatedAt || null,
      status: value.status || null,
      lockedRepos: value.data && Array.isArray(value.data.lockedReposFromTopProjects) ? value.data.lockedReposFromTopProjects : []
    });
  }

  console.log(`Found ${results.length} affected user(s).`);
  if (results.length === 0) return;

  console.log('\nENS\tAddress\tUpdatedAt\tStatus\tLockedRepos');
  for (const r of results) {
    const locked = r.lockedRepos && r.lockedRepos.length ? r.lockedRepos.join(',') : '';
    console.log(`${r.ensName || '-'}\t${r.address}\t${r.updatedAt || '-'}\t${r.status || '-'}\t${locked}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
