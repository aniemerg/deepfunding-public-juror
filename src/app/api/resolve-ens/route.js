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

  const rpcEndpoints = [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://eth.drpc.org',
  ]

  for (const rpcUrl of rpcEndpoints) {
    try {
      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl, { timeout: 5000 })
      })

      const ensName = await client.getEnsName({ address })

      if (ensName && ensName.endsWith('.eth')) {
        let avatar = null
        try {
          avatar = await client.getEnsAvatar({ name: ensName })
        } catch (avatarError) {
          console.log('Avatar resolution failed (optional):', avatarError.message)
        }

        return NextResponse.json({
          success: true,
          name: ensName,
          address: address,
          displayName: ensName,
          avatar: avatar
        })
      }

      return NextResponse.json({
        success: false,
        error: 'No ENS name found for this address'
      }, { status: 404 })

    } catch (error) {
      console.error(`ENS resolution failed via ${rpcUrl}:`, error.message)
    }
  }

  return NextResponse.json({
    success: false,
    error: 'Failed to resolve ENS name'
  }, { status: 500 })
}
