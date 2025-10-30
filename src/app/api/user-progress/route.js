import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userAddress = searchParams.get('userAddress')

  if (!userAddress) {
    return new Response(JSON.stringify({ error: 'User address required' }), { status: 400 })
  }

  const kv = getCloudflareContext().env.JURY_DATA;
  
  // Get progress for different screen types
  const types = ['background', 'scale', 'similar', 'comparison', 'originality'];
  const progress = {};
  
  for (const type of types) {
    const indexKey = `user:${userAddress}:${type}:_index`;
    const indices = await kv.get(indexKey, { type: "json" }) || [];
    
    let submitted = 0;
    let draft = 0;
    
    for (const id of indices) {
      const key = `user:${userAddress}:${type}:${id}`;
      const data = await kv.get(key, { type: "json" });
      if (data?.status === 'submitted') {
        submitted++;
      } else {
        draft++;
      }
    }
    
    progress[type] = {
      total: indices.length,
      submitted,
      draft
    };
  }

  return new Response(JSON.stringify({
    screens: progress,
    overall: {
      total: Object.values(progress).reduce((sum, p) => sum + p.total, 0),
      submitted: Object.values(progress).reduce((sum, p) => sum + p.submitted, 0),
    }
  }), { headers: { "content-type": "application/json" }});
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const userAddress = searchParams.get('userAddress')

  if (!userAddress) {
    return new Response(JSON.stringify({ error: 'User address required' }), { status: 400 })
  }

  const kv = getCloudflareContext().env.JURY_DATA;
  
  // Delete all data for user (for testing/cleanup)
  const types = ['background', 'scale', 'similar', 'comparison', 'originality'];
  
  for (const type of types) {
    const indexKey = `user:${userAddress}:${type}:_index`;
    const indices = await kv.get(indexKey, { type: "json" }) || [];
    
    // Delete all items
    for (const id of indices) {
      const key = `user:${userAddress}:${type}:${id}`;
      await kv.delete(key);
    }
    
    // Delete index
    await kv.delete(indexKey);
  }
  
  // Delete profile
  await kv.delete(`user:${userAddress}:profile`);

  return new Response(JSON.stringify({ success: true, message: 'User data deleted' }), { 
    headers: { "content-type": "application/json" }
  });
}