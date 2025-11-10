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
  let plan = planData ? JSON.parse(planData) : null

  // Migrate plan schema if needed
  if (plan) {
    let needsSave = false

    // Migration: v0 → v1 (added originalityProjects field)
    if (!plan.version || plan.version < 1) {
      const { getRandomProjectsForOriginality } = await import('@/lib/eloHelpers')
      plan.originalityProjects = getRandomProjectsForOriginality(3)
      plan.version = 1
      needsSave = true
      console.log(`Migrating plan to v1 (added originality) for user: ${userAddress}`)
    }

    // Future migrations go here:
    // if (plan.version < 2) {
    //   plan.newField = ...
    //   plan.version = 2
    //   needsSave = true
    // }

    if (needsSave) {
      await kv.put(`user:${userAddress}:evaluation-plan`, JSON.stringify(plan))
      console.log(`Saved migrated plan v${plan.version} for user: ${userAddress}`)
    }
  }

  if (!plan) {
    // Return a stub plan with background, range_definition, and repo_selection
    // Check completion and in-progress status for these screens
    const backgroundCompletedData = await kv.get(`user:${userAddress}:completed:background`)
    const rangeCompletedData = await kv.get(`user:${userAddress}:completed:range_definition`)
    const repoSelectionCompletedData = await kv.get(`user:${userAddress}:completed:repo_selection`)
    const backgroundInProgress = await kv.get(`user:${userAddress}:in-progress:background`)
    const rangeInProgress = await kv.get(`user:${userAddress}:in-progress:range_definition`)
    const repoSelectionInProgress = await kv.get(`user:${userAddress}:in-progress:repo_selection`)

    // Parse completion data to check for skip status
    const backgroundCompleted = !!backgroundCompletedData
    const rangeCompleted = !!rangeCompletedData
    const repoSelectionCompleted = !!repoSelectionCompletedData
    const backgroundSkipped = backgroundCompletedData ? JSON.parse(backgroundCompletedData).wasSkipped : false
    const rangeSkipped = rangeCompletedData ? JSON.parse(rangeCompletedData).wasSkipped : false
    const repoSelectionSkipped = repoSelectionCompletedData ? JSON.parse(repoSelectionCompletedData).wasSkipped : false

    // Determine current screen
    let currentScreen = 'background'
    if (backgroundCompleted && !rangeCompleted) {
      currentScreen = 'range_definition'
    } else if (rangeCompleted && !repoSelectionCompleted) {
      currentScreen = 'repo_selection'
    } else if (repoSelectionCompleted) {
      // All three completed but no plan yet - stay on repo_selection
      currentScreen = 'repo_selection'
    }

    // Mark current screen as in-progress if not already completed
    if (currentScreen === 'background' && !backgroundCompleted) {
      await kv.put(`user:${userAddress}:in-progress:background`, JSON.stringify({
        startedAt: new Date().toISOString()
      }))
    } else if (currentScreen === 'range_definition' && !rangeCompleted) {
      await kv.put(`user:${userAddress}:in-progress:range_definition`, JSON.stringify({
        startedAt: new Date().toISOString()
      }))
    } else if (currentScreen === 'repo_selection' && !repoSelectionCompleted) {
      await kv.put(`user:${userAddress}:in-progress:repo_selection`, JSON.stringify({
        startedAt: new Date().toISOString()
      }))
    }

    const getStatus = (id, completed, skipped, inProgress) => {
      if (skipped) return 'skipped'
      if (completed) return 'completed'
      if (id === currentScreen) return 'current'
      if (inProgress) return 'in-progress'
      return 'pending'
    }

    const navigationItems = [
      {
        id: 'background',
        screenType: 'background',
        text: 'Background',
        status: getStatus('background', backgroundCompleted, backgroundSkipped, backgroundInProgress)
      },
      {
        id: 'range_definition',
        screenType: 'range_definition',
        text: 'Personal Scale',
        status: getStatus('range_definition', rangeCompleted, rangeSkipped, rangeInProgress)
      },
      {
        id: 'repo_selection',
        screenType: 'repo_selection',
        text: 'Repo Selection',
        status: getStatus('repo_selection', repoSelectionCompleted, repoSelectionSkipped, repoSelectionInProgress)
      }
    ]

    return {
      navigationItems,
      currentScreen,
      plan: null
    }
  }
  
  // Load completion and in-progress status for all possible screens
  const completedScreens = new Set()
  const skippedScreens = new Set()
  const inProgressScreens = new Set()

  // Check each screen type
  const screenChecks = [
    'background',
    'range_definition',
    'repo_selection',
    ...plan.similarProjects.map((_, i) => `similar_projects_${i + 1}`),
    ...plan.comparisons.map((_, i) => `comparison_${i + 1}`)
  ]

  // Add originality screens if they exist in the plan
  if (plan.originalityProjects) {
    screenChecks.push(...plan.originalityProjects.map((_, i) => `originality_${i + 1}`))
  }

  // Migration: Add wasSkipped field to old completion records
  for (const screenId of screenChecks) {
    const completedData = await kv.get(`user:${userAddress}:completed:${screenId}`)
    const inProgress = await kv.get(`user:${userAddress}:in-progress:${screenId}`)
    if (completedData) {
      const parsed = JSON.parse(completedData)

      // Migration: v1 → v2 (added wasSkipped field to completion tracking)
      if (!('wasSkipped' in parsed)) {
        // Old data - add wasSkipped field and resave
        parsed.wasSkipped = false  // Default: assume not skipped for old data
        await kv.put(`user:${userAddress}:completed:${screenId}`, JSON.stringify(parsed))
        console.log(`Migrated completion data to v2 (added wasSkipped) for screen: ${screenId}`)
      }

      // Check if this was skipped - only add to one set, not both
      if (parsed.wasSkipped) {
        skippedScreens.add(screenId)
      } else {
        completedScreens.add(screenId)
      }
    } else if (inProgress) {
      inProgressScreens.add(screenId)
    }
  }
  
  // Create navigation items from plan + completion and in-progress data
  const navigationItems = createNavigationFromPlan(plan, completedScreens, skippedScreens, inProgressScreens)

  // Find current screen (first non-completed and non-skipped)
  const currentScreen = findCurrentScreen(navigationItems, completedScreens, skippedScreens)

  // Mark current screen as in-progress if not already completed or skipped
  if (!completedScreens.has(currentScreen) && !skippedScreens.has(currentScreen) && currentScreen !== 'completion') {
    await kv.put(`user:${userAddress}:in-progress:${currentScreen}`, JSON.stringify({
      startedAt: new Date().toISOString()
    }))
  }

  // Update the current screen's status to 'current'
  const updatedNavigationItems = navigationItems.map(item => ({
    ...item,
    status: item.id === currentScreen ? 'current' : item.status
  }))

  return { navigationItems: updatedNavigationItems, currentScreen, plan }
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

