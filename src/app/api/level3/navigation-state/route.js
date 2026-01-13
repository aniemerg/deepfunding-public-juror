import { getCloudflareContext } from "@opennextjs/cloudflare"

export async function GET(req) {
  const url = new URL(req.url)
  const userAddress = url.searchParams.get('userAddress')
  const repoUrl = url.searchParams.get('repoUrl')

  if (!userAddress || !repoUrl) {
    return Response.json({ error: 'userAddress and repoUrl parameters are required' }, { status: 400 })
  }

  const kv = getCloudflareContext().env.JURY_DATA

  try {
    // Try cached navigation state first
    const cacheKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:navigation-state`
    const cached = await kv.get(cacheKey)
    if (cached) {
      return Response.json(JSON.parse(cached))
    }

    // Derive fresh state from KV plan and completion data
    const navigationState = await deriveNavigationStateFromKV(userAddress, repoUrl, kv)

    // Cache the result
    await kv.put(cacheKey, JSON.stringify(navigationState))

    return Response.json(navigationState)
  } catch (error) {
    console.error('Error getting Level 3 navigation state:', error)
    return Response.json({ error: 'Failed to get navigation state', details: error.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { userAddress, repoUrl, action, screenId, data } = await req.json()

    if (!userAddress || !repoUrl || !action) {
      return Response.json({ error: 'userAddress, repoUrl, and action required' }, { status: 400 })
    }

    const kv = getCloudflareContext().env.JURY_DATA

    switch (action) {
      case 'complete-screen':
        return await handleCompleteScreen(userAddress, repoUrl, screenId, data, kv)
      case 'navigate-to':
        return await handleNavigateToScreen(userAddress, repoUrl, screenId, kv)
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in Level 3 navigation state POST:', error)
    return Response.json({ error: 'Failed to update navigation state', details: error.message }, { status: 500 })
  }
}

async function deriveNavigationStateFromKV(userAddress, repoUrl, kv) {
  // Load plan
  const planKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:plan`
  const planData = await kv.get(planKey)

  if (!planData) {
    // No plan exists yet - return minimal state
    return {
      navigationItems: [],
      currentScreen: null,
      plan: null,
      repoUrl
    }
  }

  const plan = JSON.parse(planData)

  // Migrate plan schema if needed
  if (!plan.version || plan.version < 1) {
    plan.version = 1
    plan.skippedComparisons = 0
    await kv.put(planKey, JSON.stringify(plan))
    console.log(`Migrated Level 3 plan to v1 for user: ${userAddress}, repo: ${repoUrl}`)
  }

  // Load completion and skip status for all comparisons
  const completedScreens = new Set()
  const skippedScreens = new Set()
  const inProgressScreens = new Set()

  // Check each comparison
  for (let i = 0; i < plan.comparisons.length; i++) {
    const screenId = `comparison_${i}`
    const completedKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:completed:${screenId}`
    const inProgressKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:in-progress:${screenId}`

    const completedData = await kv.get(completedKey)
    const inProgress = await kv.get(inProgressKey)

    if (completedData) {
      const parsed = JSON.parse(completedData)

      // Migration: Add wasSkipped field to old completion records
      if (!('wasSkipped' in parsed)) {
        parsed.wasSkipped = false
        await kv.put(completedKey, JSON.stringify(parsed))
        console.log(`Migrated completion data to v2 for screen: ${screenId}`)
      }

      // Add to appropriate set
      if (parsed.wasSkipped) {
        skippedScreens.add(screenId)
      } else {
        completedScreens.add(screenId)
      }
    } else if (inProgress) {
      inProgressScreens.add(screenId)
    }
  }

  // Create navigation items from plan
  const navigationItems = createNavigationFromPlan(plan, completedScreens, skippedScreens, inProgressScreens)

  // Find current screen (first non-completed and non-skipped)
  const currentScreen = findCurrentScreen(navigationItems, completedScreens, skippedScreens)

  // Mark current screen as in-progress if not already completed or skipped
  if (currentScreen && currentScreen !== 'completion' &&
      !completedScreens.has(currentScreen) && !skippedScreens.has(currentScreen)) {
    const inProgressKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:in-progress:${currentScreen}`
    await kv.put(inProgressKey, JSON.stringify({
      startedAt: new Date().toISOString()
    }))
  }

  // Update the current screen's status to 'current'
  const updatedNavigationItems = navigationItems.map(item => ({
    ...item,
    status: item.id === currentScreen ? 'current' : item.status
  }))

  // Update plan completion counts
  plan.completedComparisons = completedScreens.size
  plan.skippedComparisons = skippedScreens.size

  return {
    navigationItems: updatedNavigationItems,
    currentScreen,
    plan,
    repoUrl
  }
}

function createNavigationFromPlan(plan, completedScreens, skippedScreens, inProgressScreens) {
  const getStatus = (id) => {
    if (skippedScreens.has(id)) return 'skipped'
    if (completedScreens.has(id)) return 'completed'
    if (inProgressScreens.has(id)) return 'in-progress'
    return 'pending'
  }

  const items = []

  // Add comparison items
  plan.comparisons.forEach((comparison, index) => {
    const id = `comparison_${index}`
    items.push({
      id,
      screenType: 'level3_comparison',
      text: `Comparison: ${comparison.depA} vs ${comparison.depB}`,
      status: getStatus(id),
      data: {
        comparisonIndex: index,
        depA: comparison.depA,
        depB: comparison.depB,
        multiplier: comparison.multiplier
      }
    })
  })

  // Add completion screen - accessible when all comparisons are done (completed OR skipped)
  const allDone = items.every(item =>
    completedScreens.has(item.id) || skippedScreens.has(item.id)
  )

  items.push({
    id: 'completion',
    screenType: 'completion',
    text: 'Complete',
    status: allDone ? 'current' : 'pending',
    data: null
  })

  return items
}

function findCurrentScreen(navigationItems, completedScreens, skippedScreens) {
  // Find first non-completed and non-skipped comparison
  const incompleteScreen = navigationItems.find(item =>
    !completedScreens.has(item.id) && !skippedScreens.has(item.id) && item.id !== 'completion'
  )

  if (incompleteScreen) {
    return incompleteScreen.id
  }

  // If all comparisons completed or skipped, go to completion
  return 'completion'
}

async function handleCompleteScreen(userAddress, repoUrl, screenId, data, kv) {
  if (!screenId || !data) {
    return Response.json({ error: 'screenId and data required' }, { status: 400 })
  }

  const completedKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:completed:${screenId}`
  const inProgressKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:in-progress:${screenId}`

  // Read existing completion record to preserve wasSkipped flag
  const existingCompletion = await kv.get(completedKey)
  let existingWasSkipped = false
  if (existingCompletion) {
    const parsed = JSON.parse(existingCompletion)
    existingWasSkipped = parsed.wasSkipped || false
  }

  // Mark as completed and remove in-progress status
  await kv.delete(inProgressKey)
  await kv.put(completedKey, JSON.stringify({
    completed: true,
    wasSkipped: existingWasSkipped || data.wasSkipped || false,
    timestamp: new Date().toISOString(),
    data: data
  }))

  // Derive new navigation state
  const newState = await deriveNavigationStateFromKV(userAddress, repoUrl, kv)

  // Update cache
  const cacheKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:navigation-state`
  await kv.put(cacheKey, JSON.stringify(newState))

  return Response.json(newState)
}

async function handleNavigateToScreen(userAddress, repoUrl, screenId, kv) {
  if (!screenId) {
    return Response.json({ error: 'screenId required' }, { status: 400 })
  }

  // Get current state to validate navigation
  const currentState = await deriveNavigationStateFromKV(userAddress, repoUrl, kv)
  const targetItem = currentState.navigationItems.find(item => item.id === screenId)

  if (!targetItem) {
    return Response.json({ error: 'Screen not found' }, { status: 404 })
  }

  // Only allow navigation to completed, skipped, in-progress, or current screens
  const allowedStatuses = ['completed', 'skipped', 'in-progress', 'current']
  const isCurrentScreen = screenId === currentState.currentScreen

  if (!allowedStatuses.includes(targetItem.status) && !isCurrentScreen) {
    return Response.json({
      error: 'Navigation not allowed to pending screen',
      details: `Screen ${screenId} has status ${targetItem.status}`
    }, { status: 400 })
  }

  // Mark as in-progress if not already completed
  const completedKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:completed:${screenId}`
  const completed = await kv.get(completedKey)

  if (!completed && screenId !== 'completion') {
    const inProgressKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:in-progress:${screenId}`
    await kv.put(inProgressKey, JSON.stringify({
      startedAt: new Date().toISOString()
    }))
  }

  // Update navigation state - just change currentScreen
  const newState = {
    ...currentState,
    currentScreen: screenId
  }

  // Update status of the new current screen to 'current'
  newState.navigationItems = newState.navigationItems.map(item => ({
    ...item,
    status: item.id === screenId ? 'current' :
            item.id === currentState.currentScreen ? (item.status === 'current' ? 'in-progress' : item.status) :
            item.status
  }))

  // Cache the new state
  const cacheKey = `user:${userAddress}:level3:${encodeURIComponent(repoUrl)}:navigation-state`
  await kv.put(cacheKey, JSON.stringify(newState))

  return Response.json(newState)
}
