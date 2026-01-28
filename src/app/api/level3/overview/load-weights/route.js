import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { cookies } from 'next/headers'

/**
 * Load saved overview weights from KV
 * GET /api/level3/overview/load-weights?repoUrl=<url>
 */
export async function GET(req) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession(cookieStore, sessionOptions)

    if (!session.user?.address) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const repoUrl = searchParams.get('repoUrl')

    if (!repoUrl) {
      return Response.json({ error: 'Missing repoUrl parameter' }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()
    const key = `user:${userAddress}:level3-overview:${encodeURIComponent(repoUrl)}`

    const data = await kv.get(key)

    if (!data) {
      return Response.json({
        hasData: false,
        adjustedWeights: null,
        editedFields: null,
        depComments: null
      })
    }

    const savedData = JSON.parse(data)

    return Response.json({
      hasData: true,
      adjustedWeights: savedData.adjustedWeights || {},
      editedFields: savedData.editedFields || [],
      depComments: savedData.depComments || {},
      lastSaved: savedData.lastSaved
    })
  } catch (error) {
    console.error('Error loading overview weights:', error)
    return Response.json({
      error: 'Failed to load weights',
      details: error.message
    }, { status: 500 })
  }
}
