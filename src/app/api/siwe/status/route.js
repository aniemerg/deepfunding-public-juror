export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'

export async function GET() {
  const session = await getIronSession(cookies(), sessionOptions)
  
  return NextResponse.json({
    authenticated: !!session.user,
    user: session.user || null
  })
}