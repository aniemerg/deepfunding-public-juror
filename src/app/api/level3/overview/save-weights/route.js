import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { cookies } from 'next/headers'

/**
 * Auto-save overview weights to KV
 * POST /api/level3/overview/save-weights
 * Body: { repoUrl, adjustedWeights, editedFields, depComments }
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession(cookieStore, sessionOptions)

    if (!session.user?.address) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { repoUrl, adjustedWeights, editedFields, depComments } = await req.json()

    if (!repoUrl || !adjustedWeights) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()
    const key = `user:${userAddress}:level3-overview:${encodeURIComponent(repoUrl)}`

    const data = {
      repoUrl,
      adjustedWeights,
      editedFields: editedFields || [],
      depComments: depComments || {},
      lastSaved: new Date().toISOString()
    }

    await kv.put(key, JSON.stringify(data))

    console.log(`Overview weights auto-saved for ${session.user.ensName}: ${repoUrl}`)

    return Response.json({ success: true, lastSaved: data.lastSaved })
  } catch (error) {
    console.error('Error saving overview weights:', error)
    return Response.json({
      error: 'Failed to save weights',
      details: error.message
    }, { status: 500 })
  }
}
