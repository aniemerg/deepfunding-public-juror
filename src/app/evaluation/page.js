'use client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { BackgroundScreen } from '@/components/BackgroundScreen'

export default function EvaluationPage() {
  const { user, isLoggedIn, isLoading, logout } = useAuth()
  const router = useRouter()
  const [currentScreen, setCurrentScreen] = useState('background')

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login')
    }
  }, [isLoading, isLoggedIn, router])

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
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

  const handleNext = () => {
    // For now, just show a success message
    // Later this will navigate to the next screen
    alert('Background information submitted successfully! Next screen will be implemented soon.')
  }

  const handleBack = () => {
    router.push('/login')
  }

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'background':
        return (
          <BackgroundScreen 
            onNext={handleNext}
            onBack={handleBack}
          />
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

      {renderCurrentScreen()}
    </div>
  )
}

const styles = {
  container: {
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
}