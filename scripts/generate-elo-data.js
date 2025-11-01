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

// Generate JavaScript file
const jsContent = `// ELO Dataset Management for Project Selection
// Auto-generated from design/elo.csv - DO NOT EDIT MANUALLY
// Run 'npm run generate-elo' to regenerate this file

export const ELO_PROJECTS = ${JSON.stringify(projects, null, 2)};

// Get all projects as an array of repo names
export function getAllProjects() {
  return ELO_PROJECTS.map(p => p.repo);
}

// Get project by repo name
export function getProjectByRepo(repo) {
  return ELO_PROJECTS.find(p => p.repo === repo);
}

// Get projects sorted by weight (highest first)
export function getProjectsByWeight() {
  return [...ELO_PROJECTS].sort((a, b) => b.weight - a.weight);
}

// Get top N projects by weight
export function getTopProjects(n = 10) {
  return getProjectsByWeight().slice(0, n);
}

// Get bottom N projects by weight
export function getBottomProjects(n = 10) {
  return getProjectsByWeight().slice(-n).reverse();
}

// Get projects similar in weight to a given project
export function getSimilarProjects(repo, maxRatio = 2.0, count = 5) {
  const targetProject = getProjectByRepo(repo);
  if (!targetProject) return [];

  const targetWeight = targetProject.weight;

  return ELO_PROJECTS
    .filter(p => p.repo !== repo)
    .map(p => ({
      ...p,
      ratio: Math.max(p.weight / targetWeight, targetWeight / p.weight)
    }))
    .filter(p => p.ratio <= maxRatio)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, count);
}

// Get random project
export function getRandomProject() {
  const index = Math.floor(Math.random() * ELO_PROJECTS.length);
  return ELO_PROJECTS[index];
}

// Get random pair of projects for comparison
export function getRandomPair() {
  const shuffled = [...ELO_PROJECTS].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

// Get a diverse pair (different weight ranges) for comparison
export function getDiversePair() {
  const sorted = getProjectsByWeight();
  const topHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const bottomHalf = sorted.slice(Math.floor(sorted.length / 2));

  const project1 = topHalf[Math.floor(Math.random() * topHalf.length)];
  const project2 = bottomHalf[Math.floor(Math.random() * bottomHalf.length)];

  return [project1, project2];
}

// Calculate expected funding percentage for a project
export function getFundingPercentage(repo) {
  const project = getProjectByRepo(repo);
  if (!project) return 0;
  return (project.weight * 100).toFixed(2);
}

// Format repo name for display
export function formatRepoName(repo) {
  return repo.split('/')[1] || repo;
}

// Get project display name with org
export function getProjectDisplayName(repo) {
  return repo;
}
`;

// Write to output file
const outputPath = path.join(process.cwd(), 'src', 'lib', 'eloDataset.js');
fs.writeFileSync(outputPath, jsContent);

console.log(`✓ Generated src/lib/eloDataset.js with ${projects.length} projects`);
console.log(`  Top project: ${projects[0]?.repo} (${(projects[0]?.weight * 100).toFixed(2)}%)`);
console.log(`  Source: design/elo.csv`);
