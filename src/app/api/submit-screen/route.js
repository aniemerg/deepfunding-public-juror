import { getCloudflareContext } from "@opennextjs/cloudflare";
import { appendRowToSheet } from "@/lib/googleSheets";

export async function POST(req) {
  const body = await req.json(); // { user, dataType, id, payload }
  const env = getCloudflareContext().env;
  const kv = env.JURY_DATA;

  // append to Sheets
  const row = [
    new Date().toISOString(),
    body.user,
    body.dataType,
    body.id ?? "",
    "submitted",
    JSON.stringify(body.payload),
  ];
  await appendRowToSheet(env, row);

  // flip KV status to submitted for the same key
  const k = body.id ? `user:${body.user}:${body.dataType}:${body.id}` : `user:${body.user}:${body.dataType}`;
  await kv.put(k, JSON.stringify({
    data: body.payload,
    status: "submitted",
    updatedAt: new Date().toISOString(),
  }));

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" }});
}

// Get submission status for a screen
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userAddress = searchParams.get('userAddress')
  const screenType = searchParams.get('screenType')
  const screenId = searchParams.get('screenId')

  if (!userAddress || !screenType || !screenId) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 })
  }

  const kv = getCloudflareContext().env.JURY_DATA;
  const k = `user:${userAddress}:${screenType}:${screenId}`;
  const data = await kv.get(k, { type: "json" });

  return new Response(JSON.stringify({
    exists: !!data,
    status: data?.status || 'not_found',
    lastSubmittedAt: data?.updatedAt || null,
    data: data?.data || null
  }), { headers: { "content-type": "application/json" }});
}