# AI Comparison Data

This directory contains AI-generated pairwise comparison analysis for project evaluation.

## File Format

Each file contains comparison data from a specific AI model:

- **Filename**: `{ModelName}.json` (e.g., `Nalla-1.json`)
- **Format**: JSON array of comparison objects
- **Git LFS**: Files are tracked with Git LFS due to size (~40-50MB)

## Data Structure

```json
[
  {
    "repo_a": "owner/repo-name",
    "repo_b": "owner/other-repo",
    "prediction": {
      "choice": 1,                    // 1 = repo_a wins, 2 = repo_b wins
      "multiplier": 1.25,             // Value multiplier
      "final_reasoning": "..."        // AI's explanation
    },
    "suggested_choice": 1,            // (unused - for reference only)
    "suggested_multiplier": 1.27,     // (unused - for reference only)
    "suggested_tick": 1.25,           // (unused - for reference only)
    "raw_response": "...",            // (unused - for reference only)
    "timestamp": "2025-11-18..."      // (unused - for reference only)
  }
]
```

## Current Models

- **Nalla-1.json** - Primary AI comparison model

## Usage

To populate the database with this data:

```bash
npm run populate-ai-comparisons data/ai-comparisons/Nalla-1.json --model=Nalla-1 --env=preview
```

## Adding New Models

1. Place new model data file in this directory: `data/ai-comparisons/NewModel.json`
2. Run population script:
   ```bash
   npm run populate-ai-comparisons data/ai-comparisons/NewModel.json --model=NewModel --env=preview
   ```
3. The UI will automatically display the new model

## Git LFS

These files are tracked with Git LFS. After cloning:

```bash
git lfs pull
```

To verify LFS is working:

```bash
git lfs ls-files
```

## File Size

- Each model file: ~40-50MB
- Compressed in Git LFS
- Not loaded into application bundle (database only)
