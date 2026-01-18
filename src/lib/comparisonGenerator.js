/**
 * Comparison Generation Algorithm for Level 3
 *
 * Generates pairwise comparisons for dependency evaluation using:
 * 1. Weighted random selection for first dependency (higher weight = higher probability)
 * 2. Distance-weighted selection for second dependency (adjacent in ranked list = higher probability)
 */

/**
 * Standard multiplier values for rounding
 */
const STANDARD_MULTIPLIERS = [
  1, 1.1, 1.2, 1.3, 1.5, 1.7, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 15, 20, 30, 50, 70, 100,
  150, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000
]

/**
 * Round a multiplier to the nearest standard value in log space
 * This ensures even spacing on a logarithmic scale
 * @param {number} value - The raw multiplier value
 * @returns {number} The nearest standard multiplier
 */
function roundToNearestMultiplierLogSpace(value) {
  if (value <= 0) return STANDARD_MULTIPLIERS[0]

  const logValue = Math.log(value)
  let closestMultiplier = STANDARD_MULTIPLIERS[0]
  let minDiff = Math.abs(Math.log(STANDARD_MULTIPLIERS[0]) - logValue)

  for (const multiplier of STANDARD_MULTIPLIERS) {
    const diff = Math.abs(Math.log(multiplier) - logValue)
    if (diff < minDiff) {
      minDiff = diff
      closestMultiplier = multiplier
    }
  }

  return closestMultiplier
}

/**
 * Weighted random selection from an array
 * @param {Array<{weight: number}>} items - Items with weights
 * @param {Array<number>} weights - Optional pre-computed weights array
 * @returns {number} Selected index
 */
function weightedRandomIndex(items, weights = null) {
  const w = weights || items.map(item => item.weight)
  const totalWeight = w.reduce((sum, weight) => sum + weight, 0)

  let random = Math.random() * totalWeight

  for (let i = 0; i < w.length; i++) {
    random -= w[i]
    if (random <= 0) {
      return i
    }
  }

  return w.length - 1 // Fallback
}

/**
 * Calculate probability weights based on distance in sorted list
 * Higher probability for closer dependencies (adjacent = highest)
 * @param {number} fromIndex - Index of first dependency
 * @param {number} totalCount - Total number of dependencies
 * @returns {Array<number>} Probability weights for each position
 */
function calculateDistanceWeights(fromIndex, totalCount) {
  const weights = []

  for (let i = 0; i < totalCount; i++) {
    if (i === fromIndex) {
      weights.push(0) // Can't compare with self
    } else {
      const distance = Math.abs(i - fromIndex)
      // Inverse distance weighting: closer = higher weight
      // Using 1/(distance + 0.5) to avoid division by zero and give very high weight to adjacent
      weights.push(1 / (distance + 0.5))
    }
  }

  return weights
}

/**
 * Generate comparison pairs for a repository
 * @param {Array<{url: string, weight: number}>} dependencies - Sorted dependencies (by weight_rank)
 * @param {number} targetCount - Target number of comparisons (default 10)
 * @param {Array<{depA: string, depB: string}>} existingComparisons - Optional existing comparisons to avoid duplicates
 * @returns {Array<{depA: string, depB: string, multiplier: number}>} Comparison pairs
 */
export function generateComparisons(dependencies, targetCount = 10, existingComparisons = []) {
  if (!dependencies || dependencies.length < 2) {
    return []
  }

  // Scale down for small repos: n deps = (n-1) comparisons at minimum
  const maxPossibleComparisons = dependencies.length - 1
  const comparisonCount = Math.min(targetCount, maxPossibleComparisons)

  const comparisons = []
  const usedPairs = new Set()

  // Add existing comparison pairs to usedPairs set to avoid duplicates
  existingComparisons.forEach(comp => {
    // Find indices of these dependencies
    const indexA = dependencies.findIndex(d => d.url === comp.depA)
    const indexB = dependencies.findIndex(d => d.url === comp.depB)

    if (indexA !== -1 && indexB !== -1) {
      // Create canonical pair key (smaller index first)
      const pairKey = indexA < indexB ? `${indexA}-${indexB}` : `${indexB}-${indexA}`
      usedPairs.add(pairKey)
    }
  })

  // Pre-compute weights for first selection (use actual dependency weights)
  const selectionWeights = dependencies.map(d => d.weight)

  let attempts = 0
  const maxAttempts = comparisonCount * 10 // Prevent infinite loop

  while (comparisons.length < comparisonCount && attempts < maxAttempts) {
    attempts++

    // Step 1: Select first dependency using weight-based probability
    const firstIndex = weightedRandomIndex(dependencies, selectionWeights)

    // Step 2: Select second dependency using distance-based probability
    const distanceWeights = calculateDistanceWeights(firstIndex, dependencies.length)
    const secondIndex = weightedRandomIndex(dependencies, distanceWeights)

    // Create canonical pair key (always smaller index first)
    const pairKey = firstIndex < secondIndex
      ? `${firstIndex}-${secondIndex}`
      : `${secondIndex}-${firstIndex}`

    // Skip if we've already generated this pair
    if (usedPairs.has(pairKey)) {
      continue
    }

    usedPairs.add(pairKey)

    const depA = dependencies[firstIndex]
    const depB = dependencies[secondIndex]

    // Calculate multiplier (weight ratio)
    const multiplier = depA.weight / depB.weight

    // Determine which dependency should be A (higher weight) and B (lower weight)
    // For consistent statement format: "A is X× more valuable than B"
    if (multiplier >= 1) {
      comparisons.push({
        depA: depA.url,
        depB: depB.url,
        multiplier: roundToNearestMultiplierLogSpace(multiplier)
      })
    } else {
      // Flip if B is actually heavier
      comparisons.push({
        depA: depB.url,
        depB: depA.url,
        multiplier: roundToNearestMultiplierLogSpace(1 / multiplier)
      })
    }
  }

  return comparisons
}

/**
 * Calculate how many comparisons should be generated for a repo
 * @param {number} dependencyCount - Number of dependencies
 * @param {number} baseCount - Base comparison count (default 10)
 * @returns {number} Number of comparisons to generate
 */
export function calculateComparisonCount(dependencyCount, baseCount = 10) {
  if (dependencyCount < 2) return 0

  // Scale down for small repos
  // 2 deps = 1 comparison
  // 3 deps = 2 comparisons
  // 4-10 deps = gradual scale up
  // 11+ deps = full baseCount (10)

  if (dependencyCount === 2) return 1
  if (dependencyCount === 3) return 2
  if (dependencyCount <= 10) {
    return Math.min(dependencyCount - 1, baseCount)
  }

  return baseCount
}

/**
 * Generate a plan ID for tracking
 * @param {string} repoUrl - Repository URL
 * @param {number} planNumber - Plan iteration (0 for first, 1 for second batch, etc.)
 * @returns {string} Plan ID
 */
export function generatePlanId(repoUrl, planNumber = 0) {
  const repoName = repoUrl.replace('https://github.com/', '').replace(/\//g, '_')
  const timestamp = Date.now()
  return `${repoName}_plan${planNumber}_${timestamp}`
}
