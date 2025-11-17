import { NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// Server-side ENS resolution using viem (direct blockchain queries, no caching)
// This allows clients to resolve ENS names through our server,
// bypassing CORS and mobile browser restrictions
export async function GET(req) {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')

  if (!address) {
    return NextResponse.json({
      error: 'Missing address parameter'
    }, { status: 400 })
  }

  try {
    // Use viem to get ENS name directly from blockchain
    const client = createPublicClient({
      chain: mainnet,
      transport: http()
    })

    const ensName = await client.getEnsName({
      address: address
    })

    // Validate the response
    if (ensName && ensName.endsWith('.eth')) {
      return NextResponse.json({
        success: true,
        name: ensName,
        address: address,
        displayName: ensName,
        avatar: null // Avatar resolution can be added later if needed
      })
    }

    // No valid ENS name found
    return NextResponse.json({
      success: false,
      error: 'No ENS name found for this address'
    }, { status: 404 })

  } catch (error) {
    console.error('ENS resolution error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to resolve ENS name'
    }, { status: 500 })
  }
}
