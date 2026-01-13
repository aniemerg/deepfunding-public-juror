'use client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense } from 'react'
import ComparisonScreenLevel3 from '@/components/ComparisonScreenLevel3'
import { NavigationSidebar } from '@/components/NavigationSidebar'

function EvaluatePageContent() {
  const { user, isLoggedIn, isLoading, logout } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const repoUrl = searchParams.get('repo')

  const [evaluationState, setEvaluationState] = useState(null)
  const [navigationState, setNavigationState] = useState(null)
  const [currentComparisonIndex, setCurrentComparisonIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login')
    }
  }, [isLoading, isLoggedIn, router])

  // Reset state when repo changes
  useEffect(() => {
    if (repoUrl) {
      setLoading(true)
      setError(null)
      setEvaluationState(null)
      setNavigationState(null)
      setCurrentComparisonIndex(0)
      setIsSubmitting(false)
    }
  }, [repoUrl])

  // Generate plan function
  const generatePlan = useCallback(async () => {
    try {
      const response = await fetch('/api/level3/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate plan')
      }

      setEvaluationState({ plan: data.plan, comparisons: [] })

      // Also load navigation state for the new plan
      if (user?.address) {
        const navResponse = await fetch(`/api/level3/navigation-state?repoUrl=${encodeURIComponent(repoUrl)}&userAddress=${user.address}`)
        const navData = await navResponse.json()

        if (navResponse.ok) {
          setNavigationState(navData)
          setCurrentComparisonIndex(0)
        }
      }

      setLoading(false)
    } catch (err) {
      console.error('Error generating plan:', err)
      setError(err.message)
      setLoading(false)
    }
  }, [repoUrl, user?.address])

  // Load evaluation and navigation state
  useEffect(() => {
    if (!repoUrl || !isLoggedIn || !user?.address) return

    async function loadState() {
      try {
        // Load evaluation state (plan and comparisons)
        const evalResponse = await fetch(`/api/level3/evaluation-state?repoUrl=${encodeURIComponent(repoUrl)}`)
        const evalData = await evalResponse.json()

        if (!evalResponse.ok) {
          throw new Error(evalData.error || 'Failed to load evaluation state')
        }

        // If no plan exists, generate one
        if (!evalData.plan) {
          await generatePlan()
          return
        }

        setEvaluationState(evalData)

        // Load navigation state
        const navResponse = await fetch(`/api/level3/navigation-state?repoUrl=${encodeURIComponent(repoUrl)}&userAddress=${user.address}`)
        const navData = await navResponse.json()

        if (!navResponse.ok) {
          throw new Error(navData.error || 'Failed to load navigation state')
        }

        setNavigationState(navData)

        // Set current comparison index from navigation state
        if (navData.currentScreen && navData.currentScreen !== 'completion') {
          const match = navData.currentScreen.match(/comparison_(\d+)/)
          if (match) {
            setCurrentComparisonIndex(parseInt(match[1]))
          }
        } else if (navData.currentScreen === 'completion') {
          setCurrentComparisonIndex(evalData.plan.comparisons.length)
        }

        setLoading(false)
      } catch (err) {
        console.error('Error loading state:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    loadState()
  }, [repoUrl, isLoggedIn, user?.address, generatePlan])

  async function handleSubmitComparison(comparisonData) {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/level3/submit-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          ...comparisonData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit comparison')
      }

      // Reload navigation state
      const navResponse = await fetch(`/api/level3/navigation-state?repoUrl=${encodeURIComponent(repoUrl)}&userAddress=${user.address}`)
      const navData = await navResponse.json()

      if (navResponse.ok) {
        setNavigationState(navData)

        // Update current comparison index from navigation
        if (navData.currentScreen && navData.currentScreen !== 'completion') {
          const match = navData.currentScreen.match(/comparison_(\d+)/)
          if (match) {
            setCurrentComparisonIndex(parseInt(match[1]))
          }
        } else if (navData.currentScreen === 'completion') {
          setCurrentComparisonIndex(evaluationState.plan.comparisons.length)
        }
      }

      // Update local evaluation state
      setEvaluationState(prev => ({
        ...prev,
        comparisons: [...prev.comparisons.filter(c => c.comparisonIndex !== comparisonData.comparisonIndex), comparisonData]
      }))
    } catch (err) {
      console.error('Error submitting comparison:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleNavigateToComparison(screenId) {
    try {
      // Navigate via API
      const response = await fetch('/api/level3/navigation-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: user.address,
          repoUrl,
          action: 'navigate-to',
          screenId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to navigate')
      }

      setNavigationState(data)

      // Update current comparison index
      if (screenId !== 'completion') {
        const match = screenId.match(/comparison_(\d+)/)
        if (match) {
          setCurrentComparisonIndex(parseInt(match[1]))
        }
      } else {
        setCurrentComparisonIndex(evaluationState.plan.comparisons.length)
      }

      setIsMobileMenuOpen(false)
    } catch (err) {
      console.error('Error navigating:', err)
      alert(`Error: ${err.message}`)
    }
  }

  async function handleGenerateMore() {
    setLoading(true)
    try {
      const currentPlanNumber = evaluationState.plan.planNumber || 0
      const response = await fetch('/api/level3/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          planNumber: currentPlanNumber + 1
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate more comparisons')
      }

      // Reload state
      window.location.reload()
    } catch (err) {
      console.error('Error generating more comparisons:', err)
      alert(`Error: ${err.message}`)
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  if (isLoading || loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return null
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Verdict</h1>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </div>
        <div style={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/level3')} style={styles.backButton}>
            ← Back to Repository Selection
          </button>
        </div>
      </div>
    )
  }

  if (!evaluationState || !evaluationState.plan || !navigationState) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Preparing evaluation...</div>
      </div>
    )
  }

  const { plan, comparisons } = evaluationState
  const isComplete = currentComparisonIndex >= plan.comparisons.length
  const currentComparison = plan.comparisons[currentComparisonIndex]

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="hamburger-button"
          aria-label="Open navigation menu"
        >
          ☰
        </button>
        <h1 style={styles.title}>Verdict - Level 3</h1>
        <div style={styles.userInfo}>
          <span style={styles.address}>{user?.ensName}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      {/* Body with Sidebar */}
      <div style={styles.bodyContainer}>
        <NavigationSidebar
          navigationItems={navigationState.navigationItems}
          currentScreen={navigationState.currentScreen}
          onNavigate={handleNavigateToComparison}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />

        <div style={styles.mainContent}>
        {isComplete ? (
          <div style={styles.completionSection}>
            <h2 style={styles.completionTitle}>✓ Evaluation Complete</h2>
            <p style={styles.completionText}>
              You have completed all {plan.comparisons.length} comparisons for this repository.
            </p>
            <div style={styles.completionButtons}>
              <button onClick={handleGenerateMore} style={styles.generateMoreButton}>
                Generate 10 More Comparisons
              </button>
              <button onClick={() => router.push('/level3')} style={styles.backToListButton}>
                ← Back to Repository List
              </button>
              <button onClick={() => router.push('/evaluation')} style={styles.level2Button}>
                Go to Level 2 Evaluation
              </button>
            </div>
          </div>
        ) : (
          <ComparisonScreenLevel3
            repoUrl={repoUrl}
            comparison={currentComparison}
            comparisonIndex={currentComparisonIndex}
            totalComparisons={plan.comparisons.length}
            onSubmit={handleSubmitComparison}
            isSubmitting={isSubmitting}
            isCompleted={navigationState.navigationItems.find(i => i.id === `comparison_${currentComparisonIndex}`)?.status === 'completed'}
          />
        )}
        </div>
      </div>

      {/* Version */}
      <div style={styles.versionInfo}>
        v{process.env.NEXT_PUBLIC_GIT_COMMIT?.slice(0, 7) || 'dev'}
      </div>

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

        @media (max-width: 768px) {
          .hamburger-button {
            display: block;
          }
        }
      `}</style>
    </div>
  )
}

export default function EvaluatePage() {
  return (
    <Suspense fallback={
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    }>
      <EvaluatePageContent />
    </Suspense>
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
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  },
  error: {
    maxWidth: '600px',
    margin: '40px auto',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    textAlign: 'center',
  },
  backButton: {
    marginTop: '20px',
    padding: '12px 24px',
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  completionSection: {
    maxWidth: '600px',
    margin: '40px auto',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '12px',
    textAlign: 'center',
  },
  completionTitle: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#48bb78',
    marginBottom: '16px',
  },
  completionText: {
    fontSize: '16px',
    color: '#4a5568',
    marginBottom: '32px',
  },
  completionButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  generateMoreButton: {
    padding: '12px 24px',
    backgroundColor: '#48bb78',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
  },
  backToListButton: {
    padding: '12px 24px',
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  level2Button: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: '#3182ce',
    border: '1px solid #3182ce',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  versionInfo: {
    position: 'fixed',
    bottom: '8px',
    right: '8px',
    fontSize: '11px',
    color: '#999',
    fontFamily: 'monospace',
    zIndex: 100,
    userSelect: 'none',
  },
}
