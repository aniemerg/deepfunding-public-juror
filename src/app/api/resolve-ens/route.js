import { NextResponse } from 'next/server'

// Server-side ENS resolution proxy
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
    // Call the ENS API from the server
    const apiUrl = `https://api.ensideas.com/ens/resolve/${address}`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      return NextResponse.json({
        error: 'ENS resolution failed',
        status: response.status
      }, { status: response.status })
    }

    const data = await response.json()

    // Validate the response
    if (data.name && data.name.endsWith('.eth')) {
      return NextResponse.json({
        success: true,
        name: data.name,
        address: data.address,
        displayName: data.displayName,
        avatar: data.avatar
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
