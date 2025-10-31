import { useState, useEffect, useCallback } from 'react'

export function useServerNavigationState(userAddress) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const loadState = useCallback(async () => {
    console.log('useServerNavigationState: loadState called with userAddress:', userAddress)
    
    if (!userAddress) {
      console.log('useServerNavigationState: No userAddress, setting state to null')
      setState(null)
      setLoading(false)
      return
    }
    
    try {
      setError(null)
      setLoading(true)
      const url = `/api/navigation-state?userAddress=${encodeURIComponent(userAddress)}`
      console.log('useServerNavigationState: Fetching navigation state from:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('useServerNavigationState: API error:', response.status, errorText)
        throw new Error(`Failed to load navigation state: ${response.status} - ${errorText}`)
      }
      
      const navigationState = await response.json()
      console.log('useServerNavigationState: Successfully loaded state:', navigationState)
      setState(navigationState)
    } catch (err) {
      console.error('useServerNavigationState: Error loading navigation state:', err)
      setError(err.message)
      // Set a default state so the app doesn't break
      setState({
        navigationItems: [
          {
            id: 'background',
            screenType: 'background',
            text: 'Background',
            status: 'current'
          }
        ],
        currentScreen: 'background',
        plan: null
      })
    } finally {
      setLoading(false)
    }
  }, [userAddress])
  
  const completeScreen = useCallback(async (screenId, data) => {
    if (!userAddress || !screenId) return
    
    try {
      setError(null)
      const response = await fetch('/api/navigation-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          action: 'complete-screen', 
          screenId,
          data
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to complete screen: ${response.status}`)
      }
      
      const newState = await response.json()
      setState(newState)
      return newState
    } catch (err) {
      console.error('Error completing screen:', err)
      setError(err.message)
      throw err
    }
  }, [userAddress])
  
  const navigateToScreen = useCallback(async (screenId) => {
    if (!userAddress || !screenId) return
    
    try {
      setError(null)
      const response = await fetch('/api/navigation-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          action: 'navigate-to',
          screenId
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to navigate to screen: ${response.status}`)
      }
      
      const newState = await response.json()
      setState(newState)
      return newState
    } catch (err) {
      console.error('Error navigating to screen:', err)
      setError(err.message)
      throw err
    }
  }, [userAddress])
  
  // Load state when userAddress changes
  useEffect(() => {
    loadState()
  }, [loadState])
  
  return { 
    state, 
    loading, 
    error,
    completeScreen, 
    navigateToScreen, 
    refreshState: loadState 
  }
}