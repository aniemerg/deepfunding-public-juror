# Production Deployment Guide

## Overview

This project uses Cloudflare Workers with OpenNext adapter. It maintains separate preview and production environments with isolated KV storage and Google Sheets.

## Architecture

```
Local Preview (Development):
  npm run preview
  ├─ KV: Local storage (.wrangler/state/)
  ├─ Sheet: 1QhLRYm4CmsnzqMFu66ZDyaagdFv0pmpoh5Kc5Ovarkw (DEV)
  └─ URL: http://localhost:8787

Cloud Preview (Testing):
  npm run deploy:preview
  ├─ Worker: deepfunding-jury-scoring-preview
  ├─ KV: 221e8a16f90a4ae8bf4025f471d4c31c (preview)
  ├─ Sheet: 1QhLRYm4CmsnzqMFu66ZDyaagdFv0pmpoh5Kc5Ovarkw (DEV)
  └─ URL: https://deepfunding-jury-scoring-preview.<your-subdomain>.workers.dev

Production (Live):
  npm run deploy
  ├─ Worker: deepfunding-jury-scoring
  ├─ KV: d5dc344ae45b41b88f0f0ae11cefa8ba (production)
  ├─ Sheet: 1pm2ealBZ27Aeq5fL39aNQ2ezdldeyaGmzQbrdTeuQA8 (PROD)
  └─ URL: https://deepfunding-jury-scoring.<your-subdomain>.workers.dev
       OR custom domain if configured
```

## First-Time Production Setup

### Step 1: Set All Environment Variables

Run these commands to configure environment variables for both production and preview:

```bash
# PRODUCTION ENVIRONMENT SECRETS
# Set environment to production
npx wrangler secret put CLOUDFLARE_ENV
# Enter: production

# Google Sheets - Production
npx wrangler secret put GOOGLE_SHEET_ID_PRODUCTION
# Enter: 1pm2ealBZ27Aeq5fL39aNQ2ezdldeyaGmzQbrdTeuQA8

# Google Sheets - Preview (for consistency)
npx wrangler secret put GOOGLE_SHEET_ID_PREVIEW
# Enter: 1QhLRYm4CmsnzqMFu66ZDyaagdFv0pmpoh5Kc5Ovarkw

# Google Service Account
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
# Enter: je-service-account@juror-evaluation.iam.gserviceaccount.com

npx wrangler secret put GOOGLE_PRIVATE_KEY
# Paste: -----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg... (entire key with \n for newlines)

# Session Secret (Generate new for production!)
npx wrangler secret put SESSION_SECRET
# Enter: <new-random-32+-character-string>

# Optional
npx wrangler secret put NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
# Enter: your-walletconnect-project-id

npx wrangler secret put ENABLE_INVITE_CODES
# Enter: true or false

# PREVIEW ENVIRONMENT SECRETS (same secrets, but for preview worker)
# Repeat the same commands with --env preview flag
npx wrangler secret put CLOUDFLARE_ENV --env preview
# Enter: preview

npx wrangler secret put GOOGLE_SHEET_ID_PRODUCTION --env preview
npx wrangler secret put GOOGLE_SHEET_ID_PREVIEW --env preview
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --env preview
npx wrangler secret put GOOGLE_PRIVATE_KEY --env preview
npx wrangler secret put SESSION_SECRET --env preview
# ... repeat for other secrets
```

### Step 2: Verify Configuration

Check that all secrets are set for both environments:

```bash
# Production secrets
npx wrangler secret list

# Preview secrets
npx wrangler secret list --env preview
```

Should show for both:
- CLOUDFLARE_ENV
- GOOGLE_SHEET_ID_PRODUCTION
- GOOGLE_SHEET_ID_PREVIEW
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_PRIVATE_KEY
- SESSION_SECRET
- (optional) NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
- (optional) ENABLE_INVITE_CODES

### Step 3: Deploy

