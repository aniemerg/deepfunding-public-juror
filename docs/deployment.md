# Production Deployment Guide

## Overview

This project uses Cloudflare Pages with OpenNext adapter. It maintains separate preview and production environments with isolated KV storage and Google Sheets.

## Architecture

```
Preview Environment (Local Testing):
  npm run preview
  ├─ KV: b79510138ca54452aee6b452ff9da6c3 (preview)
  ├─ Sheet: 1QhLRYm4CmsnzqMFu66ZDyaagdFv0pmpoh5Kc5Ovarkw (DEV)
  └─ URL: http://localhost:8787

Production Environment (Deployed):
  npm run deploy
  ├─ KV: bb994681332349a7b2178fe586e023f8 (production)
  ├─ Sheet: 1pm2ealBZ27Aeq5fL39aNQ2ezdldeyaGmzQbrdTeuQA8 (PROD)
  └─ URL: https://deepfunding-jury-scoring.pages.dev
```

## First-Time Production Setup

### Step 1: Set All Environment Variables

Run these commands to configure production environment variables:

```bash
# Set environment to production
npx wrangler pages secret put CLOUDFLARE_ENV --project-name=deepfunding-jury-scoring
# Enter: production

# Google Sheets - Production
npx wrangler pages secret put GOOGLE_SHEET_ID_PRODUCTION --project-name=deepfunding-jury-scoring
# Enter: 1pm2ealBZ27Aeq5fL39aNQ2ezdldeyaGmzQbrdTeuQA8

# Google Sheets - Preview (for consistency)
npx wrangler pages secret put GOOGLE_SHEET_ID_PREVIEW --project-name=deepfunding-jury-scoring
# Enter: 1QhLRYm4CmsnzqMFu66ZDyaagdFv0pmpoh5Kc5Ovarkw

# Google Service Account
npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --project-name=deepfunding-jury-scoring
# Enter: je-service-account@juror-evaluation.iam.gserviceaccount.com

npx wrangler pages secret put GOOGLE_PRIVATE_KEY --project-name=deepfunding-jury-scoring
# Paste: -----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg... (entire key with \n for newlines)

# Session Secret (Generate new for production!)
npx wrangler pages secret put SESSION_SECRET --project-name=deepfunding-jury-scoring
# Enter: <new-random-32+-character-string>

# Optional
npx wrangler pages secret put NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID --project-name=deepfunding-jury-scoring
# Enter: your-walletconnect-project-id

npx wrangler pages secret put ENABLE_INVITE_CODES --project-name=deepfunding-jury-scoring
# Enter: true or false
```

### Step 2: Verify Configuration

Check that all secrets are set:

```bash
npx wrangler pages secret list --project-name=deepfunding-jury-scoring
```

Should show:
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
# Build and deploy
npm run build    # OpenNext build
npm run deploy   # Deploy to Cloudflare Pages
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

### Deploy to Production

```bash
# 1. Ensure all tests pass locally
npm run preview
# ... test thoroughly ...

# 2. Build for production
npm run build

# 3. Deploy
npm run deploy

# 4. Verify production (optional)
# Visit: https://deepfunding-jury-scoring.pages.dev
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

- **Production**: https://deepfunding-jury-scoring.pages.dev
- **Cloudflare Dashboard**: https://dash.cloudflare.com/pages/view/deepfunding-jury-scoring
- **Preview Sheet**: https://docs.google.com/spreadsheets/d/1QhLRYm4CmsnzqMFu66ZDyaagdFv0pmpoh5Kc5Ovarkw
- **Production Sheet**: https://docs.google.com/spreadsheets/d/1pm2ealBZ27Aeq5fL39aNQ2ezdldeyaGmzQbrdTeuQA8
