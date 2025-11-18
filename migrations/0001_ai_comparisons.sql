-- AI Comparison Analysis Database Schema
-- Stores AI-generated pairwise comparison recommendations for projects
--
-- Design principles:
-- 1. Normalized storage: repo_a < repo_b (alphabetically) - one record per pair
-- 2. Multi-model support: Same pair can have analysis from different models
-- 3. Choice is relative to normalized order (1 = repo_a wins, 2 = repo_b wins)
-- 4. When API receives repos in different order, we denormalize the response

CREATE TABLE IF NOT EXISTS ai_comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_a TEXT NOT NULL,           -- Normalized: alphabetically first repo
  repo_b TEXT NOT NULL,           -- Normalized: alphabetically second repo
  model TEXT NOT NULL,            -- Model identifier (e.g., 'Nalla-1')
  choice INTEGER NOT NULL,        -- 1 = repo_a is better, 2 = repo_b is better
  multiplier REAL NOT NULL,       -- How many times more valuable (e.g., 1.25, 10.0)
  final_reasoning TEXT NOT NULL,  -- AI's explanation for the comparison
  created_at TEXT NOT NULL,       -- ISO timestamp of when record was created
  UNIQUE(repo_a, repo_b, model)   -- One analysis per pair per model
);

-- Index for fast lookup by repo pair
CREATE INDEX IF NOT EXISTS idx_repos ON ai_comparisons(repo_a, repo_b);

-- Index for fast lookup by model (for checking if model is populated)
CREATE INDEX IF NOT EXISTS idx_model ON ai_comparisons(model);

-- Compound index for the most common query pattern
CREATE INDEX IF NOT EXISTS idx_repos_model ON ai_comparisons(repo_a, repo_b, model);
