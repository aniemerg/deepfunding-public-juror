import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import {
  submitBackgroundData,
  submitPersonalScaleData,
  submitSimilarProjectData,
  submitComparisonData,
  submitOriginalityData,
  submitRepoSelectionData,
  submitTopProjectsData
} from "@/lib/googleSheets";

export async function POST(req) {
  const body = await req.json(); // { user, dataType, id, payload, sessionId }
  const env = getCloudflareContext().env;
  const kv = env.JURY_DATA;

  try {
    // Get ENS name from session
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    
    if (!session.user?.ensName) {
      return new Response(JSON.stringify({ error: 'Not authenticated or missing ENS name' }), { status: 401 });
    }
    
    const { user: walletAddress, dataType, id, payload } = body;
    const ensName = session.user.ensName;

    // Check if this was skipped - skip Google Sheets submission for skipped screens
    const isSkipped = payload.wasSkipped === true;

    switch (dataType) {
      case 'background':
        // Only submit to sheets if not skipped
        if (!isSkipped) {
          await submitBackgroundData(env, {
            ensName,
            backgroundText: payload.backgroundText
          });
        }
        break;

      case 'top_projects':
        if (!isSkipped) {
          await submitTopProjectsData(env, {
            ensName,
            selectedRepos: payload.selectedRepos.join(','),
            screenOpenedAt: payload.screenOpenedAt,
            reposShownOrder: payload.reposShownOrder.join(',')
          });
        }
        break;

      case 'personal_scale':
        if (!isSkipped) {
          await submitPersonalScaleData(env, {
            ensName,
            mostValuableRepo: payload.mostValuableProject,
            leastValuableRepo: payload.leastValuableProject,
            scaleMultiplier: payload.scaleMultiplier,
            reasoning: payload.reasoning || ''
          });
        }
        break;

      case 'similar_projects':
        if (!isSkipped) {
          // Parse screen number from id (e.g., "similar-1" -> 1)
          const screenNumber = parseInt(id.split('-')[1]) || 1;
          await submitSimilarProjectData(env, {
            ensName,
            screenNumber,
            targetRepo: payload.targetProject,
            selectedRepo: payload.similarProject,
            multiplier: payload.similarMultiplier,
            reasoning: payload.reasoning || ''
          });
        }
        break;

      case 'comparison':
        if (!isSkipped) {
          // Parse comparison number from id (e.g., "comparison-3" -> 3)
          const comparisonNumber = parseInt(id.split('-')[1]) || 1;
          const winner = payload.winner;
          const loser = winner === payload.projectA ? payload.projectB : payload.projectA;
          await submitComparisonData(env, {
            ensName,
            comparisonNumber,
            repoA: payload.projectA,
            repoB: payload.projectB,
            winner: winner,
            loser: loser,
            multiplier: payload.multiplier,
            reasoning: payload.reasoning || ''
          });
        }
        break;

      case 'originality':
        if (!isSkipped) {
          await submitOriginalityData(env, {
            ensName,
            targetRepo: payload.targetRepo,
            originalityPercentage: payload.originalityPercentage,
            reasoning: payload.reasoning
          });
        }
        break;

      case 'repo_selection':
        if (!isSkipped) {
          await submitRepoSelectionData(env, {
            ensName,
            initialRepos: payload.initialRepos.join(','),
            vetoedRepos: payload.vetoedRepos.join(','),
            finalRepos: payload.finalSelectedRepos.join(','),
            reasoning: payload.reasoning || ''
          });
        }
        break;

      default:
        // For unknown screen types, log an error but don't fail
        console.error(`Unknown screen type: ${dataType}`);
        // Skip Google Sheets submission for unknown types
    }

    // Update KV status to submitted
    const k = id ? `user:${walletAddress}:${dataType}:${id}` : `user:${walletAddress}:${dataType}`;
    await kv.put(k, JSON.stringify({
      data: payload,
      status: "submitted",
      updatedAt: new Date().toISOString(),
      sessionId: session.user?.address || 'unknown'
    }));

    // NEW: Mark as completed in navigation state tracking
    const screenId = getScreenIdFromDataType(dataType, id, payload);
    if (screenId) {
      await kv.put(`user:${walletAddress}:completed:${screenId}`, JSON.stringify({
        completed: true,
        wasSkipped: payload.wasSkipped || false,  // Track skip status
        timestamp: new Date().toISOString(),
        data: payload
      }));

      // Clear navigation cache so it will be re-derived
      await kv.delete(`user:${walletAddress}:navigation-state`);
    }

    return new Response(JSON.stringify({
      ok: true,
      submittedTo: isSkipped ? 'kv-only' : 'google-sheets',
      wasSkipped: isSkipped
    }), { headers: { "content-type": "application/json" }});
    
  } catch (error) {
    console.error('Submit screen error:', error);
    
    // Still save to KV even if Google Sheets fails
    const k = body.id ? `user:${body.user}:${body.dataType}:${body.id}` : `user:${body.user}:${body.dataType}`;
    await kv.put(k, JSON.stringify({
      data: body.payload,
      status: "submitted",
      updatedAt: new Date().toISOString(),
      error: error.message
    }));
    
    return new Response(JSON.stringify({ 
      ok: true, 
      warning: 'Saved to KV but Google Sheets submission failed',
      error: error.message 
    }), { headers: { "content-type": "application/json" }});
  }
}

// Helper function to convert dataType and id to screenId for navigation state
function getScreenIdFromDataType(dataType, id, payload) {
  switch (dataType) {
    case 'background':
      return 'background'
    case 'top_projects':
      return 'top_projects'
    case 'personal_scale':
      return 'range_definition'
    case 'similar_projects':
      // If id already has underscores (new format), return as-is
      if (id.includes('_')) {
        return id
      }
      // Legacy: Parse screen number from id (e.g., "similar-1" -> "similar_projects_1")
      const screenNumber = parseInt(id.split('-').pop()) || 1;
      return `similar_projects_${screenNumber}`
    case 'comparison':
      // If id already has underscores (new format), return as-is
      if (id.includes('_')) {
        return id
      }
      // Legacy: Parse comparison number from id (e.g., "comparison-3" -> "comparison_3")
      const comparisonNumber = parseInt(id.split('-').pop()) || 1;
      return `comparison_${comparisonNumber}`
    case 'originality':
      // If id already has underscores (new format), return as-is
      if (id.includes('_')) {
        return id
      }
      // Legacy: Parse originality number from id (e.g., "originality-1" -> "originality_1")
      const originalityNumber = parseInt(id.split('-').pop()) || 1;
      return `originality_${originalityNumber}`
    case 'repo_selection':
      return 'repo_selection'
    default:
      return null
  }
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