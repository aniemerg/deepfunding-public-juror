'use client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { BackgroundScreen } from '@/components/BackgroundScreen'
import { RangeDefinitionScreen } from '@/components/RangeDefinitionScreen'
import { SimilarProjectsScreen } from '@/components/SimilarProjectsScreen'
import { ComparisonScreen } from '@/components/ComparisonScreen'
import { OriginalityScreen } from '@/components/OriginalityScreen'
import { NavigationSidebar } from '@/components/NavigationSidebar'
import { useServerNavigationState } from '@/hooks/useServerNavigationState'

export default function EvaluationPage() {
  const { user, isLoggedIn, isLoading, logout } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Debug logging - try multiple possible address fields
  const userAddress = user?.address || user?.ensName || user?.walletAddress
  console.log('EvaluationPage: Auth state:', { user, isLoggedIn, isLoading, userAddress })

  const { state: navigationState, loading: navigationLoading, error: navigationError, completeScreen, navigateToScreen, refreshState } = useServerNavigationState(userAddress)


  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login')
    }
  }, [isLoading, isLoggedIn, router])

  if (isLoading || navigationLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          {isLoading ? 'Loading...' : 'Loading navigation...'}
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return null // Will redirect in useEffect
  }

  if (navigationError) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          Error loading navigation: {navigationError}
          <br />
          <button onClick={() => window.location.reload()} style={styles.logoutButton}>
            Reload Page
          </button>
        </div>
      </div>
    )
  }

  if (!navigationState) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          Initializing navigation...
          <br />
          <button onClick={async () => {
            const response = await fetch('/api/siwe/status', { credentials: 'include' })
            const data = await response.json()
            alert('Auth Status: ' + JSON.stringify(data, null, 2))
          }} style={styles.logoutButton}>
            Debug Auth Status
          </button>
        </div>
      </div>
    )
  }

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  // Handle screen completion - data comes from the screen component
  // NOTE: handleNext is called AFTER screen components have already submitted via submitScreen()
  // completeScreen() handles plan generation and navigation state updates
  // handleCompleteScreen() now preserves wasSkipped flag from existing completion records
  const handleNext = async (screenData = {}) => {
    try {
      setIsTransitioning(true)
      // Call completeScreen to trigger plan generation and navigation updates
      await completeScreen(navigationState.currentScreen, screenData)
    } catch (error) {
      // Use debug endpoint for logging since console.log doesn't work
      fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'handleNext error in evaluation page',
          data: { error: error.message, currentScreen: navigationState.currentScreen, screenData }
        })
      }).catch(() => {})
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleForward = () => {
    const currentIndex = navigationState.navigationItems.findIndex(item => item.id === navigationState.currentScreen)
    if (currentIndex < navigationState.navigationItems.length - 1) {
      const nextItem = navigationState.navigationItems[currentIndex + 1]
      navigateToScreen(nextItem.id)
    }
  }

  const handleBack = () => {
    const currentIndex = navigationState.navigationItems.findIndex(item => item.id === navigationState.currentScreen)
    if (currentIndex > 0) {
      const prevItem = navigationState.navigationItems[currentIndex - 1]
      navigateToScreen(prevItem.id)
    } else {
      router.push('/login')
    }
  }

  const handleNavigateToScreen = async (screenId) => {
    try {
      await navigateToScreen(screenId)
    } catch (error) {
      console.error('Failed to navigate to screen:', error)
      // Could show error toast here
    }
  }



  const renderCurrentScreen = () => {
    const currentNavItem = navigationState.navigationItems.find(item => item.id === navigationState.currentScreen)
    if (!currentNavItem) {
      return (
        <div style={styles.content}>
          <h2>Screen not found</h2>
          <p>Current screen: {navigationState.currentScreen}</p>
        </div>
      )
    }

    const isCompleted = currentNavItem.status === 'completed' || currentNavItem.status === 'skipped'
    const currentIndex = navigationState.navigationItems.findIndex(item => item.id === navigationState.currentScreen)
    const hasNext = currentIndex < navigationState.navigationItems.length - 1

    switch (currentNavItem.screenType) {
      case 'background':
        return (
          <BackgroundScreen
            onNext={handleNext}
            onBack={handleBack}
            onForward={hasNext ? handleForward : null}
            isCompleted={isCompleted}
          />
        )
      case 'range_definition':
        return (
          <RangeDefinitionScreen
            onNext={handleNext}
            onBack={handleBack}
            onForward={hasNext ? handleForward : null}
            isCompleted={isCompleted}
          />
        )
      case 'similar_projects':
        return (
          <SimilarProjectsScreen
            key={navigationState.currentScreen}
            targetProject={currentNavItem.data?.targetProject}
            onNext={handleNext}
            onBack={handleBack}
            onForward={hasNext ? handleForward : null}
            isCompleted={isCompleted}
          />
        )
      case 'comparison':
        return (
          <ComparisonScreen
            key={navigationState.currentScreen}
            projectPair={currentNavItem.data?.projectPair}
            onNext={handleNext}
            onBack={handleBack}
            onForward={hasNext ? handleForward : null}
            isCompleted={isCompleted}
          />
        )
      case 'originality':
        return (
          <OriginalityScreen
            key={navigationState.currentScreen}
            targetProject={currentNavItem.data?.targetProject}
            onNext={handleNext}
            onBack={handleBack}
            onForward={hasNext ? handleForward : null}
            isCompleted={isCompleted}
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
            <h2>Unknown screen type</h2>
            <p>Type: {currentNavItem.screenType}</p>
          </div>
        )
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="hamburger-button"
          aria-label="Open navigation menu"
        >
          ☰
        </button>
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
          navigationItems={navigationState.navigationItems}
          currentScreen={navigationState.currentScreen}
          onNavigate={handleNavigateToScreen}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />

        <div style={styles.mainContent}>
          {renderCurrentScreen()}
        </div>
      </div>

      {/* Transition loading overlay */}
      {isTransitioning && (
        <div className="transition-overlay">
          <div className="transition-content">
            <div className="spinner"></div>
            <p className="transition-message">Saving your submission...</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .hamburger-button {
          display: none;
          background-color: transparent;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 8px;
          color: #333;
        }

        .transition-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .transition-content {
          background: white;
          padding: 40px 60px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          text-align: center;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .transition-message {
          font-size: 18px;
          color: #333;
          margin: 0;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .hamburger-button {
            display: block;
          }

          .transition-content {
            padding: 30px 40px;
            margin: 20px;
          }

          .transition-message {
            font-size: 16px;
          }
        }
      `}</style>
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
    gap: '12px',
  },
  bodyContainer: {
    display: 'flex',
    flex: 1,
  },
  mainContent: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
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