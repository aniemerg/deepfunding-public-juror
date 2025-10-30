export async function appendRowToSheet(env, values) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const iss = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const scope = "https://www.googleapis.com/auth/spreadsheets";
  const aud = "https://oauth2.googleapis.com/token";
  const payload = { iss, scope, aud, iat: now, exp: now + 3600 };

  const enc = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');

  const unsigned = `${enc(header)}.${enc(payload)}`;
  const pkcs8 = `-----BEGIN PRIVATE KEY-----\n${env.GOOGLE_PRIVATE_KEY}\n-----END PRIVATE KEY-----`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    new TextEncoder().encode(pkcs8),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  }).then(r => r.json());

  const sheetId = env.GOOGLE_SHEET_ID;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "authorization": `Bearer ${tokenRes.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`);
}