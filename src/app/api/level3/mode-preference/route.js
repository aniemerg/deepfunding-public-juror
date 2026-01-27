import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { cookies } from 'next/headers'

/**
 * Get/Set user's Level 3 mode preference (overview vs comparisons)
 * GET /api/level3/mode-preference - Load preference
 * POST /api/level3/mode-preference - Save preference
 */

export async function GET(req) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession(cookieStore, sessionOptions)

    if (!session.user?.address) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()
    const key = `user:${userAddress}:level3-mode-preference`

    const data = await kv.get(key)
    const preference = data ? JSON.parse(data) : { mode: 'overview' }

    return Response.json(preference)
  } catch (error) {
    console.error('Error loading mode preference:', error)
    return Response.json({
      error: 'Failed to load mode preference',
      details: error.message
    }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession(cookieStore, sessionOptions)

    if (!session.user?.address) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { mode } = await req.json()

    if (!mode || !['overview', 'comparisons'].includes(mode)) {
      return Response.json({ error: 'Invalid mode' }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA
    const userAddress = session.user.address.toLowerCase()
    const key = `user:${userAddress}:level3-mode-preference`

    const preference = {
      mode,
      updatedAt: new Date().toISOString()
    }

    await kv.put(key, JSON.stringify(preference))

    console.log(`Mode preference saved for ${session.user.ensName}: ${mode}`)

    return Response.json({ success: true, mode })
  } catch (error) {
    console.error('Error saving mode preference:', error)
    return Response.json({
      error: 'Failed to save mode preference',
      details: error.message
    }, { status: 500 })
  }
}
