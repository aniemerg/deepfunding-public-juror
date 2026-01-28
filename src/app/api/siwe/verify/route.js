export const runtime = 'nodejs'

import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SESSION_VERSION } from '@/lib/session'
import { SiweMessage } from 'siwe'
import { submitSessionData } from '@/lib/googleSheets'
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createPublicClient, http } from 'viem'
import { mainnet, base } from 'viem/chains'

// ENS Resolution function with fallback RPC endpoints and timeout
async function resolveENSName(address) {
  // Try multiple RPC endpoints with timeout
  const rpcEndpoints = [
    process.env.INFURA_API_KEY
      ? `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
      : null,
    'https://cloudflare-eth.com',
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://eth.drpc.org'
  ].filter(Boolean) // Remove null entries if no Infura key

  for (const rpcUrl of rpcEndpoints) {
    try {
      console.log(`Backend: Trying ENS resolution for ${address} via ${rpcUrl}`);

      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl, {
          timeout: 10000 // 10 second timeout per attempt
        })
      })

      const ensName = await client.getEnsName({
        address: address
      })

      if (ensName && ensName.endsWith('.eth')) {
        console.log(`Backend: Found ENS via ${rpcUrl}:`, ensName);
        return ensName;
      }

      console.log(`Backend: No ENS found for address via ${rpcUrl}`);
      return null;
    } catch (error) {
      console.error(`Backend: ENS resolution failed with ${rpcUrl}:`, error.message);
      // Try next endpoint
      continue;
    }
  }

  console.error('Backend: All ENS resolution attempts failed');
  return null;
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
    // Check cache first to speed up returning users
    let ensName = null;
    try {
      const env = getCloudflareContext().env;
      const profileKey = `user:${siwe.address.toLowerCase()}:profile`;
      const cachedProfile = await env.JURY_DATA.get(profileKey);

      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        const cacheAge = Date.now() - new Date(profile.lastLogin).getTime();
        const cacheTTL = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (cacheAge < cacheTTL && profile.ensName) {
          ensName = profile.ensName;
          console.log('Backend: Using cached ENS name:', ensName);
        } else {
          console.log('Backend: Cached ENS expired, will lookup fresh');
        }
      }
    } catch (cacheError) {
      console.log('Backend: Cache lookup failed, will do full ENS resolution:', cacheError.message);
    }

    // If not cached, do full ENS resolution
    if (!ensName) {
      ensName = await resolveENSName(siwe.address);
    }

    if (!ensName) {
      return NextResponse.json({
        error: 'Primary ENS Name Required',
        message: 'To participate, you must own an ENS name ending in .eth and set it as your Primary ENS Name for this wallet address.',
        helpUrl: 'https://support.ens.domains/en/articles/8684192-how-to-set-as-primary-name',
        address: siwe.address
      }, { status: 403 })
    }

    // Optional invite code validation
    if (process.env.ENABLE_INVITE_CODES === 'true' && !inviteCode) {
      return NextResponse.json({ error: 'Invite code required' }, { status: 401 })
    }

    // Store user in session with version
    session.version = SESSION_VERSION
    session.user = {
      address: siwe.address.toLowerCase(),
      ensName: ensName,
      chainId: siwe.chainId,
      inviteCode: inviteCode || null,
    }

    // Clear the nonce to prevent replay
    session.siweNonce = null
    await session.save()

    // Store/update ENS name in KV for caching and easy access
    try {
      const env = getCloudflareContext().env;
      const profileKey = `user:${siwe.address.toLowerCase()}:profile`;
      const ensLookupKey = `ens:${ensName}`;

      // Check if profile exists to preserve firstLogin
      let firstLogin = new Date().toISOString();
      try {
        const existing = await env.JURY_DATA.get(profileKey);
        if (existing) {
          const existingProfile = JSON.parse(existing);
          firstLogin = existingProfile.firstLogin || firstLogin;
        }
      } catch (e) {
        // New user, use current timestamp
      }

      // Store/update user profile (address → profile data)
      await env.JURY_DATA.put(profileKey, JSON.stringify({
        ensName: ensName,
        address: siwe.address.toLowerCase(),
        chainId: siwe.chainId,
        firstLogin: firstLogin,
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