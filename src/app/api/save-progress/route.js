export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { KVStorageService } from '@/utils/kvStorage'

export async function POST(request, { env }) {
  try {
    const { userAddress, dataType, id, data } = await request.json()

    // Validate required fields
    if (!userAddress || !dataType || !data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Initialize KV service with environment
    const kvService = new KVStorageService(env)

    // Save based on data type
    if (dataType === 'profile') {
      await kvService.saveProfile(userAddress, data)
    } else {
      // For evaluation data, generate ID if not provided
      const evaluationId = id || crypto.randomUUID()
      await kvService.saveEvaluation(userAddress, dataType, evaluationId, data)
      
      return NextResponse.json({ 
        success: true,
        id: evaluationId,
        message: 'Progress saved'
      })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Progress saved'
    })
  } catch (error) {
    console.error('Save error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save progress' },
      { status: 500 }
    )
  }
}

export async function GET(request, { env }) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')
    const dataType = searchParams.get('type')
    const id = searchParams.get('id')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 }
      )
    }

    const kvService = new KVStorageService(env)

    // If specific type and id provided, get that specific item
    if (dataType && id) {
      const data = await kvService.getEvaluation(userAddress, dataType, id)
      return NextResponse.json(data || {})
    }

    // Otherwise load all user data
    const userData = await kvService.loadUserData(userAddress)
    return NextResponse.json(userData)
  } catch (error) {
    console.error('Load error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load data' },
      { status: 500 }
    )
  }
}