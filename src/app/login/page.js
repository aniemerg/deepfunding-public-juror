'use client'
import { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'

export default function LoginPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [isLogging, setIsLogging] = useState(false)
  const [ensName, setEnsName] = useState('')
  const [checkingEns, setCheckingEns] = useState(false)
  const { login, isLoggedIn } = useAuth()
  const { address, isConnected } = useAccount()
  const router = useRouter()

  // Check ENS when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      checkENSName(address)
    } else {
      setEnsName('')
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
    console.log('Checking ENS for address:', walletAddress)

    try {
      // Use our server-side proxy to resolve ENS
      // This bypasses CORS and mobile browser restrictions
      console.log('Fetching from server proxy:', `/api/resolve-ens?address=${walletAddress}`)
      const response = await fetch(`/api/resolve-ens?address=${walletAddress}`);
      console.log('Server response status:', response.status, response.ok)

      const data = await response.json();
      console.log('Server response:', data)

      if (data.success && data.name && data.name.endsWith('.eth')) {
        console.log('Found ENS via server:', data.name)
        setEnsName(data.name);
        return;
      }

      // No ENS found
      console.log('No ENS found for address:', walletAddress)
      setEnsName('');
      setError({
        title: 'Primary ENS Name Required',
        message: 'To participate, you must own an ENS name ending in .eth and set it as your Primary ENS Name for this wallet address.',
        helpUrl: 'https://support.ens.domains/en/articles/8684192-how-to-set-as-primary-name'
      });

    } catch (err) {
      console.error('ENS check failed:', err);
      setError('Failed to check ENS name. Please try again.');
    } finally {
      setCheckingEns(false);
    }
  }

  const handleLogin = async () => {
    setIsLogging(true)
    setError('')
    try {
      await login(inviteCode || undefined)
      router.push('/evaluation')
    } catch (err) {
      // Handle structured error responses
      if (err.response) {
        setError(err.response)
      } else if (err.message) {
        setError(err.message)
      } else {
        setError('Authentication failed. Please try again.')
      }
    } finally {
      setIsLogging(false)
    }
  }

  const requiresInviteCode = process.env.NEXT_PUBLIC_ENABLE_INVITE_CODES === 'true'

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Deep Funding Public Juror</h1>
        <p style={styles.subtitle}>
          Web3-enabled evaluation system for Ethereum ecosystem projects
        </p>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Connect Your Wallet</h2>
          <ConnectButton showBalance={false} chainStatus="none" />
        </div>

        {isConnected && (
          <div style={styles.section}>
            {checkingEns ? (
              <div style={styles.checking}>
                <p>🔍 Checking ENS name...</p>
              </div>
            ) : ensName ? (
              <div style={styles.ensSuccess}>
                <p>✅ ENS Name: <strong>{ensName}</strong></p>
              </div>
            ) : (
              <div style={styles.ensRequired}>
                <p>⚠️ ENS name required</p>
                <p style={{ fontSize: '14px', margin: '8px 0' }}>
                  This address must have an ENS name ending in .eth to participate.
                </p>
              </div>
            )}

            {requiresInviteCode && ensName && (
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

            {ensName && (
              <button
                onClick={handleLogin}
                disabled={isLogging || (requiresInviteCode && !inviteCode.trim())}
                style={{
                  ...styles.button,
                  ...(isLogging || (requiresInviteCode && !inviteCode.trim()) ? styles.buttonDisabled : {})
                }}
              >
                {isLogging ? 'Signing In...' : `Sign In as ${ensName}`}
              </button>
            )}

            {error && (
              <div style={styles.error}>
                {typeof error === 'string' ? (
                  error
                ) : (
                  <>
                    {error.title && <div style={styles.errorTitle}>{error.title}</div>}
                    {error.message && <div style={styles.errorMessage}>{error.message}</div>}
                    {error.error && !error.message && <div style={styles.errorMessage}>{error.error}</div>}
                    {error.helpUrl && (
                      <a
                        href={error.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.helpLink}
                      >
                        📖 Learn how to set your Primary ENS Name →
                      </a>
                    )}
                  </>
                )}
              </div>
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
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '8px',
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '32px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#333',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  error: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '4px',
    color: '#c33',
    fontSize: '14px',
  },
  errorTitle: {
    fontWeight: 'bold',
    marginBottom: '8px',
    fontSize: '15px',
  },
  errorMessage: {
    marginBottom: '8px',
    lineHeight: '1.5',
  },
  helpLink: {
    display: 'inline-block',
    marginTop: '8px',
    color: '#0070f3',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '14px',
    transition: 'color 0.2s',
  },
  checking: {
    padding: '12px',
    backgroundColor: '#f0f8ff',
    border: '1px solid #ddeeff',
    borderRadius: '4px',
    color: '#0070f3',
    fontSize: '14px',
    marginBottom: '16px',
  },
  ensSuccess: {
    padding: '12px',
    backgroundColor: '#f0fff4',
    border: '1px solid #a7f3d0',
    borderRadius: '4px',
    color: '#059669',
    fontSize: '14px',
    marginBottom: '16px',
  },
  ensRequired: {
    padding: '12px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fed7aa',
    borderRadius: '4px',
    color: '#d97706',
    fontSize: '14px',
    marginBottom: '16px',
  },
}