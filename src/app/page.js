'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function Home() {
  const router = useRouter()
  const { isLoggedIn, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (isLoggedIn) {
        router.push('/evaluation')
      } else {
        router.push('/login')
      }
    }
  }, [isLoading, isLoggedIn, router])

  return (
    <div style={styles.container}>
      <div style={styles.loading}>Loading...</div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  loading: {
    fontSize: '18px',
    color: '#666',
  },
}
