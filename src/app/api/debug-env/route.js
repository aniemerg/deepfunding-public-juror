import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(req) {
  try {
    const env = getCloudflareContext().env;

    // Check which environment variables are set (without revealing values)
    const envCheck = {
      CLOUDFLARE_ENV: env.CLOUDFLARE_ENV || 'NOT_SET',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'NOT_SET',
      GOOGLE_PRIVATE_KEY: env.GOOGLE_PRIVATE_KEY ? 'SET (length: ' + env.GOOGLE_PRIVATE_KEY.length + ')' : 'NOT_SET',
      GOOGLE_SHEET_ID_PREVIEW: env.GOOGLE_SHEET_ID_PREVIEW ? 'SET' : 'NOT_SET',
      GOOGLE_SHEET_ID_PRODUCTION: env.GOOGLE_SHEET_ID_PRODUCTION ? 'SET' : 'NOT_SET',
      GOOGLE_SHEET_ID: env.GOOGLE_SHEET_ID ? 'SET' : 'NOT_SET',
      SESSION_SECRET: env.SESSION_SECRET ? 'SET' : 'NOT_SET',
      KV_AVAILABLE: env.JURY_DATA ? 'YES' : 'NO'
    };

    // Test Google Sheets getSheetId logic
    const cloudflareEnv = env.CLOUDFLARE_ENV || 'preview';
    const sheetIdKey = cloudflareEnv === 'production'
      ? 'GOOGLE_SHEET_ID_PRODUCTION'
      : 'GOOGLE_SHEET_ID_PREVIEW';
    const sheetId = env[sheetIdKey];

    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: cloudflareEnv,
      sheetIdKey: sheetIdKey,
      sheetIdFound: sheetId ? 'YES (first 10 chars: ' + sheetId.slice(0, 10) + '...)' : 'NO',
      envCheck
    }, null, 2), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }, null, 2), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
