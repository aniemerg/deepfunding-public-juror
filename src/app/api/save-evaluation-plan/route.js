import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request) {
  const { userAddress, plan } = await request.json()

  if (!userAddress || !plan) {
    return new Response(JSON.stringify({ error: 'User address and plan required' }), { 
      status: 400,
      headers: { "content-type": "application/json" }
    })
  }

  const kv = getCloudflareContext().env.JURY_DATA;
  const key = `user:${userAddress}:evaluation_plan`

  try {
    await kv.put(key, JSON.stringify(plan))
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Plan saved successfully' 
    }), {
      headers: { "content-type": "application/json" }
    })
  } catch (error) {
    console.error('Failed to save plan:', error)
    return new Response(JSON.stringify({ error: 'Failed to save plan' }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    })
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userAddress = searchParams.get('userAddress')

  if (!userAddress) {
    return new Response(JSON.stringify({ error: 'User address required' }), { 
      status: 400,
      headers: { "content-type": "application/json" }
    })
  }

  const kv = getCloudflareContext().env.JURY_DATA;
  const key = `user:${userAddress}:evaluation_plan`

  try {
    const planData = await kv.get(key, { type: "json" })
    
    if (!planData) {
      return new Response(JSON.stringify(null), {
        headers: { "content-type": "application/json" }
      })
    }
    
    return new Response(JSON.stringify(planData), {
      headers: { "content-type": "application/json" }
    })
  } catch (error) {
    console.error('Failed to load plan:', error)
    return new Response(JSON.stringify({ error: 'Failed to load plan' }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    })
  }
}