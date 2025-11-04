// ELO Dataset Helper Functions
// These functions operate on the ELO_PROJECTS data from eloDataset.js
// NOTE: eloDataset.js is auto-generated, so all functions live here instead

import { ELO_PROJECTS } from './eloDataset'

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

// Get random projects for originality assessment (no duplicates)
export function getRandomProjectsForOriginality(count = 3) {
  const shuffled = [...ELO_PROJECTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
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
