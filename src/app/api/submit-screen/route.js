export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { KVStorageService } from '@/utils/kvStorage'
import { GoogleSheetsService } from '@/utils/googleSheets'

export async function POST(request, { env }) {
  try {
    const { userAddress, screenType, screenId, data } = await request.json()

    // Validate required fields
    if (!userAddress || !screenType || !screenId || !data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const kvService = new KVStorageService(env)
    const sheetsService = new GoogleSheetsService()

    // 1. Get current data to check if this is a resubmission
    const currentData = await kvService.getEvaluation(userAddress, screenType, screenId)
    const isResubmission = currentData?.status === 'submitted'

    // 2. Mark previous submissions as superseded if this is a resubmission
    if (isResubmission) {
      await sheetsService.markRowsAsSuperseded(userAddress, screenType, screenId)
    }

    // 3. Create new row in Google Sheets
    const submissionTimestamp = new Date().toISOString()
    const sheetRow = sheetsService.formatSubmissionRow(
      userAddress, 
      screenType, 
      screenId, 
      data, 
      'active'
    )

    await sheetsService.writeSheet('responses!A:Z', [sheetRow])

    // 4. Update KV with submitted status
    await kvService.markAsSubmitted(userAddress, screenType, screenId)

    return NextResponse.json({
      success: true,
      message: 'Screen data submitted successfully',
      submissionTimestamp,
      isResubmission
    })

  } catch (error) {
    console.error('Screen submission error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit screen data' },
      { status: 500 }
    )
  }
}

// Get submission status for a screen
export async function GET(request, { env }) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')
    const screenType = searchParams.get('screenType')
    const screenId = searchParams.get('screenId')

    if (!userAddress || !screenType || !screenId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const kvService = new KVStorageService(env)
    const data = await kvService.getEvaluation(userAddress, screenType, screenId)

    return NextResponse.json({
      exists: !!data,
      status: data?.status || 'not_found',
      lastSubmittedAt: data?.lastSubmittedAt || null,
      submissionCount: data?.submissionCount || 0
    })

  } catch (error) {
    console.error('Get submission status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get submission status' },
      { status: 500 }
    )
  }
}