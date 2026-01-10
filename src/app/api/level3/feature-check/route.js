import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Check if Level 3 feature is enabled
 * Returns { enabled: true/false }
 */
export async function GET() {
  try {
    const ctx = getCloudflareContext()
    const env = ctx.env

    // Check the ENABLE_LEVEL3 environment variable
    const enabled = env.ENABLE_LEVEL3 === 'true'

    return Response.json({ enabled })
  } catch (error) {
    console.error('Error checking Level 3 feature flag:', error)
    // Default to disabled on error
    return Response.json({ enabled: false })
  }
}
