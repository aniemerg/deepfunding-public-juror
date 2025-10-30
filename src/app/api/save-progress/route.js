import { getCloudflareContext } from "@opennextjs/cloudflare";

function key(user, dataType, id) {
  return id ? `user:${user}:${dataType}:${id}` : `user:${user}:${dataType}`;
}

export async function POST(req) {
  const body = await req.json();
  if (!body?.user || !body?.dataType) {
    return new Response(JSON.stringify({ ok: false, error: "invalid input" }), { status: 400 });
  }

  const kv = getCloudflareContext().env.JURY_DATA;
  const k = key(body.user, body.dataType, body.id);

  await kv.put(k, JSON.stringify({
    data: body.payload,
    status: "draft",
    updatedAt: new Date().toISOString(),
  }));

  // maintain _index per dataType
  const idxKey = key(body.user, body.dataType, "_index");
  const current = await kv.get(idxKey, { type: "json" });
  const next = new Set(current ?? []);
  if (body.id) next.add(body.id);
  await kv.put(idxKey, JSON.stringify([...next]));

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" }});
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userAddress = searchParams.get('userAddress')
  const dataType = searchParams.get('type')
  const id = searchParams.get('id')

  if (!userAddress) {
    return new Response(JSON.stringify({ error: 'User address required' }), { status: 400 })
  }

  const kv = getCloudflareContext().env.JURY_DATA;
  const k = key(userAddress, dataType || 'profile', id);
  const data = await kv.get(k, { type: "json" });

  return new Response(JSON.stringify(data || {}), { headers: { "content-type": "application/json" }});
}