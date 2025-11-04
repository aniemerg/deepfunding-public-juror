#!/usr/bin/env node

/**
 * Generate ELO dataset from CSV for use in application
 * Reads design/elo.csv and outputs src/lib/eloDataset.js
 */

const fs = require('fs');
const path = require('path');

// Read CSV file
const csvPath = path.join(process.cwd(), 'design', 'elo.csv');
const csvData = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV (skip header row)
const lines = csvData.trim().split('\n').slice(1);

const projects = lines.map(line => {
  // Parse: competition_id,method,rank,item,weight
  const [competition_id, method, rank, repo, weight] = line.split(',');
  return {
    rank: parseInt(rank),
    repo: repo.trim(),
    weight: parseFloat(weight),
    competition: competition_id?.trim(),
    method: method?.trim()
  };
}).sort((a, b) => a.rank - b.rank); // Ensure sorted by rank

// Generate JavaScript file with ONLY the data array
const jsContent = `// ELO Dataset - Project Rankings Data
// Auto-generated from design/elo.csv - DO NOT EDIT MANUALLY
// Run 'npm run generate-elo' to regenerate this file
//
// NOTE: All helper functions are in eloHelpers.js to prevent them from being overwritten

export const ELO_PROJECTS = ${JSON.stringify(projects, null, 2)};
`;

// Write to output file
const outputPath = path.join(process.cwd(), 'src', 'lib', 'eloDataset.js');
fs.writeFileSync(outputPath, jsContent);

console.log(`✓ Generated src/lib/eloDataset.js with ${projects.length} projects`);
console.log(`  Top project: ${projects[0]?.repo} (${(projects[0]?.weight * 100).toFixed(2)}%)`);
console.log(`  Source: design/elo.csv`);
