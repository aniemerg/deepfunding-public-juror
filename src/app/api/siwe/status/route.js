export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SESSION_VERSION } from '@/lib/session'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession(cookieStore, sessionOptions)

  // Check session version and clear if outdated
  if (session.user && (!session.version || session.version < SESSION_VERSION)) {
    console.log(`🔄 Session version mismatch: stored=${session.version || 'undefined'}, current=${SESSION_VERSION}`)
    console.log(`   Clearing outdated session for user: ${session.user.ensName || session.user.address}`)

    // Clear the session
    session.user = null
    session.version = null
    session.siweNonce = null
    await session.save()

    return NextResponse.json({
      authenticated: false,
      user: null,
      versionCleared: true
    })
  }

  console.log('SIWE Status: Session data:', session.user, '(version:', session.version, ')')

  return NextResponse.json({
    authenticated: !!session.user,
    user: session.user || null
  })
}