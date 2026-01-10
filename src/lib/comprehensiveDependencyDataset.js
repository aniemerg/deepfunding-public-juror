/**
 * Comprehensive Dependency Dataset for Level 3
 *
 * Provides access to repository and dependency data with programmatically
 * generated descriptions based on usage analysis.
 *
 * Data source: design/comprehensive_dependency_data.json
 */

import comprehensiveData from '../data/comprehensive_dependency_data.json'

/**
 * Generate a concise description from usage_summary
 */
function generateDescription(usageSummary) {
  if (!usageSummary) return 'No usage information available.'

  const parts = []

  // Start with usage class
  const usageClass = usageSummary.usage_class
  if (usageClass === 'Pervasive') {
    parts.push('Critical infrastructure used throughout the project.')
  } else if (usageClass === 'RuntimeFeature' || usageClass === 'FeatureFocused') {
    parts.push('Core runtime functionality.')
  } else if (usageClass === 'SinglePoint') {
    parts.push('Focused functionality for specific use cases.')
  } else if (usageClass === 'Utility') {
    parts.push('Utility providing specific features.')
  } else if (usageClass === 'DevExperience' || usageClass === 'Dev_experience') {
    parts.push('Development tooling and developer experience.')
  } else if (usageClass === 'Build Tooling' || usageClass === 'Build_tooling' || usageClass === 'build_tooling') {
    parts.push('Build and compilation tooling.')
  } else if (usageClass === 'test_support') {
    parts.push('Test support and testing infrastructure.')
  } else if (usageClass === 'Unused') {
    parts.push('Currently unused in the project.')
  }

  // Add primary role description
  if (usageSummary.usage_roles && usageSummary.usage_roles.length > 0) {
    const primaryRole = usageSummary.usage_roles[0]
    if (primaryRole.description) {
      parts.push(primaryRole.description)
    }
  }

  // Add context about where it's used
  const contexts = []
  if (usageSummary.appears_in_runtime_code) contexts.push('runtime')
  if (usageSummary.appears_in_test_code) contexts.push('tests')
  if (usageSummary.appears_in_build_or_docs) contexts.push('build/docs')

  if (contexts.length > 0) {
    parts.push(`Used in ${contexts.join(', ')}.`)
  }

  return parts.join(' ')
}

/**
 * Get repository data by URL
 * @param {string} repoUrl - Full GitHub URL
 * @returns {object|null} Repository data with summary and dependencies
 */
export function getRepository(repoUrl) {
  return comprehensiveData.repositories[repoUrl] || null
}

/**
 * Get all repository URLs
 * @returns {string[]} Array of repository URLs
 */
export function getRepositoryUrls() {
  return Object.keys(comprehensiveData.repositories).sort()
}

/**
 * Get repository summary
 * @param {string} repoUrl - Full GitHub URL
 * @returns {object|null} Repository summary (purpose, capabilities, etc.)
 */
export function getRepositorySummary(repoUrl) {
  const repo = getRepository(repoUrl)
  return repo?.repo_summary || null
}

/**
 * Get dependencies for a repository
 * @param {string} repoUrl - Full GitHub URL
 * @returns {Array} Array of dependency objects with URLs and data
 */
export function getDependencies(repoUrl) {
  const repo = getRepository(repoUrl)
  if (!repo || !repo.dependencies) return []

  return Object.entries(repo.dependencies)
    .map(([depUrl, depData]) => ({
      url: depUrl,
      name: depUrl.replace('https://github.com/', ''),
      weight: depData.weight,
      weight_rank: depData.weight_rank,
      usage_summary: depData.usage_summary,
      description: generateDescription(depData.usage_summary)
    }))
    .sort((a, b) => a.weight_rank - b.weight_rank)
}

/**
 * Get a specific dependency from a repository
 * @param {string} repoUrl - Parent repository URL
 * @param {string} depUrl - Dependency URL
 * @returns {object|null} Dependency data with generated description
 */
export function getDependency(repoUrl, depUrl) {
  const repo = getRepository(repoUrl)
  if (!repo || !repo.dependencies || !repo.dependencies[depUrl]) return null

  const depData = repo.dependencies[depUrl]
  return {
    url: depUrl,
    name: depUrl.replace('https://github.com/', ''),
    weight: depData.weight,
    weight_rank: depData.weight_rank,
    usage_summary: depData.usage_summary,
    description: generateDescription(depData.usage_summary)
  }
}

/**
 * Get expandable detail information for a dependency
 * @param {object} usageSummary - The usage_summary object
 * @returns {object} Formatted detail information
 */
export function getDependencyDetails(usageSummary) {
  if (!usageSummary) return null

  const contexts = []
  if (usageSummary.appears_in_runtime_code) contexts.push('Runtime code')
  if (usageSummary.appears_in_test_code) contexts.push('Test code')
  if (usageSummary.appears_in_build_or_docs) contexts.push('Build/Docs')

  return {
    usageClass: usageSummary.usage_class,
    contexts,
    roles: usageSummary.usage_roles?.map(r => r.role_name) || [],
    responsibilities: usageSummary.responsibilities_provided_by_dependency || []
  }
}

/**
 * Get metadata about the dataset
 * @returns {object} Metadata
 */
export function getMetadata() {
  return comprehensiveData.metadata
}
