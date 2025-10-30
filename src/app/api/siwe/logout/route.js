export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'

export async function POST() {
  const session = await getIronSession(cookies(), sessionOptions)
  
  // Clear session data
  session.user = null
  session.siweNonce = null
  await session.save()

  return NextResponse.json({ success: true })
}