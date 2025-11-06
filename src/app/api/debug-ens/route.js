import { NextResponse } from 'next/server'

export async function GET(req) {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')

  if (!address) {
    return NextResponse.json({
      error: 'Missing address parameter',
      usage: '/api/debug-ens?address=0x...'
    }, { status: 400 })
  }

  const debugInfo = {
    address: address,
    timestamp: new Date().toISOString(),
    server_can_resolve: false,
    ens_api_response: null,
    validation: {
      has_name: false,
      ends_with_eth: false,
      would_pass_login_check: false
    },
    error: null
  }

  try {
    // Call the same ENS API the frontend uses
    const apiUrl = `https://api.ensideas.com/ens/resolve/${address}`

    console.log('Debug ENS: Fetching from', apiUrl)
    const response = await fetch(apiUrl)

    debugInfo.ens_api_response = {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    }

    if (response.ok) {
      const data = await response.json()
      debugInfo.ens_api_response.data = data
      debugInfo.server_can_resolve = true

      // Validate the response
      if (data.name && typeof data.name === 'string') {
        debugInfo.validation.has_name = true
        if (data.name.endsWith('.eth')) {
          debugInfo.validation.ends_with_eth = true
          debugInfo.validation.would_pass_login_check = true
        }
      }
    } else {
      const errorText = await response.text()
      debugInfo.ens_api_response.error_body = errorText
      debugInfo.error = `ENS API returned ${response.status}: ${errorText}`
    }

  } catch (error) {
    debugInfo.error = error.message
    debugInfo.error_stack = error.stack
  }

  // Return with pretty formatting
  return new NextResponse(
    JSON.stringify(debugInfo, null, 2),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    }
  )
}
