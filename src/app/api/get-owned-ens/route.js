import { NextResponse } from 'next/server'

// Query ENS names owned by an address using The Graph ENS subgraph
async function getOwnedEnsNames(address) {
  const ENS_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/ensdomains/ens'

  const query = `
    query GetRegistrations($owner: String!) {
      registrations(
        where: { registrant: $owner }
        first: 100
        orderBy: registrationDate
        orderDirection: desc
      ) {
        labelName
        expiryDate
      }
    }
  `

  try {
    const response = await fetch(ENS_SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { owner: address.toLowerCase() }
      })
    })

    if (!response.ok) {
      console.error('ENS subgraph query failed:', response.status)
      return []
    }

    const data = await response.json()

    if (data.errors) {
      console.error('ENS subgraph errors:', data.errors)
      return []
    }

    if (!data.data?.registrations) {
      return []
    }

    // Filter out expired names and add .eth suffix
    const now = Math.floor(Date.now() / 1000)
    const activeNames = data.data.registrations
      .filter(reg => parseInt(reg.expiryDate) > now)
      .map(reg => `${reg.labelName}.eth`)

    return activeNames

  } catch (error) {
    console.error('Error querying ENS subgraph:', error)
    return []
  }
}

/**
 * Get ENS names owned by an address
 * GET /api/get-owned-ens?address={walletAddress}
 */
export async function GET(req) {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')

  if (!address) {
    return NextResponse.json({
      error: 'Missing address parameter'
    }, { status: 400 })
  }

  try {
    const ownedNames = await getOwnedEnsNames(address)

    return NextResponse.json({
      success: true,
      ownedNames,
      count: ownedNames.length,
      address
    })

  } catch (error) {
    console.error('Error getting owned ENS names:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get owned ENS names',
      details: error.message
    }, { status: 500 })
  }
}
