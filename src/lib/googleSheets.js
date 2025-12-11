// Get the correct Google Sheet ID based on environment
function getSheetId(env) {
  const cloudflareEnv = env.CLOUDFLARE_ENV || 'preview'; // Default to preview for safety

  const sheetIdKey = cloudflareEnv === 'production'
    ? 'GOOGLE_SHEET_ID_PRODUCTION'
    : 'GOOGLE_SHEET_ID_PREVIEW';

  const sheetId = env[sheetIdKey];

  if (!sheetId) {
    throw new Error(
      `Missing Google Sheet ID for environment "${cloudflareEnv}". ` +
      `Expected env var: ${sheetIdKey}. ` +
      `Set CLOUDFLARE_ENV=preview or production and configure the corresponding sheet ID.`
    );
  }

  console.log(`Using Google Sheet for ${cloudflareEnv} environment: ${sheetId.slice(0, 10)}...`);
  return sheetId;
}

// Generate JWT token for Google Sheets API
async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const iss = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const scope = "https://www.googleapis.com/auth/spreadsheets";
  const aud = "https://oauth2.googleapis.com/token";
  const payload = { iss, scope, aud, iat: now, exp: now + 3600 };

  const enc = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');

  const unsigned = `${enc(header)}.${enc(payload)}`;
  
  // Handle private key - need to extract the base64 content and decode it
  let privateKey = env.GOOGLE_PRIVATE_KEY;
  
  // Replace escaped newlines with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  // Extract the base64 content between the headers
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  
  // Remove headers if present
  if (privateKey.includes(pemHeader)) {
    privateKey = privateKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\n/g, ''); // Remove all newlines to get pure base64
  }
  
  // Decode the base64 private key to binary
  const binaryKey = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
    
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
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

  if (!tokenRes.access_token) {
    throw new Error(`Auth failed: ${JSON.stringify(tokenRes)}`);
  }

  return tokenRes.access_token;
}

// Generate unique submission ID
function generateSubmissionId() {
  return crypto.randomUUID();
}

// Mark previous submissions as not latest
async function markPreviousSubmissionsOld(env, accessToken, sheetName, walletAddress, screenType = null) {
  const sheetId = getSheetId(env);
  
  // Get all data from the sheet
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}`;
  const res = await fetch(url, {
    headers: { "authorization": `Bearer ${accessToken}` }
  });
  
  if (!res.ok) return; // Sheet might not exist yet
  
  const data = await res.json();
  if (!data.values || data.values.length <= 1) return; // No data or just headers
  
  const rows = data.values;
  const headers = rows[0];
  
  // Find column indices
  const walletCol = headers.indexOf('wallet_address');
  const isLatestCol = headers.indexOf('is_latest');
  const screenCol = screenType ? headers.indexOf('screen_number') : -1;
  
  if (walletCol === -1 || isLatestCol === -1) return;
  
  // Find rows to update
  const updates = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[walletCol] === walletAddress && row[isLatestCol] === 'TRUE') {
      // For screens with screen_number (like similar projects), only mark same screen type
      if (screenType && screenCol !== -1 && row[screenCol] !== screenType.toString()) {
        continue;
      }
      
      updates.push({
        range: `${sheetName}!${String.fromCharCode(65 + isLatestCol)}${i + 1}`,
        values: [['FALSE']]
      });
    }
  }
  
  // Batch update if we have changes
  if (updates.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: "POST",
      headers: { "authorization": `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: updates
      })
    });
  }
}

// Submit background screen data
export async function submitBackgroundData(env, { ensName, backgroundText, contactInfo }) {
  const accessToken = await getAccessToken(env);
  const submissionId = generateSubmissionId();
  const sheetName = "Background";

  const values = [
    submissionId,
    1, // version
    ensName,
    new Date().toISOString(),
    backgroundText || '',
    contactInfo || ''
  ];

  return await appendToSheet(env, accessToken, sheetName, values);
}

