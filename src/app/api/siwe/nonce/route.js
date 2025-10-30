export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import crypto from 'crypto'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession(cookieStore, sessionOptions)
  const nonce = crypto.randomBytes(16).toString('hex')
  session.siweNonce = nonce
  await session.save()
  return new NextResponse(nonce, { headers: { 'content-type': 'text/plain' } })
}