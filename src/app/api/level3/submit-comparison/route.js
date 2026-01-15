import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { cookies } from 'next/headers'
import { submitDependencyComparisonData } from '@/lib/googleSheets'

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

    const { repoUrl, comparisonIndex, depA, depB, multiplier, userAgrees, wasSkipped } = await req.json()

    // Validate required fields - allow skip without userAgrees
    if (!repoUrl || comparisonIndex === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // If not skipped, require comparison data
    if (!wasSkipped && (!depA || !depB || multiplier === undefined || userAgrees === undefined)) {
      return Response.json({ error: 'Missing required comparison fields' }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()

    // Create comparison result
    const comparison = {
      repoUrl,
      comparisonIndex,
      depA: depA || null,
      depB: depB || null,
      multiplier: multiplier || null,
      userAgrees: userAgrees !== undefined ? userAgrees : null,
      wasSkipped: wasSkipped || false,
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

    // Mark as completed in completion tracking (for navigation)
    const screenId = `comparison_${comparisonIndex}`
    const completedKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:completed:${screenId}`
    const inProgressKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:in-progress:${screenId}`

    await kv.delete(inProgressKey)
    await kv.put(completedKey, JSON.stringify({
      completed: true,
      wasSkipped: wasSkipped || false,
      timestamp: new Date().toISOString(),
      data: comparison
    }))

    // Clear navigation state cache to force refresh
    const navCacheKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:navigation-state`
    await kv.delete(navCacheKey)

    // Update plan progress
    const planKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:plan`
    const planData = await kv.get(planKey)

    if (planData) {
      const plan = JSON.parse(planData)
      plan.completedComparisons = comparisons.filter(c => !c.wasSkipped).length
      plan.skippedComparisons = comparisons.filter(c => c.wasSkipped).length
      await kv.put(planKey, JSON.stringify(plan))
    }

    const action = wasSkipped ? 'skipped' : `agreed: ${userAgrees}`
    console.log(`Level 3 comparison by ${session.user.ensName}: ${depA || '(skipped)'} vs ${depB || '(skipped)'} (${action})`)

    // Submit to Google Sheets
    try {
      await submitDependencyComparisonData(getCloudflareContext().env, {
        ensName: session.user.ensName,
        repoUrl,
        comparisonNumber: comparisonIndex,
        depA,
        depB,
        multiplier,
        userAgrees,
        wasSkipped
      })
      console.log(`Level 3 comparison submitted to Google Sheets by ${session.user.ensName}`)
    } catch (sheetsError) {
      // Log but don't fail the request if Sheets submission fails
      console.error('Failed to submit Level 3 comparison to Google Sheets:', sheetsError)
    }

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
