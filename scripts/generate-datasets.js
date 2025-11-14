#!/usr/bin/env node

/**
 * Generate all dataset files from design folder sources
 * This script reads raw data files and converts them to optimized JavaScript modules
 * for use in the application, ensuring they're properly bundled and available at runtime.
 */

const fs = require('fs');
const path = require('path');

// Dataset generators configuration
const DATASETS = [
  {
    name: 'ELO Projects',
    sourceFile: 'design/elo.csv',
    outputFile: 'src/lib/eloDataset.js',
    generator: generateEloDataset
  },
  {
    name: 'Project Summaries',
    sourcePattern: 'design/improved_project_summaries_*.json',
    outputFile: 'src/lib/projectSummariesDataset.js',
    generator: generateProjectSummariesDataset
  }
];

// Main execution
console.log('🔨 Generating datasets...\n');
let successCount = 0;

for (const dataset of DATASETS) {
  try {
    const result = dataset.generator(dataset);
    console.log(`✓ ${dataset.name}`);
    console.log(`  ${result.summary}`);
    console.log(`  Output: ${dataset.outputFile}\n`);
    successCount++;
  } catch (error) {
    console.error(`✗ ${dataset.name} failed:`);
    console.error(`  ${error.message}\n`);
  }
}

console.log(`\n✨ Generated ${successCount}/${DATASETS.length} datasets successfully`);

// Generator functions

function generateEloDataset({ sourceFile, outputFile }) {
  const csvPath = path.join(process.cwd(), sourceFile);
  const csvData = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV (skip header row)
  const lines = csvData.trim().split('\n').slice(1);
  const projects = lines.map(line => {
    const [competition_id, method, rank, repo, weight] = line.split(',');
    return {
      rank: parseInt(rank),
      repo: repo.trim(),
      weight: parseFloat(weight),
      competition: competition_id?.trim(),
      method: method?.trim()
    };
  }).sort((a, b) => a.rank - b.rank);

  const jsContent = `// ELO Dataset - Project Rankings Data
// Auto-generated from ${sourceFile} - DO NOT EDIT MANUALLY
// Run 'npm run generate-datasets' to regenerate this file
//
// NOTE: All helper functions are in eloHelpers.js to prevent them from being overwritten

export const ELO_PROJECTS = ${JSON.stringify(projects, null, 2)};
`;

  const outputPath = path.join(process.cwd(), outputFile);
  fs.writeFileSync(outputPath, jsContent);

  return {
    summary: `${projects.length} projects, top: ${projects[0]?.repo} (${(projects[0]?.weight * 100).toFixed(2)}%)`
  };
}

function generateProjectSummariesDataset({ sourcePattern, outputFile }) {
  // Find the matching file (glob pattern)
  const designDir = path.join(process.cwd(), 'design');
  const files = fs.readdirSync(designDir);
  const pattern = sourcePattern.split('/')[1]; // Get filename pattern
  const regex = new RegExp(pattern.replace('*', '.*'));

  const matchingFile = files.find(f => regex.test(f));
  if (!matchingFile) {
    throw new Error(`No file matching pattern ${sourcePattern} found`);
  }

  const jsonPath = path.join(designDir, matchingFile);
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const jsContent = `// Project Summaries Dataset
// Auto-generated from ${path.join('design', matchingFile)} - DO NOT EDIT MANUALLY
// Run 'npm run generate-datasets' to regenerate this file

export const PROJECT_SUMMARIES = ${JSON.stringify(jsonData, null, 2)};
`;

  const outputPath = path.join(process.cwd(), outputFile);
  fs.writeFileSync(outputPath, jsContent);

  const projectCount = Object.keys(jsonData).length;
  const firstProject = Object.keys(jsonData)[0];

  return {
    summary: `${projectCount} projects with summaries, source: ${matchingFile}`
  };
}
