export const runtime = 'nodejs'

import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { SiweMessage } from 'siwe'
import { submitSessionData } from '@/lib/googleSheets'
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createPublicClient, http } from 'viem'
import { mainnet, base } from 'viem/chains'

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

    // Log all verification details for debugging
    console.log('🔐 SIWE Verification Debug:', {
      messageDomain: siwe.domain,
      serverHost: hostHeader,
      address: siwe.address,
      nonce: session.siweNonce,
      hasSignature: !!signature
    })

    // Check for domain mismatch
    if (siwe.domain !== hostHeader) {
      console.log(`⚠️ Domain mismatch: message=${siwe.domain}, server=${hostHeader}`)

      // In development, clear session and ask to retry
      if (process.env.NODE_ENV === 'development') {
        session.siweNonce = null
        await session.save()
        return NextResponse.json({ error: 'Domain mismatch. Please refresh and try again.' }, { status: 400 })
      }

      // In production, return detailed error for debugging
      return NextResponse.json({
        error: 'Domain mismatch',
        details: {
          expectedDomain: hostHeader,
          receivedDomain: siwe.domain,
          message: 'The signed message domain does not match the server domain. This may be caused by using a mobile browser or wallet that modifies the domain.'
        }
      }, { status: 400 })
    }

    // Validate nonce matches
    if (siwe.nonce !== session.siweNonce) {
      console.log('❌ Nonce mismatch')
      return NextResponse.json({
        error: 'Invalid nonce',
        details: 'Session nonce does not match. Please try signing in again.'
      }, { status: 401 })
    }

    // Validate message hasn't expired
    const now = new Date()
    if (siwe.expirationTime && new Date(siwe.expirationTime) < now) {
      console.log('❌ Message expired')
      return NextResponse.json({
        error: 'Message expired',
        details: 'The signed message has expired. Please try signing in again.'
      }, { status: 401 })
    }

    // Verify signature using viem (supports both EOA and smart wallets via ERC-1271/ERC-6492)
    try {
      // Select chain based on chainId from SIWE message
      const chain = siwe.chainId === 8453 ? base : mainnet
      const client = createPublicClient({
        chain,
        transport: http()
      })

      // Verify the signature - viem handles both EOA and smart wallet signatures
      const isValid = await client.verifyMessage({
        address: siwe.address,
        message: message,
        signature: signature
      })

      if (!isValid) {
        console.log('❌ Signature verification failed')
        return NextResponse.json({
          error: 'Invalid signature',
          details: 'Signature verification failed. Please try signing in again.'
        }, { status: 401 })
      }

      console.log('✅ Signature verified successfully for:', siwe.address)
    } catch (verifyError) {
      console.error('❌ Verification error:', verifyError)
      return NextResponse.json({
        error: 'Verification failed',
        details: verifyError.message || 'Failed to verify signature. Please try again.'
      }, { status: 401 })
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