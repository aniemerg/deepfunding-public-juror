'use client'
import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'

export default function LoginPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [isLogging, setIsLogging] = useState(false)
  const { login, isLoggedIn } = useAuth()
  const { isConnected } = useAccount()
  const router = useRouter()

  // Redirect if already logged in
  if (isLoggedIn) {
    router.push('/evaluation')
    return null
  }

  const handleLogin = async () => {
    setIsLogging(true)
    setError('')
    try {
      await login(inviteCode || undefined)
      router.push('/evaluation')
    } catch (err) {
      setError(err.message)
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
          <ConnectButton />
        </div>

        {isConnected && (
          <div style={styles.section}>
            {requiresInviteCode && (
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

            <button
              onClick={handleLogin}
              disabled={isLogging || (requiresInviteCode && !inviteCode.trim())}
              style={{
                ...styles.button,
                ...(isLogging || (requiresInviteCode && !inviteCode.trim()) ? styles.buttonDisabled : {})
              }}
            >
              {isLogging ? 'Signing In...' : 'Sign In with Ethereum'}
            </button>

            {error && (
              <div style={styles.error}>
                {error}
              </div>
            )}
          </div>
        )}

        <div style={styles.info}>
          <h3 style={styles.infoTitle}>How it works:</h3>
          <ol style={styles.infoList}>
            <li>Connect your Ethereum wallet (MetaMask, WalletConnect, etc.)</li>
            <li>Sign a message to prove wallet ownership</li>
            <li>No gas fees or blockchain transactions required</li>
            <li>Your wallet address serves as your secure identifier</li>
          </ol>
        </div>
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
  info: {
    marginTop: '32px',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  infoTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#333',
  },
  infoList: {
    fontSize: '14px',
    color: '#666',
    paddingLeft: '16px',
    margin: 0,
  },
}