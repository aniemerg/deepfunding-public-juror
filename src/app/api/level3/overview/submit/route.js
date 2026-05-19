import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { cookies } from 'next/headers'
import { submitLevel3OverviewData } from '@/lib/googleSheets'

/**
 * Submit overview weights to Google Sheets
 * POST /api/level3/overview/submit
 * Body: { repoUrl, dependencies, adjustedWeights, depComments }
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession(cookieStore, sessionOptions)

    if (!session.user?.address || !session.user?.ensName) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { repoUrl, dependencies, adjustedWeights, depComments } = await req.json()

    if (!repoUrl || !dependencies || !adjustedWeights) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()

    // Save to KV first
    const key = `user:${userAddress}:level3-overview:${encodeURIComponent(repoUrl)}`
    const data = {
      repoUrl,
      adjustedWeights,
      depComments: depComments || {},
      lastSaved: new Date().toISOString(),
      submitted: true,
      submittedAt: new Date().toISOString()
    }

    await kv.put(key, JSON.stringify(data))

    // Submit to Google Sheets
    try {
      await submitLevel3OverviewData(getCloudflareContext().env, {
        ensName: session.user.ensName,
        repoUrl,
        dependencies,
        adjustedWeights,
        depComments: depComments || {}
      })

      console.log(`Level 3 overview submitted to Google Sheets by ${session.user.ensName}: ${repoUrl}`)

      return Response.json({
        success: true,
        message: 'Weights submitted successfully',
        submittedAt: data.submittedAt
      })
    } catch (sheetsError) {
      console.error('Failed to submit to Google Sheets:', sheetsError)
      return Response.json({
        error: 'Failed to submit to Google Sheets',
        details: sheetsError.message
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error submitting overview weights:', error)
    return Response.json({
      error: 'Failed to submit weights',
      details: error.message
    }, { status: 500 })
  }
}
