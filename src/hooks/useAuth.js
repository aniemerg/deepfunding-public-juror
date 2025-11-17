import { useAccount, useSignMessage } from 'wagmi'
import { createSiweMessage } from 'viem/siwe'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function useAuth() {
  const { address, chainId, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status on mount and route changes
  useEffect(() => {
    checkAuthStatus()
  }, [pathname]) // Re-check when navigating between pages

  // Removed polling - too noisy

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/siwe/status', { credentials: 'include' })
      const data = await response.json()
      
      // Use debug endpoint to log to server console
      fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'useAuth checkAuthStatus result',
          data: { response: data, authenticated: data.authenticated, user: data.user }
        })
      }).catch(() => {})
      
      setUser(data.authenticated ? data.user : null)
    } catch (error) {
      fetch('/api/debug', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'useAuth checkAuthStatus ERROR',
          data: { error: error.message }
        })
      }).catch(() => {})
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (inviteCode) => {
    if (!isConnected || !address || !chainId) {
      throw new Error('Wallet not connected')
    }

    try {
      // Get nonce
      const nonce = await (await fetch('/api/siwe/nonce', { credentials: 'include' })).text()
      
      // Create SIWE message
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        uri: window.location.origin,
        version: '1',
        statement: 'Sign in to Deep Funding Public Juror',
        nonce,
      })

      // Sign message
      const signature = await signMessageAsync({ message })

      // Verify with backend
      const response = await fetch('/api/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, signature, inviteCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        // If we have a structured error response (e.g., ENS error with helpUrl), pass it through
        if (data.message || data.helpUrl) {
          const error = new Error(data.error || data.message || 'Authentication failed')
          error.response = data // Attach full response for structured error handling
          throw error
        }

        // Otherwise, construct error message from details
        let errorMessage = data.error || 'Authentication failed'
        if (data.details) {
          if (typeof data.details === 'string') {
            errorMessage += ': ' + data.details
          } else if (data.details.message) {
            errorMessage += ': ' + data.details.message
          } else {
            errorMessage += ': ' + JSON.stringify(data.details)
          }
        }
        throw new Error(errorMessage)
      }

      setUser(data.user)
      return data.user
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/siwe/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return {
    user,
    isLoggedIn: !!user,
    isLoading,
    login,
    logout,
    checkAuthStatus,
  }
}