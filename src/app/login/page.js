'use client'
import { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import WalletCard from '@/components/WalletCard'

export default function LoginPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [isLogging, setIsLogging] = useState(false)
  const [ensData, setEnsData] = useState(null)
  const [checkingEns, setCheckingEns] = useState(false)
  const [ownedEnsNames, setOwnedEnsNames] = useState([])
  const [selectedEns, setSelectedEns] = useState(null)
  const [needsSelection, setNeedsSelection] = useState(false)
  const { login, isLoggedIn } = useAuth()
  const { address, isConnected } = useAccount()
  const router = useRouter()

  // Check ENS when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      checkENSName(address)
    } else {
      setEnsData(null)
      setError('')
    }
  }, [isConnected, address])

  // Redirect if already logged in
  if (isLoggedIn) {
    router.push('/evaluation')
    return null
  }

  const checkENSName = async (walletAddress) => {
    setCheckingEns(true)
    setError('')
    setNeedsSelection(false)

    try {
      // STEP 1: Try reverse lookup first (fast path)
      const reverseResponse = await fetch(`/api/resolve-ens?address=${walletAddress}`)
      const reverseData = await reverseResponse.json()

      if (reverseData.success && reverseData.name && reverseData.name.endsWith('.eth')) {
        setEnsData({
          name: reverseData.name,
          avatar: reverseData.avatar
        })
        setSelectedEns(reverseData.name)
        return
      }

      // STEP 2: Reverse lookup failed, check owned ENS NFTs
      console.log('Reverse lookup failed, checking owned ENS names...')
      const ownedResponse = await fetch(`/api/get-owned-ens?address=${walletAddress}`)
      const ownedData = await ownedResponse.json()

      if (!ownedData.success || ownedData.ownedNames.length === 0) {
        setEnsData(null)
        setError({
          type: 'ens_required',
          title: 'ENS Name Required',
          message: 'You must own an ENS name ending in .eth to participate.',
          helpUrl: 'https://ens.domains'
        })
        return
      }

      // User owns ENS name(s)
      if (ownedData.ownedNames.length === 1) {
        // Auto-select single ENS
        const singleEns = ownedData.ownedNames[0]
        setEnsData({ name: singleEns })
        setSelectedEns(singleEns)
        console.log('Auto-selected single ENS:', singleEns)
        return
      }

      // Multiple ENS - show selection UI
      setOwnedEnsNames(ownedData.ownedNames)
      setNeedsSelection(true)
      console.log('Multiple ENS found, needs selection:', ownedData.ownedNames)

    } catch (err) {
      console.error('ENS check failed:', err)
      setError({
        type: 'network',
        message: 'Unable to verify ENS name. Please try again.'
      })
    } finally {
      setCheckingEns(false)
    }
  }

  const handleEnsSelection = (ensName) => {
    setSelectedEns(ensName)
    setEnsData({ name: ensName })
    setNeedsSelection(false)
    console.log('User selected ENS:', ensName)
  }

  const handleLogin = async () => {
    setIsLogging(true)
    setError('')
    try {
      await login(inviteCode || undefined, selectedEns || undefined)
      router.push('/evaluation')
    } catch (err) {
      if (err.response) {
        setError({ type: 'auth', ...err.response })
        // If server says we need to select an ENS, show the selection UI
        if (err.response.requiresSelection && err.response.ownedNames) {
          setOwnedEnsNames(err.response.ownedNames)
          setNeedsSelection(true)
        }
      } else if (err.message) {
        setError({ type: 'auth', message: err.message })
      } else {
        setError({ type: 'auth', message: 'Authentication failed. Please try again.' })
      }
    } finally {
      setIsLogging(false)
    }
  }

  const requiresInviteCode = process.env.NEXT_PUBLIC_ENABLE_INVITE_CODES === 'true'

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Verdict</h1>
          <p style={styles.subtitle}>
            Human judgment for open source funding
          </p>
        </div>

        {!isConnected ? (
          <div style={styles.connectSection}>
            <p style={styles.connectPrompt}>Connect your wallet to get started</p>
            <ConnectButton showBalance={false} chainStatus="none" />
          </div>
        ) : (
          <div style={styles.walletSection}>
            {checkingEns ? (
              <div style={styles.checking}>
                <div style={styles.spinner} />
                <span>Verifying ENS name...</span>
              </div>
            ) : (
              <>
                <WalletCard
                  ensName={ensData?.name}
                  avatar={ensData?.avatar}
                  isValid={!!ensData?.name}
                />

                {needsSelection && ownedEnsNames.length > 0 && (
                  <div style={styles.ensSelectionContainer}>
                    <div style={styles.selectionHeader}>
                      <span style={styles.selectionIcon}>🔐</span>
                      <div>
                        <div style={styles.selectionTitle}>Select Your ENS Name</div>
                        <div style={styles.selectionMessage}>
                          You own multiple ENS names. Choose which one to use:
                        </div>
                      </div>
                    </div>
                    <div style={styles.ensNameList}>
                      {ownedEnsNames.map(name => (
                        <button
                          key={name}
                          onClick={() => handleEnsSelection(name)}
                          style={{
                            ...styles.ensNameButton,
                            ...(selectedEns === name ? styles.ensNameButtonSelected : {})
                          }}
                        >
                          {name}
                          {selectedEns === name && <span style={styles.checkmark}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && error.type === 'ens_required' && (
                  <div style={styles.ensError}>
                    <div style={styles.ensErrorContent}>
                      <span style={styles.ensErrorIcon}>!</span>
                      <div>
                        <div style={styles.ensErrorTitle}>{error.title}</div>
                        <div style={styles.ensErrorMessage}>{error.message}</div>
                      </div>
                    </div>
                    {error.helpUrl && (
                      <a
                        href={error.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.helpLink}
                      >
                        Learn how to set up your ENS name
                      </a>
                    )}
                  </div>
                )}

                {error && error.type !== 'ens_required' && (
                  <div style={styles.errorBanner}>
                    {error.title && <strong>{error.title}: </strong>}
                    {error.message || error.error}
                  </div>
                )}

                {requiresInviteCode && ensData?.name && (
                  <div style={styles.inputGroup}>
                    <label htmlFor="inviteCode" style={styles.label}>
                      Invite Code
                    </label>
                    <input
                      id="inviteCode"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Enter your invite code"
                      style={styles.input}
                    />
                  </div>
                )}

                {ensData?.name && (
                  <button
                    onClick={handleLogin}
                    disabled={isLogging || (requiresInviteCode && !inviteCode.trim())}
                    style={{
                      ...styles.signInButton,
                      ...(isLogging || (requiresInviteCode && !inviteCode.trim())
                        ? styles.signInButtonDisabled
                        : {})
                    }}
                  >
                    {isLogging ? 'Signing in...' : 'Continue to Evaluation'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: '#f8fafc',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#111827',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
    lineHeight: '1.5',
  },
  connectSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  connectPrompt: {
    fontSize: '14px',
    color: '#6b7280',
  },
  walletSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  checking: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '24px',
    color: '#6b7280',
    fontSize: '14px',
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  ensError: {
    padding: '14px',
    backgroundColor: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '10px',
  },
  ensErrorContent: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  ensErrorIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    backgroundColor: '#f59e0b',
    color: '#fff',
    borderRadius: '50%',
    fontSize: '12px',
    fontWeight: '700',
    flexShrink: 0,
    marginTop: '1px',
  },
  ensErrorTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#92400e',
    marginBottom: '2px',
  },
  ensErrorMessage: {
    fontSize: '13px',
    color: '#a16207',
    lineHeight: '1.4',
  },
  helpLink: {
    display: 'block',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #fcd34d',
    fontSize: '13px',
    fontWeight: '500',
    color: '#92400e',
    textDecoration: 'none',
  },
  errorBanner: {
    padding: '12px 14px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    color: '#b91c1c',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '15px',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    outline: 'none',
  },
  signInButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  signInButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  ensSelectionContainer: {
    padding: '16px',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
  },
  selectionHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    marginBottom: '14px',
  },
  selectionIcon: {
    fontSize: '20px',
    flexShrink: 0,
    marginTop: '1px',
  },
  selectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: '2px',
  },
  selectionMessage: {
    fontSize: '13px',
    color: '#3b82f6',
    lineHeight: '1.4',
  },
  ensNameList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  ensNameButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    backgroundColor: '#fff',
    border: '2px solid #dbeafe',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1e40af',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  },
  ensNameButtonSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  checkmark: {
    color: '#3b82f6',
    fontSize: '16px',
    fontWeight: '700',
  },
}
