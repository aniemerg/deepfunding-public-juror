import { useState, useCallback } from 'react'
import { getRandomProject, getRandomPair, getDiversePair, getRandomProjectsForOriginality } from '@/lib/eloHelpers'

export function useEvaluationPlan(userAddress) {
  const [plan, setPlan] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Generate a complete evaluation plan
  const generatePlan = useCallback(() => {
    console.log('🎯 Generating evaluation plan...')

    // 2 Similar Projects
    const similarProjects = [
      getRandomProject(),
      getRandomProject()
    ]

    // 10 Comparisons - mix random and diverse pairs for variety
    const comparisons = []
    for (let i = 0; i < 10; i++) {
      const pair = i % 2 === 0 ? getRandomPair() : getDiversePair()
      comparisons.push(pair)
    }

    // 3 Originality assessments - random projects
    const originalityProjects = getRandomProjectsForOriginality(3)

    const newPlan = {
      similarProjects,
      comparisons,
      originalityProjects,
      planGenerated: new Date().toISOString(),
      userAddress
    }

    console.log('✅ Plan generated:', {
      similarCount: similarProjects.length,
      comparisonCount: comparisons.length,
      originalityCount: originalityProjects.length,
      similarProjects: similarProjects.map(p => p.repo),
      comparisons: comparisons.map(pair => `${pair[0].repo} vs ${pair[1].repo}`),
      originalityProjects: originalityProjects.map(p => p.repo)
    })

    setPlan(newPlan)
    savePlanToKV(newPlan)
    return newPlan
  }, [userAddress])

  // Save plan to KV storage
  const savePlanToKV = async (planData) => {
    if (!userAddress) return
    
    try {
      const response = await fetch('/api/save-evaluation-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          plan: planData
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save plan')
      }
      
      console.log('💾 Plan saved to KV')
    } catch (error) {
      console.error('Failed to save plan:', error)
    }
  }

  // Load existing plan from KV storage
  const loadExistingPlan = useCallback(async () => {
    if (!userAddress) return null
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/save-evaluation-plan?userAddress=${userAddress}`)
      
      if (response.ok) {
        const savedPlan = await response.json()
        if (savedPlan) {
          console.log('📋 Loaded existing plan:', savedPlan)
          setPlan(savedPlan)
          return savedPlan
        }
      }
      
      return null
    } catch (error) {
      console.error('Failed to load plan:', error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [userAddress])

  // Create navigation items from plan
  const createNavigationFromPlan = useCallback((planData, completedScreens = new Set()) => {
    if (!planData) return []

    const items = [
      {
        id: 'background',
        screenType: 'background',
        text: 'Background',
        status: completedScreens.has('background') ? 'completed' : 'current'
      },
      {
        id: 'range_definition',
        screenType: 'range_definition',
        text: 'Range Definition',
        status: completedScreens.has('range_definition') ? 'completed' : 
                completedScreens.has('background') ? 'current' : 'pending'
      }
    ]

    // Add similar projects with actual names and data
    planData.similarProjects.forEach((project, index) => {
      const id = `similar_projects_${index + 1}`
      items.push({
        id,
        screenType: 'similar_projects',
        text: `Similar: ${project.repo}`,
        status: completedScreens.has(id) ? 'completed' : 
                shouldBeCurrentScreen(id, completedScreens, items) ? 'current' : 'pending',
        data: { targetProject: project }
      })
    })

    // Add comparisons with actual names and data
    planData.comparisons.forEach((pair, index) => {
      const id = `comparison_${index + 1}`
      items.push({
        id,
        screenType: 'comparison',
        text: `Comparison: ${pair[0].repo} vs ${pair[1].repo}`,
        status: completedScreens.has(id) ? 'completed' :
                shouldBeCurrentScreen(id, completedScreens, items) ? 'current' : 'pending',
        data: { projectPair: pair }
      })
    })

    // Add originality assessments with actual names and data
    if (planData.originalityProjects) {
      planData.originalityProjects.forEach((project, index) => {
        const id = `originality_${index + 1}`
        items.push({
          id,
          screenType: 'originality',
          text: `Originality: ${project.repo}`,
          status: completedScreens.has(id) ? 'completed' :
                  shouldBeCurrentScreen(id, completedScreens, items) ? 'current' : 'pending',
          data: { targetProject: project }
        })
      })
    }

    // Add completion
    items.push({
      id: 'completion',
      screenType: 'completion',
      text: 'Complete',
      status: allScreensCompleted(completedScreens, planData) ? 'current' : 'pending'
    })

    return items
  }, [])

  return {
    plan,
    isLoading,
    generatePlan,
    loadExistingPlan,
    createNavigationFromPlan
  }
}

// Helper function to determine if a screen should be current
function shouldBeCurrentScreen(screenId, completedScreens, allItems) {
  // Find all items before this one
  const currentIndex = allItems.findIndex(item => item.id === screenId)
  if (currentIndex === 0) return !completedScreens.has(screenId)
  
  // Check if all previous screens are completed
  const previousItems = allItems.slice(0, currentIndex)
  const allPreviousCompleted = previousItems.every(item => 
    completedScreens.has(item.id) || item.status === 'completed'
  )
  
  return allPreviousCompleted && !completedScreens.has(screenId)
}

// Helper function to check if all screens are completed
function allScreensCompleted(completedScreens, plan) {
  const requiredScreens = [
    'background',
    'range_definition',
    ...plan.similarProjects.map((_, i) => `similar_projects_${i + 1}`),
    ...plan.comparisons.map((_, i) => `comparison_${i + 1}`)
  ]

  // Add originality screens if they exist in the plan
  if (plan.originalityProjects) {
    requiredScreens.push(
      ...plan.originalityProjects.map((_, i) => `originality_${i + 1}`)
    )
  }

  return requiredScreens.every(screenId => completedScreens.has(screenId))
}