```bash
# Deploy to preview first
npm run deploy:preview   # Deploy to Cloudflare Workers (preview environment)

# Then deploy to production
npm run deploy           # Deploy to Cloudflare Workers (production environment)
```

## Development Workflow

### Local Testing (Preview Environment)

```bash
# 1. Start local preview (uses preview KV + preview sheet)
npm run preview

# 2. Test features
- Login with ENS
- Submit data
- Verify data in preview sheet

# 3. Check KV state
npm run kv -- list
npm run kv -- inspect yourname.eth

# 4. Clear test data if needed
npm run kv -- clear yourname.eth
```

### Deploy to Cloud Preview (Recommended for Testing)

```bash
# 1. Test locally first
npm run preview
# ... test thoroughly ...

# 2. Deploy to cloud preview environment
npm run deploy:preview

# 3. Test at preview URL
# Visit: https://deepfunding-jury-scoring-preview.<your-subdomain>.workers.dev
# This uses preview KV + preview Google Sheet (safe to test)

# 4. Check preview KV if needed
npm run kv -- list
npm run kv -- inspect yourname.eth
```

### Deploy to Production

```bash
# 1. Test in cloud preview first
npm run deploy:preview
# ... test at https://deepfunding-jury-scoring-preview.<your-subdomain>.workers.dev ...

# 2. Deploy to production
npm run deploy

# 3. Verify production
# Visit: https://deepfunding-jury-scoring.<your-subdomain>.workers.dev (or custom domain)
# Check production KV: npm run kv -- list --env=production
```

## Environment Variable Management

### Local (.dev.vars)
```bash
CLOUDFLARE_ENV=preview
GOOGLE_SHEET_ID_PREVIEW=1QhLRYm4...
GOOGLE_SHEET_ID_PRODUCTION=1pm2ealB...
# ... other vars
```

### Production (Cloudflare Pages Secrets)
Set via `npx wrangler pages secret put` commands above.

**Important:** Production uses `CLOUDFLARE_ENV=production` to automatically select production KV and sheet.

## Testing Production Configuration Locally (Advanced)

⚠️ **WARNING:** This will write to PRODUCTION sheet!

```bash
# Temporarily change .dev.vars
# Change: CLOUDFLARE_ENV=preview
# To:     CLOUDFLARE_ENV=production

npm run preview

# Test...

# REMEMBER TO CHANGE BACK:
# CLOUDFLARE_ENV=preview
```

**Better Approach:** Create a third "staging" sheet for pre-production testing.

## Deployment Checklist

Before deploying:

- [ ] All tests pass locally with `npm run preview`
- [ ] Preview KV cleared of test data
- [ ] Production environment variables are set
- [ ] Code changes committed to git
- [ ] CLAUDE.md and documentation updated
- [ ] Reviewed changes in this deployment

After deploying:

- [ ] Visit production URL and test login
- [ ] Verify production KV via: `npm run kv -- list --env=production`
- [ ] Check production Google Sheet for new session row
- [ ] Test one full evaluation flow end-to-end
- [ ] Monitor Cloudflare Pages logs for errors

## Rollback Plan

If production deploy has issues:

```bash
# Option 1: Rollback to previous deployment
npx wrangler pages deployment list --project-name=deepfunding-jury-scoring
# Note the previous deployment ID
npx wrangler pages deployment tail <previous-deployment-id> --project-name=deepfunding-jury-scoring

# Option 2: Fix and redeploy
# Fix the issue locally
npm run build
npm run deploy
```

## Monitoring

### Check Production Logs
```bash
npx wrangler pages deployment tail --project-name=deepfunding-jury-scoring
```

### Check Production KV
```bash
npm run kv -- list --env=production
npm run kv -- inspect <ens-name> --env=production
```

### Check Google Sheets
- Preview: https://docs.google.com/spreadsheets/d/1QhLRYm4CmsnzqMFu66ZDyaagdFv0pmpoh5Kc5Ovarkw
- Production: https://docs.google.com/spreadsheets/d/1pm2ealBZ27Aeq5fL39aNQ2ezdldeyaGmzQbrdTeuQA8

