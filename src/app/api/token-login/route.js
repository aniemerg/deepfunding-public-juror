export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SESSION_VERSION } from '@/lib/session'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function POST(req) {
  const { token } = await req.json()

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const normalized = token.trim().toUpperCase().replace(/\s+/g, '')

  const env = getCloudflareContext().env
  const tokenData = await env.JURY_DATA.get(`token:${normalized}`)

  if (!tokenData) {
    return NextResponse.json({ error: 'Invalid access token. Please check and try again.' }, { status: 401 })
  }

  const { userId, label } = JSON.parse(tokenData)

  const cookieStore = await cookies()
  const session = await getIronSession(cookieStore, sessionOptions)

  session.version = SESSION_VERSION
  session.user = {
    address: userId,
    ensName: label,
    isTokenAuth: true,
  }
  await session.save()

  console.log(`Token login: ${userId} (${label})`)

  return NextResponse.json({ success: true, user: session.user })
}
