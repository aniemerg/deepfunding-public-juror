'use client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { getSeedRepos, searchSeedRepos } from '@/lib/seedReposDataset'

export default function Level3Page() {
  const { user, isLoggedIn, isLoading, logout } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [featureEnabled, setFeatureEnabled] = useState(null)
  const [checkingFeature, setCheckingFeature] = useState(true)

  // Check feature flag on mount
  useEffect(() => {
    async function checkFeatureFlag() {
      try {
        const response = await fetch('/api/level3/feature-check')
        const data = await response.json()
        setFeatureEnabled(data.enabled)
      } catch (error) {
        console.error('Failed to check feature flag:', error)
        setFeatureEnabled(false)
      } finally {
        setCheckingFeature(false)
      }
    }
    checkFeatureFlag()
  }, [])

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login')
    }
  }, [isLoading, isLoggedIn, router])

  // Filter repos based on search
  const filteredRepos = useMemo(() => {
    return searchSeedRepos(searchQuery)
  }, [searchQuery])

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  const handleSelectRepo = (repo) => {
    // Navigate to evaluation page with repo URL as query param
    router.push(`/level3/evaluate?repo=${encodeURIComponent(repo.url)}`)
  }

  // Loading states
  if (isLoading || checkingFeature) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  // Feature flag check
  if (!featureEnabled) {
    return (
      <div style={styles.container}>
        <div style={styles.disabledMessage}>
          <h2>Level 3 Not Available</h2>
          <p>The Level 3 dependency evaluation interface is not yet available.</p>
          <button onClick={() => router.push('/evaluation')} style={styles.backButton}>
            ← Back to Level 2
          </button>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return null // Will redirect in useEffect
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Verdict</h1>
        <div style={styles.userInfo}>
          <span style={styles.address}>{user?.ensName}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.intro}>
          <h2 style={styles.pageTitle}>Level 3: Dependency Evaluation</h2>
          <p style={styles.description}>
            Select a repository to evaluate its dependencies. You will compare the relative
            value that each dependency provides to the parent project.
          </p>
          <button onClick={() => router.push('/evaluation')} style={styles.level2Link}>
            ← Back to Level 2
          </button>
        </div>

        <div style={styles.searchSection}>
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          <div style={styles.resultCount}>
            {filteredRepos.length} of {getSeedRepos().length} repositories
          </div>
        </div>

        <div style={styles.repoList}>
          {filteredRepos.map((repo) => (
            <button
              key={repo.url}
              onClick={() => handleSelectRepo(repo)}
              style={styles.repoCard}
            >
              <div style={styles.repoName}>{repo.fullName}</div>
              <div style={styles.repoMeta}>
                {repo.dependencyCount} dependencies
              </div>
            </button>
          ))}
        </div>

        {filteredRepos.length === 0 && (
          <div style={styles.noResults}>
            No repositories match &quot;{searchQuery}&quot;
          </div>
        )}
      </div>

      {/* Version number display */}
      <div style={styles.versionInfo}>
        v{process.env.NEXT_PUBLIC_GIT_COMMIT?.slice(0, 7) || 'dev'}
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
    flex: 1,
    padding: '24px',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
  },
  intro: {
    marginBottom: '24px',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '8px',
  },
  description: {
    fontSize: '16px',
    color: '#666',
    lineHeight: '1.5',
    marginBottom: '16px',
  },
  level2Link: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#3182ce',
    border: '1px solid #3182ce',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  searchSection: {
    marginBottom: '20px',
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  resultCount: {
    marginTop: '8px',
    fontSize: '14px',
    color: '#666',
  },
  repoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  repoCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.15s ease',
  },
  repoName: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#2d3748',
    fontFamily: 'monospace',
  },
  repoMeta: {
    fontSize: '14px',
    color: '#718096',
  },
  noResults: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '16px',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  },
  disabledMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    textAlign: 'center',
    padding: '20px',
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
