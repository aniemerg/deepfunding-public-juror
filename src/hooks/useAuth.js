import { useAccount, useSignMessage } from 'wagmi'
import { createSiweMessage } from 'viem/siwe'
import { useState, useEffect } from 'react'

export function useAuth() {
  const { address, chainId, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/siwe/status', { credentials: 'include' })
      const data = await response.json()
      setUser(data.authenticated ? data.user : null)
    } catch (error) {
      console.error('Error checking auth status:', error)
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
        throw new Error(data.error || 'Authentication failed')
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