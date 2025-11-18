/**
 * AI Comparison Helpers
 *
 * Utilities for normalizing and denormalizing AI comparison data.
 *
 * Key concepts:
 * - Normalized storage: repo_a < repo_b (alphabetically) in database
 * - Denormalized API: Accept repos in any order, return result relative to request
 * - Choice is relative: 1 = first repo wins, 2 = second repo wins
 */

/**
 * Normalize a comparison pair for storage
 * Always stores repos in alphabetical order, flipping choice if needed
 *
 * @param {object} raw - Raw comparison data
 * @param {string} raw.repo_a - First repo
 * @param {string} raw.repo_b - Second repo
 * @param {object} raw.prediction - Prediction object
 * @param {number} raw.prediction.choice - 1 or 2
 * @param {number} raw.prediction.multiplier - Multiplier value
 * @param {string} raw.prediction.final_reasoning - AI reasoning
 * @returns {object} Normalized comparison data
 */
export function normalizeComparison(raw) {
  const repoA = raw.repo_a;
  const repoB = raw.repo_b;
  const choice = raw.prediction.choice;

  // Normalize: alphabetically sort repos
  if (repoA < repoB) {
    // Already in correct order
    return {
      repo_a: repoA,
      repo_b: repoB,
      choice: choice,
      multiplier: raw.prediction.multiplier,
      final_reasoning: raw.prediction.final_reasoning
    };
  } else {
    // Swap repos and flip choice
    return {
      repo_a: repoB,  // Now alphabetically first
      repo_b: repoA,  // Now alphabetically second
      choice: choice === 1 ? 2 : 1,  // Flip choice
      multiplier: raw.prediction.multiplier,
      final_reasoning: raw.prediction.final_reasoning
    };
  }
}

/**
 * Normalize a repo pair for lookup
 * Returns repos in alphabetical order
 *
 * @param {string} repoA - First repo
 * @param {string} repoB - Second repo
 * @returns {object} { repo_a, repo_b, wasSwapped }
 */
export function normalizePair(repoA, repoB) {
  if (repoA < repoB) {
    return { repo_a: repoA, repo_b: repoB, wasSwapped: false };
  } else {
    return { repo_a: repoB, repo_b: repoA, wasSwapped: true };
  }
}

/**
 * Denormalize comparison result for API response
 * Converts stored data back to requested repo order
 *
 * @param {object} stored - Stored comparison from database
 * @param {boolean} wasSwapped - Whether the request order was swapped
 * @param {string} requestedRepoA - The repo_a from the request
 * @param {string} requestedRepoB - The repo_b from the request
 * @returns {object} Denormalized comparison for response
 */
export function denormalizeComparison(stored, wasSwapped, requestedRepoA, requestedRepoB) {
  if (!wasSwapped) {
    // Request order matches storage order
    return {
      model: stored.model,
      winner: stored.choice === 1 ? stored.repo_a : stored.repo_b,
      choice: stored.choice,
      multiplier: stored.multiplier,
      final_reasoning: stored.final_reasoning
    };
  } else {
    // Request order was swapped, flip choice back
    const flippedChoice = stored.choice === 1 ? 2 : 1;
    return {
      model: stored.model,
      winner: flippedChoice === 1 ? requestedRepoA : requestedRepoB,
      choice: flippedChoice,
      multiplier: stored.multiplier,
      final_reasoning: stored.final_reasoning
    };
  }
}

/**
 * Get the winner repo name from a comparison
 *
 * @param {object} comparison - Comparison object with choice
 * @param {string} repoA - First repo
 * @param {string} repoB - Second repo
 * @returns {string} Winner repo name
 */
export function getWinner(comparison, repoA, repoB) {
  return comparison.choice === 1 ? repoA : repoB;
}
