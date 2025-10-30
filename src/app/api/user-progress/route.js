export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { KVStorageService } from '@/utils/kvStorage'

export async function GET(request, { env }) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 }
      )
    }

    const kvService = new KVStorageService(env)
    const progress = await kvService.getUserProgress(userAddress)

    return NextResponse.json(progress)

  } catch (error) {
    console.error('Progress error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get user progress' },
      { status: 500 }
    )
  }
}

export async function DELETE(request, { env }) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 }
      )
    }

    const kvService = new KVStorageService(env)
    await kvService.deleteUserData(userAddress)

    return NextResponse.json({
      success: true,
      message: 'User data deleted'
    })

  } catch (error) {
    console.error('Delete user data error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete user data' },
      { status: 500 }
    )
  }
}