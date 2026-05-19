#!/usr/bin/env node

/**
 * Token Generator - Create access tokens for jurors
 *
 * Usage:
 *   npm run tokens -- generate <count> [--env=preview|production] [--dry-run]
 *   npm run tokens -- list [--env=preview|production]
 *
 * Examples:
 *   npm run tokens -- generate 50               # Generate 50 tokens in preview KV
 *   npm run tokens -- generate 50 --dry-run     # Preview CSV without writing to KV
 *   npm run tokens -- generate 50 --env=production
 *   npm run tokens -- list                      # List all existing tokens
 */

const { execSync } = require('child_process')

const KV_NAMESPACES = {
  preview: '221e8a16f90a4ae8bf4025f471d4c31c',
  production: 'd5dc344ae45b41b88f0f0ae11cefa8ba'
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1 (ambiguous)

function generateToken() {
  const bytes = require('crypto').randomBytes(20)
  let token = ''
  for (let i = 0; i < 20; i++) {
    token += CHARS[bytes[i] % CHARS.length]
  }
  // Format as XXXXX-XXXXX-XXXXX-XXXXX
  return `${token.slice(0,5)}-${token.slice(5,10)}-${token.slice(10,15)}-${token.slice(15,20)}`
}

function kvPut(key, value, env) {
  const nsId = KV_NAMESPACES[env]
  const flag = env === 'production' ? '--remote' : '--preview --remote'
  const escaped = JSON.stringify(JSON.stringify(value))
  execSync(
    `wrangler kv key put --namespace-id=${nsId} ${flag} "${key}" ${escaped}`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
}

function kvList(env) {
  const nsId = KV_NAMESPACES[env]
  const flag = env === 'production' ? '--remote' : '--preview --remote'
  try {
    const out = execSync(
      `wrangler kv key list --namespace-id=${nsId} ${flag} --prefix="token:"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    return JSON.parse(out.trim())
  } catch (e) {
    return []
  }
}

function kvGet(key, env) {
  const nsId = KV_NAMESPACES[env]
  const flag = env === 'production' ? '--remote' : '--preview --remote'
  try {
    const out = execSync(
      `wrangler kv key get --namespace-id=${nsId} ${flag} "${key}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    return JSON.parse(out.trim())
  } catch (e) {
    return null
  }
}

function getExistingCount(env) {
  const keys = kvList(env)
  return keys.length
}

async function cmdGenerate(count, env, dryRun) {
  console.error(`Generating ${count} tokens for ${env} environment${dryRun ? ' (dry run)' : ''}...`)

  const startIndex = dryRun ? 1 : getExistingCount(env) + 1

  const rows = [['token', 'userId', 'label']]

  for (let i = 0; i < count; i++) {
    const token = generateToken()
    const index = startIndex + i
    const userId = `juror-${String(index).padStart(3, '0')}`
    const label = `Juror ${index}`

    rows.push([token, userId, label])

    if (!dryRun) {
      kvPut(`token:${token}`, { userId, label, createdAt: new Date().toISOString() }, env)
      // Reverse lookup so kv-manager can find token users by userId
      kvPut(`user:${userId}:profile`, {
        ensName: label,
        address: userId,
        isTokenAuth: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      }, env)
      process.stderr.write(`  ${index}/${startIndex + count - 1}\r`)
    }
  }

  if (!dryRun) console.error(`\nWrote ${count} tokens to KV.`)

  // Print CSV to stdout
  rows.forEach(row => console.log(row.join(',')))
}

function cmdList(env) {
  const keys = kvList(env)
  const tokenKeys = keys.filter(k => k.name && k.name.startsWith('token:'))

  if (tokenKeys.length === 0) {
    console.error('No tokens found.')
    return
  }

  console.log(`token,userId,label,createdAt`)
  for (const { name } of tokenKeys) {
    const data = kvGet(name, env)
    if (data) {
      const tokenValue = name.replace('token:', '')
      console.log(`${tokenValue},${data.userId},${data.label},${data.createdAt}`)
    }
  }
}

const args = process.argv.slice(2)
const command = args[0]
const params = args.slice(1).filter(a => !a.startsWith('--'))
const flags = {}
args.forEach(a => {
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=')
    flags[k] = v || true
  }
})
const env = flags.env || 'preview'
const dryRun = !!flags['dry-run']

if (command === 'generate') {
  const count = parseInt(params[0])
  if (!count || count < 1) {
    console.error('Usage: npm run tokens -- generate <count>')
    process.exit(1)
  }
  cmdGenerate(count, env, dryRun)
} else if (command === 'list') {
  cmdList(env)
} else {
  console.error('Usage: npm run tokens -- generate <count> | list')
  process.exit(1)
}
