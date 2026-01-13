import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { cookies } from 'next/headers'

/**
 * Get evaluation state for a repository
 * GET /api/level3/evaluation-state?repoUrl=...
 */
export async function GET(req) {
  try {
    const session = await getIronSession(await cookies(), sessionOptions)

    // Check authentication
    if (!session.user?.address) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const repoUrl = searchParams.get('repoUrl')

    if (!repoUrl) {
      return Response.json({ error: 'Repository URL required' }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()

    // Get plan
    const planKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:plan`
    const planData = await kv.get(planKey)
    const plan = planData ? JSON.parse(planData) : null

    // Get completed comparisons
    const comparisonKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:comparisons`
    const comparisonData = await kv.get(comparisonKey)
    const comparisons = comparisonData ? JSON.parse(comparisonData) : []

    // Get completion status for each comparison (includes skip status)
    const completionStatus = {}
    if (plan) {
      for (let i = 0; i < plan.comparisons.length; i++) {
        const screenId = `comparison_${i}`
        const completedKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:completed:${screenId}`
        const completedData = await kv.get(completedKey)

        if (completedData) {
          const parsed = JSON.parse(completedData)
          completionStatus[screenId] = {
            completed: parsed.completed,
            wasSkipped: parsed.wasSkipped || false,
            timestamp: parsed.timestamp
          }
        }
      }
    }

    return Response.json({
      plan,
      comparisons,
      completionStatus,
      hasData: !!plan
    })
  } catch (error) {
    console.error('Error getting Level 3 evaluation state:', error)
    return Response.json({
      error: 'Failed to get evaluation state',
      details: error.message
    }, { status: 500 })
  }
}