## Common Issues

### "Missing Google Sheet ID for environment"
- Check that `CLOUDFLARE_ENV` is set
- Verify the correct `GOOGLE_SHEET_ID_{PREVIEW|PRODUCTION}` is set
- Check spelling of environment variable names

### KV Data Not Persisting
- Verify KV namespace bindings in `wrangler.jsonc`
- Check that OpenNext build completed successfully
- Ensure you're using `npm run preview` (not `npm run dev`)

### Wrong Environment in Production
- Verify `CLOUDFLARE_ENV=production` is set in Cloudflare Pages secrets
- Check deployment logs for "Using Google Sheet for..." message
- Confirm production KV namespace ID in bindings

## URLs

- **Production Worker**: https://deepfunding-jury-scoring.<your-subdomain>.workers.dev
- **Preview Worker**: https://deepfunding-jury-scoring-preview.<your-subdomain>.workers.dev
- **Cloudflare Dashboard**: https://dash.cloudflare.com/ (Workers & Pages section)
- **Preview Sheet**: https://docs.google.com/spreadsheets/d/1QhLRYm4CmsnzqMFu66ZDyaagdFv0pmpoh5Kc5Ovarkw
- **Production Sheet**: https://docs.google.com/spreadsheets/d/1pm2ealBZ27Aeq5fL39aNQ2ezdldeyaGmzQbrdTeuQA8

**Note**: The `<your-subdomain>` will be your Cloudflare account subdomain. You'll see the actual URLs when you deploy.

## Deployment Summary

### Three Testing Environments

**1. Local Preview (`npm run preview`)**
- **Purpose**: Fast local development with production parity
- **URL**: http://localhost:8787
- **KV**: Local storage in `.wrangler/state/`
- **Sheet**: Preview Google Sheet (test data)
- **When to use**: Daily development, quick iterations
- **Data persistence**: Isolated to your machine

**2. Cloud Preview (`npm run deploy:preview`)**
- **Purpose**: Cloud-based testing before production
- **Worker**: deepfunding-jury-scoring-preview
- **URL**: https://deepfunding-jury-scoring-preview.<your-subdomain>.workers.dev
- **KV**: Cloudflare preview namespace (221e8a16...)
- **Sheet**: Preview Google Sheet (test data)
- **When to use**: Integration testing, sharing with team, testing in real cloud environment
- **Data persistence**: Shared cloud KV, safe to clear

**3. Production (`npm run deploy`)**
- **Purpose**: Live application for real jurors
- **Worker**: deepfunding-jury-scoring
- **URL**: https://deepfunding-jury-scoring.<your-subdomain>.workers.dev (or custom domain)
- **KV**: Cloudflare production namespace (d5dc344a...)
- **Sheet**: Production Google Sheet (permanent records)
- **When to use**: After thorough testing in cloud preview
- **Data persistence**: Protected, permanent juror data

### Recommended Workflow

```bash
# 1. Develop locally
npm run preview
# → Test at http://localhost:8787

# 2. Deploy to cloud preview
npm run deploy:preview
# → Test at https://deepfunding-jury-scoring-preview.<your-subdomain>.workers.dev
# → Share with team, test on mobile, verify cloud integration

# 3. Deploy to production (only after cloud preview testing)
npm run deploy
# → Live at https://deepfunding-jury-scoring.<your-subdomain>.workers.dev
```

### Environment Variable Configuration

Cloudflare Workers uses **named environments** configured in `wrangler.jsonc`:

- **Production worker** (`deepfunding-jury-scoring`): Uses secrets set without `--env` flag
- **Preview worker** (`deepfunding-jury-scoring-preview`): Uses secrets set with `--env preview` flag

Each environment maintains its own set of secrets. The `CLOUDFLARE_ENV` variable (set to `production` or `preview`) controls which KV namespace and Google Sheet to use within each worker.
