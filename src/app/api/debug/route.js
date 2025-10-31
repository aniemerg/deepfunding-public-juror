export async function POST(req) {
  try {
    const { message, data } = await req.json()
    console.log('🐛 DEBUG:', message)
    if (data) {
      console.log('🐛 DATA:', JSON.stringify(data, null, 2))
    }
    return Response.json({ success: true })
  } catch (error) {
    console.log('🐛 DEBUG ERROR:', error.message)
    return Response.json({ error: 'Debug failed' }, { status: 500 })
  }
}

export async function GET(req) {
  const url = new URL(req.url)
  const message = url.searchParams.get('message') || 'Debug ping'
  console.log('🐛 DEBUG GET:', message)
  return Response.json({ message: 'Debug logged to console' })
}