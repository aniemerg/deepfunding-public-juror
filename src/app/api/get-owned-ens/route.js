import { NextResponse } from 'next/server'

// Query ENS names owned by an address using The Graph ENS subgraph
// Supports both traditional ERC-721 registrations and wrapped ERC-1155 domains
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
