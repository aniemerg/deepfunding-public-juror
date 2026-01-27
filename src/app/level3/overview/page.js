'use client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import OverviewScreenLevel3 from '@/components/OverviewScreenLevel3'

function OverviewPageContent() {
  const { user, isLoggedIn, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const repoUrl = searchParams.get('repo')

  // Redirect if not logged in
  if (!isLoading && !isLoggedIn) {
    router.push('/login')
    return null
  }

  // Redirect if no repo specified
  if (!isLoading && !repoUrl) {
    router.push('/level3')
    return null
  }

  if (isLoading) {
    return (
      <div style={styles.loading}>
        <div>Loading...</div>
      </div>
    )
  }

  if (!isLoggedIn || !repoUrl) {
    return null
  }

  return (
    <OverviewScreenLevel3
      repoUrl={repoUrl}
      userAddress={user?.address}
      ensName={user?.ensName}
      onBackToList={() => router.push('/level3')}
    />
  )
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div style={styles.loading}>Loading...</div>}>
      <OverviewPageContent />
    </Suspense>
  )
}

const styles = {
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  }
}
