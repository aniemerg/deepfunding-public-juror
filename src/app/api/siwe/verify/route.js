export const runtime = 'nodejs'

import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { SiweMessage } from 'siwe'
import { submitSessionData } from '@/lib/googleSheets'
import { getCloudflareContext } from "@opennextjs/cloudflare"

// ENS Resolution function
async function resolveENSName(address) {
  try {
    console.log('Backend: Resolving ENS for address:', address);
    
    // Use the same API that works in frontend
    const ensApiResponse = await fetch(`https://api.ensideas.com/ens/resolve/${address}`);
    if (ensApiResponse.ok) {
      const ensData = await ensApiResponse.json();
      console.log('Backend: ENS API response:', ensData);
      if (ensData.name && ensData.name.endsWith('.eth')) {
        console.log('Backend: Found ENS via API:', ensData.name);
        return ensData.name;
      }
    }
    
    console.log('Backend: No ENS found for address:', address);
    return null;
  } catch (error) {
    console.error('Backend: ENS resolution failed:', error);
    return null;
  }
}

export async function POST(req) {
  const cookieStore = await cookies()
  const session = await getIronSession(cookieStore, sessionOptions)
  const { message, signature, inviteCode } = await req.json()

  try {
    const siwe = new SiweMessage(message)
    
    // Verify SIWE signature
    const headersList = await headers()
    const hostHeader = headersList.get('host') || ''
    
    // Check for domain mismatch and clear session if needed (development only)
    if (process.env.NODE_ENV === 'development' && siwe.domain !== hostHeader) {
      console.log(`Domain mismatch detected: message=${siwe.domain}, server=${hostHeader}. Clearing session.`)
      session.siweNonce = null
      await session.save()
      return NextResponse.json({ error: 'Domain mismatch. Please refresh and try again.' }, { status: 400 })
    }
    
    const result = await siwe.verify({
      signature,
      domain: hostHeader, // Use current server host
      nonce: session.siweNonce,
      time: new Date().toISOString(),
    })

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Resolve ENS name - REQUIRED for login
    const ensName = await resolveENSName(siwe.address);
    if (!ensName) {
      return NextResponse.json({ 
        error: 'ENS name required. This address must have an ENS name to participate.',
        address: siwe.address 
      }, { status: 403 })
    }

    // Optional invite code validation
    if (process.env.ENABLE_INVITE_CODES === 'true' && !inviteCode) {
      return NextResponse.json({ error: 'Invite code required' }, { status: 401 })
    }

    // Store user in session
    session.user = {
      address: siwe.address.toLowerCase(),
      ensName: ensName,
      chainId: siwe.chainId,
      inviteCode: inviteCode || null,
    }

    // Clear the nonce to prevent replay
    session.siweNonce = null
    await session.save()

    // Store ENS name in KV for easy access (e.g., by kv-manager tool)
    try {
      const env = getCloudflareContext().env;
      const profileKey = `user:${siwe.address.toLowerCase()}:profile`;
      const ensLookupKey = `ens:${ensName}`;

      // Store user profile (address → profile data)
      await env.JURY_DATA.put(profileKey, JSON.stringify({
        ensName: ensName,
        address: siwe.address.toLowerCase(),
        chainId: siwe.chainId,
        firstLogin: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      }));

      // Store reverse mapping (ENS name → address)
      await env.JURY_DATA.put(ensLookupKey, JSON.stringify({
        address: siwe.address.toLowerCase(),
        updatedAt: new Date().toISOString()
      }));
    } catch (kvError) {
      console.error('Failed to store profile in KV:', kvError);
      // Don't fail login if KV storage fails
    }

    // Log session to Sessions sheet
    try {
      const env = getCloudflareContext().env;
      await submitSessionData(env, {
        ensName,
        walletAddress: siwe.address.toLowerCase(),
        inviteCode: inviteCode || null
      });
    } catch (sessionError) {
      console.error('Failed to log session to Google Sheets:', sessionError);
      // Don't fail login if session logging fails
    }

    return NextResponse.json({ 
      success: true, 
      user: session.user 
    })

  } catch (error) {
    console.error('SIWE verification error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
}