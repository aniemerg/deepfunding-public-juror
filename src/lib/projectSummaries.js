// Project summaries imported from generated dataset
import { PROJECT_SUMMARIES } from './projectSummariesDataset'
import { ELO_PROJECTS } from './eloHelpers'

// Helper to get GitHub URL for a repo
export function getGitHubUrl(repo) {
  return `https://github.com/${repo}`;
}

// Helper to get project by repo name
export function getProjectWithSummary(repo) {
  const data = PROJECT_SUMMARIES[repo];
  if (!data) return null;

  return {
    repo: repo,
    summary: data.summary,
    rank: data.rank,
    githubUrl: getGitHubUrl(repo)
  };
}

// Get all projects in order (matches ELO_PROJECTS order from eloHelpers.js)
export function getAllProjectsWithSummaries() {
  return ELO_PROJECTS.map(project => {
    const summaryData = PROJECT_SUMMARIES[project.repo];
    return {
      ...project,
      summary: summaryData?.summary || '',
      rank: summaryData?.rank || 0,
      githubUrl: getGitHubUrl(project.repo)
    };
  });
}