function getInitialNavigationStateWithStub() {
  // Check if background is completed to determine current screen
  return {
    navigationItems: [
      {
        id: 'background',
        screenType: 'background',
        text: 'Background',
        status: 'pending'  // Will be updated based on completion status
      },
      {
        id: 'range_definition',
        screenType: 'range_definition', 
        text: 'Personal Scale',
        status: 'pending'
      }
    ],
    currentScreen: 'background', // Will be updated based on completion status
    plan: null  // Stub - full plan will be generated after range_definition
  }
}

function createNavigationFromPlan(plan, completedScreens, skippedScreens, inProgressScreens) {
  const getStatus = (id) => {
    if (skippedScreens.has(id)) return 'skipped'
    if (completedScreens.has(id)) return 'completed'
    if (inProgressScreens.has(id)) return 'in-progress'
    return 'pending'
  }

  const items = [
    {
      id: 'background',
      screenType: 'background',
      text: 'Background',
      status: getStatus('background'),
      data: null
    },
    {
      id: 'range_definition',
      screenType: 'range_definition',
      text: 'Range Definition',
      status: getStatus('range_definition'),
      data: null
    },
    {
      id: 'repo_selection',
      screenType: 'repo_selection',
      text: 'Repo Selection',
      status: getStatus('repo_selection'),
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
      status: getStatus(id),
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
      status: getStatus(id),
      data: { projectPair: pair }
    })
  })

  // Add originality assessments with data
  if (plan.originalityProjects) {
    plan.originalityProjects.forEach((project, index) => {
      const id = `originality_${index + 1}`
      items.push({
        id,
        screenType: 'originality',
        text: `Originality: ${project.repo}`,
        status: getStatus(id),
        data: { targetProject: project }
      })
    })
  }

  // Add completion - accessible when all screens are either completed OR skipped
  const allRequiredDone = items.every(item =>
    completedScreens.has(item.id) || skippedScreens.has(item.id)
  )
  items.push({
    id: 'completion',
    screenType: 'completion',
    text: 'Complete',
    status: allRequiredDone ? 'current' : 'pending',
    data: null
  })

  return items
}

function findCurrentScreen(navigationItems, completedScreens, skippedScreens) {
  // Find first non-completed and non-skipped screen
  const incompleteScreen = navigationItems.find(item =>
    !completedScreens.has(item.id) && !skippedScreens.has(item.id) && item.id !== 'completion'
  )

  if (incompleteScreen) {
    return incompleteScreen.id
  }

  // If all screens completed or skipped, go to completion
  return 'completion'
}