// Submit personal scale data
export async function submitPersonalScaleData(env, { ensName, mostValuableRepo, leastValuableRepo, scaleMultiplier, reasoning }) {
  const accessToken = await getAccessToken(env);
  const submissionId = generateSubmissionId();
  const sheetName = "PersonalScale";
  
  const values = [
    submissionId,
    1, // version
    ensName,
    new Date().toISOString(),
    mostValuableRepo,
    leastValuableRepo,
    scaleMultiplier.toString(),
    reasoning || ''
  ];
  
  return await appendToSheet(env, accessToken, sheetName, values);
}

// Submit similar project data
export async function submitSimilarProjectData(env, { ensName, screenNumber, targetRepo, selectedRepo, multiplier, reasoning }) {
  const accessToken = await getAccessToken(env);
  const submissionId = generateSubmissionId();
  const sheetName = "SimilarProjects";

  const values = [
    submissionId,
    1, // version
    ensName,
    new Date().toISOString(),
    screenNumber.toString(),
    targetRepo,
    selectedRepo,
    multiplier ? multiplier.toString() : '',
    reasoning || ''
  ];

  return await appendToSheet(env, accessToken, sheetName, values);
}

// Submit comparison data
export async function submitComparisonData(env, { ensName, comparisonNumber, repoA, repoB, winner, loser, multiplier, reasoning }) {
  const accessToken = await getAccessToken(env);
  const submissionId = generateSubmissionId();
  const sheetName = "Comparisons";

  const values = [
    submissionId,
    1, // version
    ensName,
    new Date().toISOString(),
    comparisonNumber.toString(),
    repoA,
    repoB,
    winner,
    loser,
    multiplier.toString(),
    reasoning || ''
  ];

  return await appendToSheet(env, accessToken, sheetName, values);
}

// Submit originality data
export async function submitOriginalityData(env, { ensName, targetRepo, originalityPercentage, reasoning }) {
  const accessToken = await getAccessToken(env);
  const submissionId = generateSubmissionId();
  const sheetName = "Originality";

  const values = [
    submissionId,
    1, // version
    ensName,
    new Date().toISOString(),
    targetRepo,
    originalityPercentage.toString(),
    reasoning || ''
  ];

  return await appendToSheet(env, accessToken, sheetName, values);
}

// Submit top projects data
export async function submitTopProjectsData(env, { ensName, selectedRepos, screenOpenedAt, reposShownOrder }) {
  const accessToken = await getAccessToken(env);
  const submissionId = generateSubmissionId();
  const sheetName = "TopProjects";

  const values = [
    submissionId,
    1, // version
    ensName,
    screenOpenedAt,
    new Date().toISOString(), // submission timestamp
    selectedRepos, // comma-separated string
    reposShownOrder // comma-separated string of all repos in order shown
  ];

  return await appendToSheet(env, accessToken, sheetName, values);
}

// Submit repo selection data
export async function submitRepoSelectionData(env, { ensName, initialRepos, vetoedRepos, finalRepos, reasoning }) {
  const accessToken = await getAccessToken(env);
  const submissionId = generateSubmissionId();
  const sheetName = "RepoSelection";

  const values = [
    submissionId,
    1, // version
    ensName,
    new Date().toISOString(),
    initialRepos, // comma-separated string
    vetoedRepos, // comma-separated string
    finalRepos, // comma-separated string
    reasoning || ''
  ];

  return await appendToSheet(env, accessToken, sheetName, values);
}

// Generic append function
async function appendToSheet(env, accessToken, sheetName, values) {
  const sheetId = getSheetId(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "authorization": `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ values: [values] }),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Sheets append failed: ${res.status} ${errorText}`);
  }
  
  return await res.json();
}

// Submit session data (login tracking)
export async function submitSessionData(env, { ensName, walletAddress, inviteCode }) {
  const accessToken = await getAccessToken(env);
  const sheetName = "Sessions";
  
  const values = [
    ensName,
    walletAddress.toLowerCase(),
    inviteCode || '',
    new Date().toISOString()
  ];
  
  return await appendToSheet(env, accessToken, sheetName, values);
}

// Legacy function for backward compatibility - now routes to appropriate function
export async function appendRowToSheet(env, values) {
  // This is the old function - we'll need to update submit-screen API to use the new functions
  throw new Error("appendRowToSheet is deprecated. Use specific submit functions.");
}