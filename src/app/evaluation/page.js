'use client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { BackgroundScreen } from '@/components/BackgroundScreen'
import { RangeDefinitionScreen } from '@/components/RangeDefinitionScreen'
import { SimilarProjectsScreen } from '@/components/SimilarProjectsScreen'
import { ComparisonScreen } from '@/components/ComparisonScreen'
import { NavigationSidebar } from '@/components/NavigationSidebar'
import { useUserData } from '@/hooks/useAutoSave'

export default function EvaluationPage() {
  const { user, isLoggedIn, isLoading, logout } = useAuth()
  const router = useRouter()
  const [currentScreen, setCurrentScreen] = useState('background')
  const [navigationItems, setNavigationItems] = useState([
    {
      id: 'background',
      screenId: 'background',
      text: 'Background',
      status: 'current'
    }
  ])
  const [screenData, setScreenData] = useState({}) // Store data for revisiting screens
  const [isRestoringProgress, setIsRestoringProgress] = useState(false)
  const { loadProgress } = useUserData(user?.address)

  // Restore navigation progress from user's previous sessions
  const restoreNavigationProgress = useCallback(async () => {
    setIsRestoringProgress(true)
    
    try {
      const progress = await loadProgress()
      if (!progress?.screens) {
        setIsRestoringProgress(false)
        return
      }

      const { background, scale, similar, comparison } = progress.screens
      const restoredItems = []
      let nextScreen = 'background'

      // Always add background
      restoredItems.push({
        id: 'background',
        screenId: 'background',
        text: 'Background',
        status: background.submitted > 0 ? 'completed' : 'current'
      })

      if (background.submitted > 0) {
        nextScreen = 'range_definition'
        
        // Add range definition
        restoredItems.push({
          id: 'range_definition',
          screenId: 'range_definition',
          text: 'Range Definition',
          status: scale.submitted > 0 ? 'completed' : 'current'
        })

        if (scale.submitted > 0) {
          nextScreen = 'similar_projects_1'
          
          // Add similar projects (up to 2)
          for (let i = 1; i <= Math.min(similar.submitted, 2); i++) {
            restoredItems.push({
              id: `similar_projects_${i}`,
              screenId: 'similar_projects',
              text: `Similar: Loading...`, // Will be updated when screen loads
              status: 'completed'
            })
          }

          // If we have fewer than 2 similar projects, add the next one as current
          if (similar.submitted < 2) {
            const nextSimilarNum = similar.submitted + 1
            restoredItems.push({
              id: `similar_projects_${nextSimilarNum}`,
              screenId: 'similar_projects',
              text: `Similar: Loading...`,
              status: 'current'
            })
            nextScreen = `similar_projects_${nextSimilarNum}`
          } else {
            nextScreen = 'comparison_1'
            
            // Add comparison screens (up to 10)
            for (let i = 1; i <= Math.min(comparison.submitted, 10); i++) {
              restoredItems.push({
                id: `comparison_${i}`,
                screenId: 'comparison',
                text: `Comparison: Loading...`, // Will be updated when screen loads
                status: 'completed'
              })
            }

            // If we have fewer than 10 comparisons, add the next one as current
            if (comparison.submitted < 10) {
              const nextCompNum = comparison.submitted + 1
              restoredItems.push({
                id: `comparison_${nextCompNum}`,
                screenId: 'comparison',
                text: `Comparison: Loading...`,
                status: 'current'
              })
              nextScreen = `comparison_${nextCompNum}`
            } else {
              // All comparisons done - would go to completion
              nextScreen = 'completion'
              restoredItems.push({
                id: 'completion',
                screenId: 'completion',
                text: 'Complete',
                status: 'current'
              })
            }
          }
        }
      }

      setNavigationItems(restoredItems)
      setCurrentScreen(nextScreen)
      
    } catch (error) {
      console.error('Failed to restore navigation progress:', error)
    } finally {
      setIsRestoringProgress(false)
    }
  }, [loadProgress])

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login')
    }
  }, [isLoading, isLoggedIn, router])

  // Restore navigation progress when user is authenticated
  useEffect(() => {
    if (isLoggedIn && user?.address && !isRestoringProgress) {
      restoreNavigationProgress()
    }
  }, [isLoggedIn, user?.address, isRestoringProgress, restoreNavigationProgress])

  if (isLoading || isRestoringProgress) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          {isLoading ? 'Loading...' : 'Restoring progress...'}
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return null // Will redirect in useEffect
  }

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  // Add a new navigation item when needed
  const addNavigationItem = (itemData) => {
    setNavigationItems(prev => {
      const exists = prev.find(item => item.id === itemData.id)
      if (exists) return prev
      
      return [...prev, { ...itemData, status: 'current' }]
    })
  }

  // Update navigation item status
  const updateNavigationItem = (id, updates) => {
    setNavigationItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    )
  }

  // Handle project change from screens to update navigation text
  const handleProjectChange = (data) => {
    const currentNavItem = navigationItems.find(item => item.status === 'current')
    if (currentNavItem) {
      let newText = currentNavItem.text
      
      if (data.targetProject && currentNavItem.id.startsWith('similar_projects')) {
        newText = `Similar: ${data.targetProject}`
      } else if (data.projectA && data.projectB && currentNavItem.id.startsWith('comparison')) {
        newText = `Comparison: ${data.projectA} vs ${data.projectB}`
      }
      
      updateNavigationItem(currentNavItem.id, { text: newText })
    }
  }

  // Mark current item as completed and set new current
  const handleNext = (nextScreenData = null) => {
    // Mark current screen as completed
    updateNavigationItem(currentScreen, { status: 'completed' })
    
    // Determine next screen based on current screen
    let nextScreen = null
    let nextNavItem = null
    
    switch (currentScreen) {
      case 'background':
        nextScreen = 'range_definition'
        nextNavItem = {
          id: 'range_definition',
          screenId: 'range_definition', 
          text: 'Range Definition',
          status: 'current'
        }
        break
      case 'range_definition':
        // Add first similar project screen
        nextScreen = 'similar_projects_1'
        nextNavItem = {
          id: 'similar_projects_1',
          screenId: 'similar_projects',
          text: `Similar: ${nextScreenData?.targetProject || 'Loading...'}`,
          status: 'current'
        }
        break
      case 'similar_projects':
        // Check if this was the first or second similar project
        const similarCount = navigationItems.filter(item => item.id.startsWith('similar_projects')).length
        if (similarCount < 2) {
          nextScreen = 'similar_projects_2'
          nextNavItem = {
            id: 'similar_projects_2',
            screenId: 'similar_projects',
            text: `Similar: ${nextScreenData?.targetProject || 'Loading...'}`,
            status: 'current'
          }
        } else {
          // Move to first comparison
          nextScreen = 'comparison_1'
          nextNavItem = {
            id: 'comparison_1',
            screenId: 'comparison',
            text: `Comparison: ${nextScreenData?.projectA || 'Loading...'} vs ${nextScreenData?.projectB || 'Loading...'}`,
            status: 'current'
          }
        }
        break
      case 'comparison':
        // Check how many comparisons we've done
        const comparisonCount = navigationItems.filter(item => item.id.startsWith('comparison')).length
        if (comparisonCount < 10) {
          const nextCompNum = comparisonCount + 1
          nextScreen = `comparison_${nextCompNum}`
          nextNavItem = {
            id: `comparison_${nextCompNum}`,
            screenId: 'comparison',
            text: `Comparison: ${nextScreenData?.projectA || 'Loading...'} vs ${nextScreenData?.projectB || 'Loading...'}`,
            status: 'current'
          }
        } else {
          // Move to completion
          nextScreen = 'completion'
          nextNavItem = {
            id: 'completion',
            screenId: 'completion',
            text: 'Complete',
            status: 'current'
          }
        }
        break
    }
    
    if (nextScreen && nextNavItem) {
      addNavigationItem(nextNavItem)
      setCurrentScreen(nextScreen)
    }
  }

  const handleBack = () => {
    const navIndex = navigationItems.findIndex(item => item.screenId === currentScreen && item.status === 'current')
    if (navIndex > 0) {
      // Go to previous navigation item
      const prevItem = navigationItems[navIndex - 1]
      updateNavigationItem(currentScreen, { status: 'pending' })
      updateNavigationItem(prevItem.id, { status: 'current' })
      setCurrentScreen(prevItem.screenId)
    } else {
      router.push('/login')
    }
  }

  const handleNavigateToScreen = (screenId) => {
    // Find the navigation item for this screen
    const navItem = navigationItems.find(item => item.screenId === screenId && item.status !== 'pending')
    if (navItem) {
      // Update current status
      const currentNavItem = navigationItems.find(item => item.status === 'current')
      if (currentNavItem) {
        updateNavigationItem(currentNavItem.id, { status: 'completed' })
      }
      updateNavigationItem(navItem.id, { status: 'current' })
      setCurrentScreen(navItem.screenId)
    }
  }

  // Get current screen's navigation ID for tracking
  const getCurrentScreenId = () => {
    const currentNavItem = navigationItems.find(item => item.status === 'current')
    return currentNavItem?.screenId || currentScreen
  }

  // Get the base screen type for rendering (strips the instance number)
  const getBaseScreenType = () => {
    if (currentScreen.startsWith('similar_projects')) return 'similar_projects'
    if (currentScreen.startsWith('comparison')) return 'comparison'
    return currentScreen
  }

  const renderCurrentScreen = () => {
    const baseScreenId = getBaseScreenType()
    
    switch (baseScreenId) {
      case 'background':
        return (
          <BackgroundScreen 
            onNext={handleNext}
            onBack={handleBack}
          />
        )
      case 'range_definition':
        return (
          <RangeDefinitionScreen
            onNext={handleNext}
            onBack={handleBack}
          />
        )
      case 'similar_projects':
        return (
          <SimilarProjectsScreen
            onNext={(data) => handleNext(data)}
            onBack={handleBack}
            onProjectChange={handleProjectChange}
          />
        )
      case 'comparison':
        return (
          <ComparisonScreen
            onNext={(data) => handleNext(data)}
            onBack={handleBack}
            onProjectChange={handleProjectChange}
          />
        )
      case 'completion':
        return (
          <div style={styles.completionScreen}>
            <h2>🎉 Evaluation Complete!</h2>
            <p>Thank you for completing the evaluation process.</p>
            <p>Your assessments have been recorded and will help improve funding allocation in the Ethereum ecosystem.</p>
            <div style={styles.completionActions}>
              <button onClick={() => handleNavigateToScreen('background')} style={styles.reviewButton}>
                Review Your Submissions
              </button>
              <button onClick={handleLogout} style={styles.finishButton}>
                Finish & Logout
              </button>
            </div>
          </div>
        )
      default:
        return (
          <div style={styles.content}>
            <h2>Screen not implemented yet</h2>
            <p>Current screen: {currentScreen}</p>
          </div>
        )
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Deep Funding Public Juror</h1>
        <div style={styles.userInfo}>
          <span style={styles.address}>
            {user.ensName}
          </span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      <div style={styles.bodyContainer}>
        <NavigationSidebar 
          navigationItems={navigationItems}
          currentScreen={getCurrentScreenId()}
          onNavigate={handleNavigateToScreen}
        />
        
        <div style={styles.mainContent}>
          {renderCurrentScreen()}
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: '20px',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    zIndex: 101,
  },
  bodyContainer: {
    display: 'flex',
    flex: 1,
  },
  mainContent: {
    flex: 1,
    marginLeft: '280px', // Account for fixed sidebar width
    overflow: 'auto',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: 0,
    color: '#333',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  address: {
    fontSize: '14px',
    color: '#666',
    fontFamily: 'monospace',
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  content: {
    padding: '40px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  },
  completionScreen: {
    maxWidth: '600px',
    margin: '60px auto',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
  },
  completionActions: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    marginTop: '32px',
  },
  reviewButton: {
    padding: '12px 24px',
    backgroundColor: '#f7fafc',
    color: '#4a5568',
    border: '1px solid #cbd5e0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
  },
  finishButton: {
    padding: '12px 24px',
    backgroundColor: '#48bb78',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
  },
}