import { getCloudflareContext } from "@opennextjs/cloudflare";
import { normalizePair, denormalizeComparison } from '@/lib/aiComparisonHelpers';

/**
 * GET /api/comparison-analysis
 *
 * Fetch AI comparison analysis for a specific repo pair.
 * Accepts repos in any order and returns result relative to request order.
 *
 * Query parameters:
 *   - repo_a: First repository (e.g., "ethereum/go-ethereum")
 *   - repo_b: Second repository (e.g., "a16z/halmos")
 *   - model: (optional) Model identifier (default: all models)
 *
 * Returns:
 *   - Single model: { model, winner, choice, multiplier, final_reasoning }
 *   - All models: [{ model, winner, choice, multiplier, final_reasoning }, ...]
 *   - Empty array if no analysis found
 *
 * Examples:
 *   GET /api/comparison-analysis?repo_a=ethereum/go-ethereum&repo_b=a16z/halmos
 *   GET /api/comparison-analysis?repo_a=ethereum/go-ethereum&repo_b=a16z/halmos&model=Nalla-1
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedRepoA = searchParams.get('repo_a');
  const requestedRepoB = searchParams.get('repo_b');
  const requestedModel = searchParams.get('model');

  // Validate required parameters
  if (!requestedRepoA || !requestedRepoB) {
    return new Response(
      JSON.stringify({
        error: 'Missing required parameters: repo_a and repo_b'
      }),
      {
        status: 400,
        headers: { 'content-type': 'application/json' }
      }
    );
  }

  try {
    // Get D1 database binding
    const db = getCloudflareContext().env.AI_COMPARISONS;

    if (!db) {
      console.error('AI_COMPARISONS D1 binding not found');
      return new Response(
        JSON.stringify({
          error: 'Database not configured'
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // Normalize repo pair for lookup
    const { repo_a, repo_b, wasSwapped } = normalizePair(requestedRepoA, requestedRepoB);

    // Query database
    let query;
    let params;

    if (requestedModel) {
      // Single model query
      query = `
        SELECT repo_a, repo_b, model, choice, multiplier, final_reasoning
        FROM ai_comparisons
        WHERE repo_a = ? AND repo_b = ? AND model = ?
        LIMIT 1
      `;
      params = [repo_a, repo_b, requestedModel];
    } else {
      // All models query
      query = `
        SELECT repo_a, repo_b, model, choice, multiplier, final_reasoning
        FROM ai_comparisons
        WHERE repo_a = ? AND repo_b = ?
        ORDER BY model ASC
      `;
      params = [repo_a, repo_b];
    }

    const result = await db.prepare(query).bind(...params).all();

    // Handle empty results
    if (!result.results || result.results.length === 0) {
      return new Response(
        JSON.stringify([]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // Denormalize results for response
    const denormalized = result.results.map(stored =>
      denormalizeComparison(stored, wasSwapped, requestedRepoA, requestedRepoB)
    );

    // Return single object for single model, array for all models
    const responseData = requestedModel && denormalized.length === 1
      ? denormalized[0]
      : denormalized;

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error fetching comparison analysis:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch comparison analysis',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
}
