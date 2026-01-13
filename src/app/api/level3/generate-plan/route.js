import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { cookies } from 'next/headers'
import { getDependencies } from '@/lib/comprehensiveDependencyDataset'
import { generateComparisons, calculateComparisonCount, generatePlanId } from '@/lib/comparisonGenerator'

/**
 * Generate evaluation plan for a repository
 * POST /api/level3/generate-plan
 * Body: { repoUrl: string, planNumber?: number }
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession(cookieStore, sessionOptions)

    // Check authentication
    if (!session.user?.address) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { repoUrl, planNumber = 0 } = await req.json()

    if (!repoUrl) {
      return Response.json({ error: 'Repository URL required' }, { status: 400 })
    }

    // Get dependencies for this repository
    const dependencies = getDependencies(repoUrl)

    if (!dependencies || dependencies.length < 2) {
      return Response.json({
        error: 'Repository has insufficient dependencies for evaluation',
        dependencyCount: dependencies?.length || 0
      }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()
    const kvKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:plan`

    // Check if a plan already exists
    const existingPlanData = await kv.get(kvKey)
    let plan

    if (existingPlanData && planNumber > 0) {
      // Append more comparisons to existing plan
      const existingPlan = JSON.parse(existingPlanData)

      // Generate 10 more comparisons, avoiding duplicates
      const newComparisons = generateComparisons(dependencies, 10, existingPlan.comparisons)

      // Append to existing comparisons
      plan = {
        ...existingPlan,
        planNumber,
        comparisons: [...existingPlan.comparisons, ...newComparisons],
        totalComparisons: existingPlan.comparisons.length + newComparisons.length,
        updatedAt: new Date().toISOString()
      }

      console.log(`Appended ${newComparisons.length} more comparisons to existing plan for ${session.user.ensName || userAddress}: ${repoUrl} (now ${plan.totalComparisons} total)`)
    } else {
      // Create new plan
      const comparisonCount = calculateComparisonCount(dependencies.length)
      const comparisons = generateComparisons(dependencies, comparisonCount)

      plan = {
        planId: generatePlanId(repoUrl, planNumber),
        repoUrl,
        planNumber,
        comparisons,
        totalComparisons: comparisons.length,
        completedComparisons: 0,
        createdAt: new Date().toISOString()
      }

      console.log(`Generated new Level 3 plan for ${session.user.ensName || userAddress}: ${repoUrl} (${comparisons.length} comparisons)`)
    }

    // Save plan to KV
    await kv.put(kvKey, JSON.stringify(plan))

    // Clear navigation cache to force refresh
    const navCacheKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:navigation-state`
    await kv.delete(navCacheKey)

    return Response.json({
      success: true,
      plan
    })
  } catch (error) {
    console.error('Error generating Level 3 plan:', error)
    return Response.json({
      error: 'Failed to generate evaluation plan',
      details: error.message
    }, { status: 500 })
  }
}
