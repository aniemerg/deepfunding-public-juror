/**
 * Seed Repos Dataset for Level 3
 *
 * Loads the seed repositories and their dependencies with AI-generated weights.
 * Data source: design/seedReposWithDependenciesAndWeights.json
 */

import seedReposData from '../data/seedReposWithDependenciesAndWeights.json'

/**
 * Get all seed repository URLs
 * @returns {string[]} Array of seed repo URLs (e.g., "https://github.com/ethereum/go-ethereum")
 */
export function getSeedRepoUrls() {
  return Object.keys(seedReposData).sort()
}

/**
 * Get seed repo info with basic metadata
 * @returns {Array<{url: string, name: string, owner: string, dependencyCount: number}>}
 */
export function getSeedRepos() {
  return getSeedRepoUrls().map(url => {
    const parts = url.replace('https://github.com/', '').split('/')
    return {
      url,
      owner: parts[0],
      name: parts[1],
      fullName: `${parts[0]}/${parts[1]}`,
      dependencyCount: Object.keys(seedReposData[url]).length
    }
  })
}

/**
 * Get dependencies for a specific seed repo
 * @param {string} repoUrl - The seed repo URL
 * @returns {Array<{url: string, name: string, owner: string, weight: number}>}
 */
export function getDependencies(repoUrl) {
  const deps = seedReposData[repoUrl]
  if (!deps) return []

  return Object.entries(deps)
    .map(([url, weight]) => {
      const parts = url.replace('https://github.com/', '').split('/')
      return {
        url,
        owner: parts[0],
        name: parts[1],
        fullName: `${parts[0]}/${parts[1]}`,
        weight
      }
    })
    .sort((a, b) => b.weight - a.weight) // Sort by weight descending
}

/**
 * Get the total number of seed repos
 * @returns {number}
 */
export function getSeedRepoCount() {
  return Object.keys(seedReposData).length
}

/**
 * Search seed repos by name (case-insensitive)
 * @param {string} query - Search query
 * @returns {Array<{url: string, name: string, owner: string, dependencyCount: number}>}
 */
export function searchSeedRepos(query) {
  if (!query || query.trim() === '') {
    return getSeedRepos()
  }

  const lowerQuery = query.toLowerCase()
  return getSeedRepos().filter(repo =>
    repo.fullName.toLowerCase().includes(lowerQuery) ||
    repo.name.toLowerCase().includes(lowerQuery) ||
    repo.owner.toLowerCase().includes(lowerQuery)
  )
}
