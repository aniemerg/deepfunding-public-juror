# Development Scripts

## KV Manager

A CLI tool for managing Cloudflare KV data during development and debugging.

### ⚠️ Important: Local vs Remote Storage

This project uses **two separate storage systems**:

1. **Local Development Storage** (`npm run preview`)
   - Location: `.wrangler/state/v3/kv/`
   - Uses Miniflare SQLite databases
   - Fast, no network latency
   - Cleared with: `npm run kv -- clear-local`

2. **Remote Cloudflare KV** (preview & production)
   - Cloud storage accessed with `--remote` flag
   - Persistent across sessions
   - Managed with: `list`, `inspect`, `clear`, etc.

**When developing locally with `npm run preview`, you're using local storage, not remote KV.**

### Usage

```bash
# Using npm script (recommended)
npm run kv -- list
npm run kv -- inspect vitalik.eth --verbose
npm run kv -- clear alice.eth
npm run kv -- clear-local  # Clear local dev storage

# Direct execution
./scripts/kv-manager.js list
node scripts/kv-manager.js inspect vitalik.eth
```

### Commands

#### `list` - Show all users in KV
```bash
npm run kv -- list [--env=preview|production]
```
Lists all users with their ENS names, addresses, key counts, and last activity.

#### `inspect` - View user data
```bash
npm run kv -- inspect <user> [--verbose] [--env=preview|production]
```
Shows a summary of user's data. Use `--verbose` for full data dump.
- `<user>` can be an ENS name (e.g., `vitalik.eth`) or Ethereum address

#### `export` - Save user data to JSON
```bash
npm run kv -- export <user> <filename> [--env=preview|production]
```
Exports all data for a user to a JSON file for backup or analysis.

Example:
```bash
npm run kv -- export vitalik.eth backup-2025-11-01.json
```

#### `clear` - Delete all user data
```bash
npm run kv -- clear <user> [--env=preview|production]
```
Deletes ALL data for a user. Requires confirmation. Use for testing fresh states.

**Warning**: This is destructive and cannot be undone!

#### `clear-pattern` - Delete keys matching pattern
```bash
npm run kv -- clear-pattern <pattern> [--env=preview|production]
```
Deletes keys matching a pattern (supports `*` wildcard). Use for surgical deletion.

Examples:
```bash
# Clear just background data for a user
npm run kv -- clear-pattern "user:0x742d35cc6634c0532925a3b844bc454e9e1ee421:background:*"

# Clear all navigation state
npm run kv -- clear-pattern "user:*:navigation:*"
```

#### `clear-local` - Clear local development storage
```bash
npm run kv -- clear-local
```
Deletes local development storage in `.wrangler/state`. Use this to clear data from `npm run preview`.

**This does NOT affect remote Cloudflare KV (preview or production).**

Example:
```bash
# Clear local dev storage to test fresh user flow
npm run kv -- clear-local
```

### Flags

- `--env=preview` - Use preview KV namespace (default)
- `--env=production` - Use production KV namespace (requires extra confirmation)
- `--verbose` - Show full data in inspect command

### ENS Resolution

The tool automatically resolves ENS names to Ethereum addresses using a public RPC endpoint. You can use either format:

- **ENS name**: `vitalik.eth`, `alice.eth`
- **Ethereum address**: `0x742d35cc6634c0532925a3b844bc454e9e1ee421`

### Safety Features

1. **Confirmation prompts**: All destructive operations require explicit confirmation
2. **Production safeguards**: Extra confirmation required when using `--env=production`
3. **Preview by default**: Always uses preview environment unless explicitly specified
4. **Pattern preview**: Shows which keys will be deleted before confirmation

### Examples

```bash
# List all users in remote preview KV
npm run kv -- list

# Inspect your own data in remote KV
npm run kv -- inspect yourname.eth

# See full data dump
npm run kv -- inspect yourname.eth --verbose

# Export data for backup
npm run kv -- export yourname.eth backup.json

# Clear your data from remote KV to test fresh
npm run kv -- clear yourname.eth

# Clear LOCAL dev storage (for npm run preview)
npm run kv -- clear-local

# Work with production data (use carefully!)
npm run kv -- list --env=production
npm run kv -- inspect vitalik.eth --env=production

# Delete specific screen data
npm run kv -- clear-pattern "user:0x...:comparison_*:*"
```

### Debugging with Claude Code

This tool is designed to help both you and Claude Code debug state issues:

1. When reporting a bug, you can run `inspect` to see the current state
2. Export data to share exact state with Claude
3. Clear data to test fresh user flows
4. Claude can ask you to run specific commands to verify assumptions

Example debugging workflow:
```bash
# 1. See current state
npm run kv -- inspect yourname.eth --verbose > debug-state.txt

# 2. Share debug-state.txt with Claude
# 3. Clear data if needed
npm run kv -- clear yourname.eth

# 4. Test fresh flow
```

### Requirements

- Node.js 18+
- Wrangler CLI installed (`npm install` handles this)
- Cloudflare account credentials configured

### Technical Details

- Uses Wrangler CLI for KV operations with `--remote` flag to access actual Cloudflare KV
- ENS resolution from KV profile data (fast, no RPC calls needed)
- Colored terminal output for better readability
- Pattern matching with regex support
- JSON export/import capability

### Known Issues & Fixes

**Nov 4, 2025 Fix**: The tool now includes the `--remote` flag in all wrangler commands. Previously, wrangler would check local development storage instead of remote Cloudflare KV, causing the tool to report empty data even when keys existed. This has been resolved.
