# AI Comparison Suggestions - Setup Guide

This guide explains how to set up and use the AI comparison suggestions feature.

## Overview

The AI comparison suggestions feature displays AI-generated pairwise comparison recommendations to jurors during the evaluation process. The system:

- Stores AI analysis in a Cloudflare D1 (SQLite) database
- Normalizes repo pairs (alphabetically) for efficient storage
- Displays recommendations per model with expandable reasoning
- Supports multiple AI models (currently: Nalla-1)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Data Flow                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  design/ai-comparisons.json                            │
│         │                                               │
│         ▼                                               │
│  populate-ai-comparisons.js                            │
│    (normalizes pairs)                                   │
│         │                                               │
│         ▼                                               │
│  Cloudflare D1 Database                                │
│  (ai_comparisons table)                                 │
│         │                                               │
│         ▼                                               │
│  /api/comparison-analysis                              │
│  (denormalizes for request)                             │
│         │                                               │
│         ▼                                               │
│  AIComparisonPanel Component                           │
│  (displays in ComparisonScreen)                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Create the D1 Database

Run the setup script to create the database and schema:

```bash
# For preview environment (local development)
npm run setup-ai-db:preview

# For production environment
npm run setup-ai-db
```

This will:
- Create a new D1 database
- Run the schema migration (`migrations/0001_ai_comparisons.sql`)
- Output database IDs for `wrangler.jsonc`

**Important:** Copy the database IDs from the output and update `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "AI_COMPARISONS",
      "database_name": "ai-comparisons",
      "database_id": "YOUR_PRODUCTION_DB_ID",    // Replace this
      "preview_id": "YOUR_PREVIEW_DB_ID"         // Replace this
    }
  ],
  "env": {
    "preview": {
      "d1_databases": [
        {
          "binding": "AI_COMPARISONS",
          "database_name": "ai-comparisons-preview",
          "database_id": "YOUR_PREVIEW_DB_ID"    // Replace this
        }
      ]
    }
  }
}
```

### 2. Prepare Your AI Comparison Data

Your data file should be in this format:

```json
[
  {
    "repo_a": "lambdaclass/ethrex",
    "repo_b": "argotorg/act",
    "prediction": {
      "choice": 1,                    // 1 = repo_a wins, 2 = repo_b wins
      "multiplier": 1.25,             // How many times more valuable
      "final_reasoning": "..."        // AI's explanation
    }
  },
  ...
]
```

Place this file in the `design/` folder, e.g., `design/ai-comparisons-nalla-1.json`

### 3. Populate the Database

Run the population script to load data into D1:

```bash
# For preview environment (local development)
npm run populate-ai-comparisons design/ai-comparisons-nalla-1.json --model=Nalla-1 --env=preview

# For production environment
npm run populate-ai-comparisons design/ai-comparisons-nalla-1.json --model=Nalla-1 --env=production
```

**Options:**
- `--model=<name>`: Model identifier (default: Nalla-1)
- `--env=<env>`: Environment - preview or production (default: preview)
- `--force`: Force repopulation even if data exists

**What it does:**
1. Checks if model is already populated (skips if yes, unless `--force`)
2. Normalizes repo pairs alphabetically
3. Inserts data in batches of 100
4. Handles conflicts (updates if pair already exists)

### 4. Test Locally

Start the development server:

```bash
npm run preview
```

Navigate to a comparison screen - you should see the AI comparison panel below the project summaries.

## Database Schema

```sql
CREATE TABLE ai_comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_a TEXT NOT NULL,           -- Normalized: alphabetically first
  repo_b TEXT NOT NULL,           -- Normalized: alphabetically second
  model TEXT NOT NULL,            -- Model identifier (e.g., 'Nalla-1')
  choice INTEGER NOT NULL,        -- 1 = repo_a wins, 2 = repo_b wins
  multiplier REAL NOT NULL,       -- Multiplier value
  final_reasoning TEXT NOT NULL,  -- AI explanation
  created_at TEXT NOT NULL,
  UNIQUE(repo_a, repo_b, model)
);
```

**Key Design:**
- Repos stored in alphabetical order (`repo_a < repo_b`)
- One record per pair per model
- Choice relative to stored order (API denormalizes for response)

## API Usage

### Fetch Comparison Analysis

```
GET /api/comparison-analysis?repo_a=ethereum/go-ethereum&repo_b=a16z/halmos
```

