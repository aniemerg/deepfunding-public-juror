export const runtime = 'nodejs'

import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { SiweMessage } from 'siwe'

export async function POST(req) {
  const session = await getIronSession(cookies(), sessionOptions)
  const { message, signature, inviteCode } = await req.json()

  try {
    const siwe = new SiweMessage(message)
    
    // Verify SIWE signature
    const hostHeader = headers().get('host') || ''
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://${hostHeader}`
    const domain = new URL(appUrl).host
    
    const result = await siwe.verify({
      signature,
      domain,
      nonce: session.siweNonce,
      time: new Date().toISOString(),
    })

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Optional invite code validation
    if (process.env.ENABLE_INVITE_CODES === 'true' && !inviteCode) {
      return NextResponse.json({ error: 'Invite code required' }, { status: 401 })
    }

    // Store user in session
    session.user = {
      address: siwe.address.toLowerCase(),
      chainId: siwe.chainId,
      inviteCode: inviteCode || null,
    }
    
    // Clear the nonce to prevent replay
    session.siweNonce = null
    await session.save()

    return NextResponse.json({ 
      success: true, 
      user: session.user 
    })

  } catch (error) {
    console.error('SIWE verification error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
}