async function handleCompleteScreen(userAddress, screenId, data, kv) {
  if (!screenId || !data) {
    return Response.json({ error: 'screenId and data required' }, { status: 400 })
  }

  // 1. Mark as completed in KV (and remove in-progress status)
  // IMPORTANT: Read existing completion record first to preserve wasSkipped flag
  const existingCompletion = await kv.get(`user:${userAddress}:completed:${screenId}`)
  let existingWasSkipped = false
  if (existingCompletion) {
    const parsed = JSON.parse(existingCompletion)
    existingWasSkipped = parsed.wasSkipped || false
  }

  await kv.delete(`user:${userAddress}:in-progress:${screenId}`)
  await kv.put(`user:${userAddress}:completed:${screenId}`, JSON.stringify({
    completed: true,
    wasSkipped: existingWasSkipped || data.wasSkipped || false,  // Preserve existing or use new
    timestamp: new Date().toISOString(),
    data: data
  }))
  
  // 2. If completing repo_selection and no plan exists, generate the full plan
  if (screenId === 'repo_selection') {
    const existingPlan = await kv.get(`user:${userAddress}:evaluation-plan`)
    if (!existingPlan) {
      // Load the selected repos from completion data
      const repoSelectionData = await kv.get(`user:${userAddress}:completed:repo_selection`)
      if (!repoSelectionData) {
        console.error('No repo selection data found when generating plan')
        throw new Error('Repo selection data not found')
      }

      const repoSelection = JSON.parse(repoSelectionData)
      const selectedRepoNames = repoSelection.data.finalSelectedRepos || []

      if (selectedRepoNames.length < 10) {
        console.error('Not enough selected repos for plan generation:', selectedRepoNames.length)
        throw new Error('Need at least 10 selected repos to generate plan')
      }

      // Convert repo names to project objects
      const { getProjectByRepo, getRandomPairFrom, getDiversePairFrom, getRandomProjectsForOriginalityFrom } = await import('@/lib/eloHelpers')
      const selectedRepos = selectedRepoNames.map(repo => getProjectByRepo(repo)).filter(p => p)

      // Get the most/least valuable repos for exclusion
      const mostValuable = repoSelection.data.mostValuableFromScale
      const leastValuable = repoSelection.data.leastValuableFromScale

      // Generate evaluation plan: 2 similar projects, 10 comparisons, 3 originality
      // All selected from the user's chosen repos
      const similarProjects = [
        selectedRepos[Math.floor(Math.random() * selectedRepos.length)],
        selectedRepos[Math.floor(Math.random() * selectedRepos.length)]
      ]

      // Generate comparisons, excluding most/least valuable being compared against each other
      const comparisons = []
      for (let i = 0; i < 10; i++) {
        let pair
        let attempts = 0
        // Try to get a valid pair (not most vs least)
        do {
          pair = i % 2 === 0 ? getRandomPairFrom(selectedRepos) : getDiversePairFrom(selectedRepos)
          attempts++
        } while (
          pair &&
          ((pair[0].repo === mostValuable && pair[1].repo === leastValuable) ||
           (pair[0].repo === leastValuable && pair[1].repo === mostValuable)) &&
          attempts < 20 // Prevent infinite loop
        )
        if (pair) {
          comparisons.push(pair)
        }
      }

      const originalityProjects = getRandomProjectsForOriginalityFrom(selectedRepos, 3)

      const plan = {
        version: 2,  // Schema version (v2 includes selectedRepos)
        selectedRepos: selectedRepoNames,  // Store the repo names
        similarProjects,
        comparisons,
        originalityProjects,
        planGenerated: new Date().toISOString(),
        userAddress
      }

      // Save the generated plan
      await kv.put(`user:${userAddress}:evaluation-plan`, JSON.stringify(plan))
      console.log('Generated full evaluation plan after repo_selection for user:', userAddress)
    }
  }
  
  // 3. Derive new navigation state
  // Note: Google Sheets submission is handled by each screen component directly
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

  // Only allow navigation to completed, skipped, in-progress, or current screens
  const allowedStatuses = ['completed', 'skipped', 'in-progress', 'current']
  const isCurrentScreen = screenId === currentState.currentScreen

  if (!allowedStatuses.includes(targetItem.status) && !isCurrentScreen) {
    return Response.json({
      error: 'Navigation not allowed to pending screen',
      details: `Screen ${screenId} has status ${targetItem.status}`
    }, { status: 400 })
  }

  // 2. Mark as in-progress if not already completed
  const completed = await kv.get(`user:${userAddress}:completed:${screenId}`)
  if (!completed && screenId !== 'completion') {
    await kv.put(`user:${userAddress}:in-progress:${screenId}`, JSON.stringify({
      startedAt: new Date().toISOString()
    }))
  }

  // 3. Update navigation state - just change currentScreen, keep status from KV
  const newState = {
    ...currentState,
    currentScreen: screenId
    // navigationItems stay the same - their status comes from KV completion data
  }

  // 4. Update status of the new current screen to 'current'
  newState.navigationItems = newState.navigationItems.map(item => ({
    ...item,
    status: item.id === screenId ? 'current' :
            item.id === currentState.currentScreen ? (item.status === 'current' ? 'in-progress' : item.status) :
            item.status
  }))

  // 5. Cache the new state
  await kv.put(`user:${userAddress}:navigation-state`, JSON.stringify(newState))

  return Response.json(newState)
}


function getScreenTypeFromId(screenId) {
  if (screenId === 'background') return 'background'
  if (screenId === 'range_definition') return 'personal_scale'
  if (screenId.startsWith('similar_projects')) return 'similar_projects'
  if (screenId.startsWith('comparison')) return 'comparison'
  if (screenId.startsWith('originality')) return 'originality'
  return screenId
}