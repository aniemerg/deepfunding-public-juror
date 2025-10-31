export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession(cookieStore, sessionOptions)
  
  console.log('SIWE Status: Session data:', session.user)
  
  return NextResponse.json({
    authenticated: !!session.user,
    user: session.user || null
  })
}