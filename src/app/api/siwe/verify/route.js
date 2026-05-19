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

// Query ENS names owned by an address using The Graph ENS subgraph
async function getOwnedEnsNames(address) {
  const ENS_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/ensdomains/ens'

  const query = `
    query GetOwnedNames($owner: String!) {
      account(id: $owner) {
        registrations {
          labelName
          expiryDate
        }
        wrappedDomains {
          name
          expiryDate
        }
      }
      domains(where: { owner: $owner }) {
        name
        labelName
      }
    }
  `

  try {
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 5000)
    const response = await fetch(ENS_SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { owner: address.toLowerCase() }
      }),
      signal: abort.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      console.error('ENS subgraph query failed:', response.status)
      return []
    }

    const data = await response.json()

    if (data.errors) {
      console.error('ENS subgraph errors:', data.errors)
      return []
    }

    const now = Math.floor(Date.now() / 1000)
    const namesSet = new Set()

    // Collect from registrations (traditional ERC-721)
    if (data.data?.account?.registrations) {
      data.data.account.registrations
        .filter(reg => parseInt(reg.expiryDate) > now)
        .forEach(reg => namesSet.add(`${reg.labelName}.eth`))
    }

    // Collect from wrapped domains (ERC-1155)
    if (data.data?.account?.wrappedDomains) {
      data.data.account.wrappedDomains
        .filter(domain => {
          // Check expiry if available
          if (domain.expiryDate) {
            return parseInt(domain.expiryDate) > now
          }
          return true // Include if no expiry data
        })
        .forEach(domain => {
          // domain.name is already the full name (e.g., "vitalik.eth")
          if (domain.name && domain.name.endsWith('.eth')) {
            namesSet.add(domain.name)
          }
        })
    }

    // Collect from domains (owner field)
    if (data.data?.domains) {
      data.data.domains.forEach(domain => {
        if (domain.name && domain.name.endsWith('.eth')) {
          namesSet.add(domain.name)
        } else if (domain.labelName) {
          namesSet.add(`${domain.labelName}.eth`)
        }
      })
    }

    const activeNames = Array.from(namesSet).sort()
    console.log(`Found ${activeNames.length} active ENS names for ${address}:`, activeNames)
    return activeNames

  } catch (error) {
    console.error('Error querying ENS subgraph:', error)
    return []
  }
}

// ENS Resolution function with fallback RPC endpoints and timeout
async function resolveENSName(address, selectedEnsName = null) {
  // STEP 1: Try reverse lookup first (preferred - fast with caching)
  let infuraKey = null
  try { infuraKey = getCloudflareContext().env.INFURA_API_KEY } catch (e) {}

  const rpcEndpoints = [
    infuraKey ? `https://mainnet.infura.io/v3/${infuraKey}` : null,
    'https://cloudflare-eth.com',
    'https://eth.drpc.org'
  ].filter(Boolean)

  for (const rpcUrl of rpcEndpoints) {
    try {
      console.log(`Backend: Trying ENS reverse lookup for ${address} via ${rpcUrl}`);

      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl, {
          timeout: 5000
        })
      })

      const ensName = await client.getEnsName({
        address: address
      })

      if (ensName && ensName.endsWith('.eth')) {
        console.log(`Backend: Found ENS via reverse lookup:`, ensName);
        return { ensName, method: 'reverse', ownedNames: null }
      }

      console.log(`Backend: No reverse ENS found via ${rpcUrl}`);
      break; // Exit loop on first successful connection (even if no name found)
    } catch (error) {
      console.error(`Backend: ENS resolution failed with ${rpcUrl}:`, error.message);
      // Try next endpoint
      continue;
    }
  }

  // STEP 2: Reverse lookup failed, query owned ENS NFTs
  console.log(`Backend: Reverse lookup failed, checking owned ENS names...`);
  const ownedNames = await getOwnedEnsNames(address)

  if (ownedNames.length === 0) {
    console.log('Backend: No ENS names owned by this address');
    return { ensName: null, method: 'none', ownedNames: [] }
  }

  // If user selected one from the list, validate and use it
  if (selectedEnsName && ownedNames.includes(selectedEnsName)) {
    console.log(`Backend: Using selected ENS name: ${selectedEnsName}`);
    return { ensName: selectedEnsName, method: 'ownership', ownedNames }
  }

  // If only one ENS name owned, use it automatically
  if (ownedNames.length === 1) {
    console.log(`Backend: Auto-selecting single owned ENS: ${ownedNames[0]}`);
    return { ensName: ownedNames[0], method: 'ownership', ownedNames }
  }

  // Multiple ENS names - need user to select
  console.log(`Backend: User owns ${ownedNames.length} ENS names, selection required`);
  return { ensName: null, method: 'multiple', ownedNames }
}

export async function POST(req) {
  console.log('🚀 verify POST handler started')
  const cookieStore = await cookies()
  const session = await getIronSession(cookieStore, sessionOptions)
  const { message, signature, inviteCode, selectedEnsName } = await req.json()
  console.log('📨 verify request parsed, starting SIWE verification')

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
      let sigVerifyKey = null
      try { sigVerifyKey = getCloudflareContext().env.INFURA_API_KEY } catch (e) {}
      const rpcUrl = sigVerifyKey
        ? `https://mainnet.infura.io/v3/${sigVerifyKey}`
        : 'https://cloudflare-eth.com'
      const client = createPublicClient({
        chain,
        transport: http(rpcUrl, { timeout: 8000 })
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
    let ensResolutionResult = null;

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
      ensResolutionResult = await resolveENSName(siwe.address, selectedEnsName || null);
      ensName = ensResolutionResult.ensName;
    }

    // Handle different resolution outcomes
    if (!ensName) {
      if (ensResolutionResult?.method === 'none') {
        return NextResponse.json({
          error: 'ENS Name Required',
          message: 'To participate, you must own an ENS name ending in .eth.',
          helpUrl: 'https://ens.domains',
          address: siwe.address
        }, { status: 403 })
      }

      if (ensResolutionResult?.method === 'multiple') {
        return NextResponse.json({
          error: 'Multiple ENS Names Found',
          message: 'You own multiple ENS names. Please select which one to use.',
          ownedNames: ensResolutionResult.ownedNames,
          requiresSelection: true,
          address: siwe.address
        }, { status: 409 }) // 409 Conflict - needs user selection
      }

      // Fallback error for any other case
      return NextResponse.json({
        error: 'ENS Name Required',
        message: 'To participate, you must own an ENS name ending in .eth.',
        helpUrl: 'https://ens.domains',
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