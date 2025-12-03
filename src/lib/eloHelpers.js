// ELO Dataset Helper Functions
// These functions operate on the ELO_PROJECTS data from eloDataset.js
// NOTE: eloDataset.js is auto-generated, so all functions live here instead

import { ELO_PROJECTS } from './eloDataset'

// Re-export ELO_PROJECTS for use in other modules
export { ELO_PROJECTS }

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

// === Repo Selection Functions ===

// Generate initial repo selection (10 projects including locked ones)
export function getInitialRepoSelection(mostValuableRepo, leastValuableRepo) {
  const mostValuable = getProjectByRepo(mostValuableRepo);
  const leastValuable = getProjectByRepo(leastValuableRepo);

  if (!mostValuable || !leastValuable) {
    console.error('Invalid repos for initial selection:', mostValuableRepo, leastValuableRepo);
    return [];
  }

  // Start with the locked projects
  const selected = [mostValuable, leastValuable];

  // Get 8 more random projects (excluding the locked ones)
  const available = ELO_PROJECTS.filter(p =>
    p.repo !== mostValuableRepo && p.repo !== leastValuableRepo
  );

  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const additional = shuffled.slice(0, 8);

  return [...selected, ...additional];
}

// Get a random project excluding specific repos
export function getRandomRepoExcluding(excludeRepos = []) {
  const available = ELO_PROJECTS.filter(p => !excludeRepos.includes(p.repo));

  if (available.length === 0) {
    console.error('No available repos after exclusion');
    return null;
  }

  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

// Get random pair from a list of selected repos
export function getRandomPairFrom(selectedRepos) {
  if (!selectedRepos || selectedRepos.length < 2) {
    console.error('Need at least 2 repos for pair selection');
    return null;
  }

  // If selectedRepos is array of project objects, use directly
  // If array of strings (repo names), convert to project objects
  const projects = selectedRepos[0]?.repo
    ? selectedRepos
    : selectedRepos.map(repo => getProjectByRepo(repo)).filter(p => p);

  if (projects.length < 2) {
    console.error('Not enough valid projects for pair');
    return null;
  }

  const shuffled = [...projects].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

// Get diverse pair (different weight ranges) from selected repos
export function getDiversePairFrom(selectedRepos) {
  if (!selectedRepos || selectedRepos.length < 2) {
    console.error('Need at least 2 repos for diverse pair');
    return null;
  }

  // Convert to project objects if needed
  const projects = selectedRepos[0]?.repo
    ? selectedRepos
    : selectedRepos.map(repo => getProjectByRepo(repo)).filter(p => p);

  if (projects.length < 2) {
    console.error('Not enough valid projects for diverse pair');
    return null;
  }

  // Sort by weight
  const sorted = [...projects].sort((a, b) => b.weight - a.weight);

  // If less than 4 projects, just return random pair
  if (sorted.length < 4) {
    return [sorted[0], sorted[sorted.length - 1]];
  }

  // Split into top and bottom halves
  const midpoint = Math.floor(sorted.length / 2);
  const topHalf = sorted.slice(0, midpoint);
  const bottomHalf = sorted.slice(midpoint);

  const project1 = topHalf[Math.floor(Math.random() * topHalf.length)];
  const project2 = bottomHalf[Math.floor(Math.random() * bottomHalf.length)];

  return [project1, project2];
}

// Generate N unique comparison pairs from selected repos (no duplicates)
export function generateUniquePairs(selectedRepos, count) {
  if (!selectedRepos || selectedRepos.length < 2) {
    console.error('Need at least 2 repos for pair generation');
    return [];
  }

  // Convert to project objects if needed
  const projects = selectedRepos[0]?.repo
    ? selectedRepos
    : selectedRepos.map(repo => getProjectByRepo(repo)).filter(p => p);

  if (projects.length < 2) {
    console.error('Not enough valid projects for pairs');
    return [];
  }

  const pairs = [];
  const usedPairKeys = new Set();  // Track "repoA|repoB" (sorted alphabetically)
  const maxAttempts = count * 10;  // Prevent infinite loops
  let attempts = 0;

  while (pairs.length < count && attempts < maxAttempts) {
    attempts++;

    // Shuffle and pick two random projects
    const shuffled = [...projects].sort(() => Math.random() - 0.5);
    const pair = [shuffled[0], shuffled[1]];

    // Create canonical key (sorted to treat A-B same as B-A)
    const pairKey = [pair[0].repo, pair[1].repo].sort().join('|');

    if (!usedPairKeys.has(pairKey)) {
      usedPairKeys.add(pairKey);
      pairs.push(pair);
    }
  }

  if (pairs.length < count) {
    console.warn(`Could only generate ${pairs.length} unique pairs out of ${count} requested`);
  }

  return pairs;
}

// Get random projects for originality from selected repos
export function getRandomProjectsForOriginalityFrom(selectedRepos, count = 3) {
  if (!selectedRepos || selectedRepos.length < count) {
    console.error(`Need at least ${count} repos for originality selection`);
    return [];
  }

  // Convert to project objects if needed
  const projects = selectedRepos[0]?.repo
    ? selectedRepos
    : selectedRepos.map(repo => getProjectByRepo(repo)).filter(p => p);

  if (projects.length < count) {
    console.error('Not enough valid projects for originality');
    return projects; // Return what we have
  }

  const shuffled = [...projects].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Get initial repo selection from top 3 projects (locked) + 7 random
export function getInitialRepoSelectionFromTopProjects(topThreeRepos) {
  // Validate input
  if (!topThreeRepos || topThreeRepos.length !== 3) {
    console.error('Invalid top three repos:', topThreeRepos);
    // Fallback: return 10 random projects
    const shuffled = [...ELO_PROJECTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
  }

  // Convert repo names to project objects if needed
  const lockedProjects = topThreeRepos.map(repo => {
    return typeof repo === 'string' ? getProjectByRepo(repo) : repo;
  }).filter(p => p);

  if (lockedProjects.length !== 3) {
    console.error('Could not find all three projects');
    // Fallback: return 10 random projects
    const shuffled = [...ELO_PROJECTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
  }

  // Get 7 more random projects (excluding the locked three)
  const excludeRepos = lockedProjects.map(p => p.repo);
  const available = ELO_PROJECTS.filter(p => !excludeRepos.includes(p.repo));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const additionalProjects = shuffled.slice(0, 7);

  return [...lockedProjects, ...additionalProjects];
}
