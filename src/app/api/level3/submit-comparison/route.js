import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { cookies } from 'next/headers'

/**
 * Submit a Level 3 comparison result
 * POST /api/level3/submit-comparison
 * Body: {
 *   repoUrl: string,
 *   comparisonIndex: number,
 *   depA: string,
 *   depB: string,
 *   multiplier: number,
 *   userAgrees: boolean
 * }
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession(cookieStore, sessionOptions)

    // Check authentication
    if (!session.user?.address || !session.user?.ensName) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { repoUrl, comparisonIndex, depA, depB, multiplier, userAgrees } = await req.json()

    if (!repoUrl || comparisonIndex === undefined || !depA || !depB || multiplier === undefined || userAgrees === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()

    // Create comparison result
    const comparison = {
      repoUrl,
      comparisonIndex,
      depA,
      depB,
      multiplier,
      userAgrees,
      timestamp: new Date().toISOString()
    }

    // Save comparison to KV
    const comparisonKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:comparisons`

    // Get existing comparisons
    const existingData = await kv.get(comparisonKey)
    const comparisons = existingData ? JSON.parse(existingData) : []

    // Add or update this comparison
    const existingIndex = comparisons.findIndex(c => c.comparisonIndex === comparisonIndex)
    if (existingIndex >= 0) {
      comparisons[existingIndex] = comparison
    } else {
      comparisons.push(comparison)
    }

    await kv.put(comparisonKey, JSON.stringify(comparisons))

    // Update plan progress
    const planKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:plan`
    const planData = await kv.get(planKey)

    if (planData) {
      const plan = JSON.parse(planData)
      plan.completedComparisons = comparisons.length
      await kv.put(planKey, JSON.stringify(plan))
    }

    console.log(`Level 3 comparison submitted by ${session.user.ensName}: ${depA} vs ${depB} (agrees: ${userAgrees})`)

    return Response.json({
      success: true,
      comparison,
      totalCompleted: comparisons.length
    })
  } catch (error) {
    console.error('Error submitting Level 3 comparison:', error)
    return Response.json({
      error: 'Failed to submit comparison',
      details: error.message
    }, { status: 500 })
  }
}