**Parameters:**
- `repo_a`: First repository (required)
- `repo_b`: Second repository (required)
- `model`: Model identifier (optional, returns all models if omitted)

**Response (all models):**
```json
[
  {
    "model": "Nalla-1",
    "winner": "ethereum/go-ethereum",
    "choice": 1,
    "multiplier": 10.0,
    "final_reasoning": "..."
  }
]
```

**Response (single model):**
```json
{
  "model": "Nalla-1",
  "winner": "ethereum/go-ethereum",
  "choice": 1,
  "multiplier": 10.0,
  "final_reasoning": "..."
}
```

## UI Component

The `AIComparisonPanel` component:

- Fetches analysis for current repo pair
- Displays one row per model
- Shows: Model name, Winner (shortened), Multiplier
- Expandable reasoning per model
- Hides if no analysis available
- Styled with yellow/amber theme to distinguish from other panels

## Adding New Models

To add a new AI model:

1. Generate comparison data in the same JSON format
2. Run population script with new model name:
   ```bash
   npm run populate-ai-comparisons design/ai-comparisons-new-model.json --model=NewModel-1
   ```
3. The UI automatically displays all models

## Data Normalization

**Why normalize?** To avoid duplicate storage and ensure consistent lookups.

**How it works:**
1. **Storage**: Repos always stored alphabetically
   - `repo_a < repo_b`
   - If data has `repo_b < repo_a`, we swap and flip choice
2. **Lookup**: API normalizes request pairs before querying
3. **Response**: API denormalizes results relative to request order

**Example:**

Data file:
```json
{
  "repo_a": "z-org/project",
  "repo_b": "a-org/project",
  "prediction": { "choice": 1, "multiplier": 2.0 }
}
```

Stored in database:
```sql
-- Swapped because "a-org/project" < "z-org/project"
repo_a = "a-org/project"
repo_b = "z-org/project"
choice = 2  -- Flipped: was 1, now 2
```

API request:
```
GET /api/comparison-analysis?repo_a=z-org/project&repo_b=a-org/project
```

API response:
```json
{
  "winner": "z-org/project",
  "choice": 1,  // Flipped back to match request order
  "multiplier": 2.0
}
```

## Troubleshooting

### Panel not showing

1. Check browser console for errors
2. Verify D1 binding in `wrangler.jsonc`
3. Check database is populated:
   ```bash
   npx wrangler d1 execute ai-comparisons-preview --local --command="SELECT COUNT(*) FROM ai_comparisons"
   ```

### Database not found

- Ensure you ran `npm run setup-ai-db:preview`
- Check `wrangler.jsonc` has correct database IDs
- Try rebuilding: `npm run build`

### Data not populating

- Check JSON file format matches expected structure
- Try with `--force` flag to override existing data
- Check wrangler output for SQL errors

### API returns empty array

- Verify repos exist in database
- Check repo names match exactly (case-sensitive)
- Try direct database query:
  ```bash
  npx wrangler d1 execute ai-comparisons-preview --local --command="SELECT * FROM ai_comparisons LIMIT 5"
  ```

## Files Reference

- **Schema**: `migrations/0001_ai_comparisons.sql`
- **Setup Script**: `scripts/setup-ai-comparisons-db.js`
- **Population Script**: `scripts/populate-ai-comparisons.js`
- **Helpers**: `src/lib/aiComparisonHelpers.js`
- **API Route**: `src/app/api/comparison-analysis/route.js`
- **UI Component**: `src/components/AIComparisonPanel.jsx`
- **Integration**: `src/components/ComparisonScreen.jsx`

## Production Deployment

When deploying to production:

1. Create production D1 database:
   ```bash
   npm run setup-ai-db
   ```

2. Update `wrangler.jsonc` with production database ID

3. Populate production database:
   ```bash
   npm run populate-ai-comparisons design/ai-comparisons-nalla-1.json --model=Nalla-1 --env=production
   ```

4. Deploy application:
   ```bash
   npm run deploy
   ```

## Cost Considerations

**Cloudflare D1 Free Tier:**
- 5 GB storage
- 5 million reads/day
- 100k writes/day

**Estimated usage:**
- ~10k comparison pairs × 3 models = 30k rows
- Average row size: ~2 KB (with reasoning text)
- Total storage: ~60 MB
- Reads per juror session: ~30 (10 comparisons × 3 API calls)
- 1000 jurors/day = 30k reads/day

✅ Well within free tier limits
