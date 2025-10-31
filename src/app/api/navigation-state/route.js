import { getCloudflareContext } from "@opennextjs/cloudflare"

export async function GET(req) {
  const url = new URL(req.url)
  console.log('🐛 Navigation-state GET: Full URL:', req.url)
  console.log('🐛 Navigation-state GET: Search params:', Array.from(url.searchParams.entries()))
  
  const userAddress = url.searchParams.get('userAddress')
  console.log('🐛 Navigation-state GET: Extracted userAddress:', userAddress)
  
  if (!userAddress) {
    console.log('Missing userAddress parameter in navigation-state GET request')
    return Response.json({ error: 'userAddress parameter is required' }, { status: 400 })
  }
  
  const kv = getCloudflareContext().env.JURY_DATA
  
  try {
    // Try cached navigation state first
    const cached = await kv.get(`user:${userAddress}:navigation-state`)
    if (cached) {
      return Response.json(JSON.parse(cached))
    }
    
    // Derive fresh state from KV completion data
    const navigationState = await deriveNavigationStateFromKV(userAddress, kv)
    
    // Cache the result
    await kv.put(`user:${userAddress}:navigation-state`, JSON.stringify(navigationState))
    
    return Response.json(navigationState)
  } catch (error) {
    console.error('Error getting navigation state:', error)
    return Response.json({ error: 'Failed to get navigation state' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { userAddress, action, screenId, data } = await req.json()
    
    if (!userAddress || !action) {
      return Response.json({ error: 'userAddress and action required' }, { status: 400 })
    }
    
    const kv = getCloudflareContext().env.JURY_DATA
    
    switch (action) {
      case 'complete-screen':
        return await handleCompleteScreen(userAddress, screenId, data, kv)
      case 'navigate-to':
        return await handleNavigateToScreen(userAddress, screenId, kv)
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in navigation state POST:', error)
    return Response.json({ error: 'Failed to update navigation state' }, { status: 500 })
  }
}

async function deriveNavigationStateFromKV(userAddress, kv) {
  // Load plan
  const planData = await kv.get(`user:${userAddress}:evaluation-plan`)
  const plan = planData ? JSON.parse(planData) : null
  
  if (!plan) {
    return getInitialNavigationState()
  }
  
  // Load completion status for all possible screens
  const completedScreens = new Set()
  
  // Check each screen type
  const screenChecks = [
    'background',
    'range_definition',
    ...plan.similarProjects.map((_, i) => `similar_projects_${i + 1}`),
    ...plan.comparisons.map((_, i) => `comparison_${i + 1}`)
  ]
  
  for (const screenId of screenChecks) {
    const completed = await kv.get(`user:${userAddress}:completed:${screenId}`)
    if (completed) {
      completedScreens.add(screenId)
    }
  }
  
  // Create navigation items from plan + completion data
  const navigationItems = createNavigationFromPlan(plan, completedScreens)
  
  // Find current screen (first non-completed)
  const currentScreen = findCurrentScreen(navigationItems, completedScreens)
  
  return { navigationItems, currentScreen, plan }
}

function getInitialNavigationState() {
  return {
    navigationItems: [
      {
        id: 'background',
        screenType: 'background',
        text: 'Background',
        status: 'current'
      }
    ],
    currentScreen: 'background',
    plan: null
  }
}

function createNavigationFromPlan(plan, completedScreens) {
  const items = [
    {
      id: 'background',
      screenType: 'background',
      text: 'Background',
      status: completedScreens.has('background') ? 'completed' : 'pending',
      data: null
    },
    {
      id: 'range_definition',
      screenType: 'range_definition',
      text: 'Range Definition',
      status: completedScreens.has('range_definition') ? 'completed' : 'pending',
      data: null
    }
  ]

  // Add similar projects with data
  plan.similarProjects.forEach((project, index) => {
    const id = `similar_projects_${index + 1}`
    items.push({
      id,
      screenType: 'similar_projects',
      text: `Similar: ${project.repo}`,
      status: completedScreens.has(id) ? 'completed' : 'pending',
      data: { targetProject: project }
    })
  })

  // Add comparisons with data
  plan.comparisons.forEach((pair, index) => {
    const id = `comparison_${index + 1}`
    items.push({
      id,
      screenType: 'comparison',
      text: `Comparison: ${pair[0].repo} vs ${pair[1].repo}`,
      status: completedScreens.has(id) ? 'completed' : 'pending',
      data: { projectPair: pair }
    })
  })

  // Add completion
  const allRequiredCompleted = items.every(item => completedScreens.has(item.id))
  items.push({
    id: 'completion',
    screenType: 'completion',
    text: 'Complete',
    status: allRequiredCompleted ? 'current' : 'pending',
    data: null
  })

  return items
}

function findCurrentScreen(navigationItems, completedScreens) {
  // Find first non-completed screen
  const incompleteScreen = navigationItems.find(item => 
    !completedScreens.has(item.id) && item.id !== 'completion'
  )
  
  if (incompleteScreen) {
    return incompleteScreen.id
  }
  
  // If all screens completed, go to completion
  return 'completion'
}

async function handleCompleteScreen(userAddress, screenId, data, kv) {
  if (!screenId || !data) {
    return Response.json({ error: 'screenId and data required' }, { status: 400 })
  }
  
  // 1. Mark as completed in KV
  await kv.put(`user:${userAddress}:completed:${screenId}`, JSON.stringify({
    completed: true,
    timestamp: new Date().toISOString(),
    data: data
  }))
  
  // 2. Submit to Google Sheets (write-only)
  await submitToGoogleSheets(userAddress, screenId, data)
  
  // 3. Derive new navigation state FIRST
  const newState = await deriveNavigationStateFromKV(userAddress, kv)
  
  // 4. THEN update cache atomically
  await kv.put(`user:${userAddress}:navigation-state`, JSON.stringify(newState))
  
  return Response.json(newState)
}

async function handleNavigateToScreen(userAddress, screenId, kv) {
  if (!screenId) {
    return Response.json({ error: 'screenId required' }, { status: 400 })
  }
  
  // 1. Get current state to validate navigation
  const currentState = await deriveNavigationStateFromKV(userAddress, kv)
  const targetItem = currentState.navigationItems.find(item => item.id === screenId)
  
  if (!targetItem) {
    return Response.json({ error: 'Screen not found' }, { status: 404 })
  }
  
  // Only allow navigation to completed screens or the current screen
  if (targetItem.status !== 'completed' && targetItem.status !== 'current') {
    return Response.json({ error: 'Navigation not allowed to pending screen' }, { status: 400 })
  }
  
  // 2. Update navigation state
  const newState = {
    ...currentState,
    currentScreen: screenId,
    navigationItems: currentState.navigationItems.map(item => ({
      ...item,
      status: item.id === screenId ? 'current' : 
              item.status === 'current' ? 'completed' : item.status
    }))
  }
  
  // 3. Cache the new state
  await kv.put(`user:${userAddress}:navigation-state`, JSON.stringify(newState))
  
  return Response.json(newState)
}

async function submitToGoogleSheets(userAddress, screenId, data) {
  try {
    // Import the individual sheet submission functions
    const { 
      submitBackgroundData,
      submitPersonalScaleData,
      submitSimilarProjectData,
      submitComparisonData,
      submitOriginalityData
    } = await import('@/lib/googleSheets')
    
    const { cookies } = await import('next/headers')
    const { getIronSession } = await import('iron-session')
    const { sessionOptions } = await import('@/lib/session')
    
    // Get ENS name from session
    const cookieStore = await cookies()
    const session = await getIronSession(cookieStore, sessionOptions)
    
    if (!session.user?.ensName) {
      throw new Error('Not authenticated or missing ENS name')
    }
    
    const ensName = session.user.ensName
    const env = getCloudflareContext().env
    const screenType = getScreenTypeFromId(screenId)
    
    // Route to appropriate submission function based on screen type
    switch (screenType) {
      case 'background':
        await submitBackgroundData(env, {
          ensName,
          backgroundText: data.backgroundText,
          wasSkipped: data.wasSkipped || false
        })
        break
        
      case 'personal_scale':
        await submitPersonalScaleData(env, {
          ensName,
          mostValuableRepo: data.mostValuableProject,
          leastValuableRepo: data.leastValuableProject,
          scaleMultiplier: data.scaleMultiplier,
          reasoning: data.reasoning || ''
        })
        break
        
      case 'similar_projects':
        const screenNumber = parseInt(screenId.split('_')[2]) || 1
        await submitSimilarProjectData(env, {
          ensName,
          screenNumber,
          targetRepo: data.targetProject,
          selectedRepo: data.similarProject,
          multiplier: data.similarMultiplier,
          reasoning: data.reasoning || ''
        })
        break
        
      case 'comparison':
        const comparisonNumber = parseInt(screenId.split('_')[1]) || 1
        const winner = data.winner
        const loser = winner === data.projectA ? data.projectB : data.projectA
        await submitComparisonData(env, {
          ensName,
          comparisonNumber,
          repoA: data.projectA,
          repoB: data.projectB,
          winner: winner,
          loser: loser,
          multiplier: data.multiplier,
          reasoning: data.reasoning || ''
        })
        break
        
      default:
        console.log(`Unknown screen type for Google Sheets: ${screenType}`)
        // Skip Google Sheets submission for unknown types
    }
  } catch (error) {
    console.error('Error submitting to Google Sheets:', error)
    // Don't fail the whole operation if sheets submission fails
  }
}

function getScreenTypeFromId(screenId) {
  if (screenId === 'background') return 'background'
  if (screenId === 'range_definition') return 'personal_scale'
  if (screenId.startsWith('similar_projects')) return 'similar_projects'
  if (screenId.startsWith('comparison')) return 'comparison'
  return screenId
}