import { useEffect, useCallback, useRef } from 'react'

// Debounce utility function
function debounce(func, delay) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

export function useAutoSave(userAddress, dataType, data, id = null) {
  const saveInProgress = useRef(false)
  const lastSavedData = useRef(null)

  const save = useCallback(
    debounce(async (currentData) => {
      // Skip if save is already in progress
      if (saveInProgress.current) return

      // Skip if data hasn't changed
      if (JSON.stringify(currentData) === JSON.stringify(lastSavedData.current)) {
        return
      }

      saveInProgress.current = true
      try {
        const response = await fetch('/api/save-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress,
            dataType,
            id: id || crypto.randomUUID(),
            data: currentData
          })
        })

        if (response.ok) {
          lastSavedData.current = currentData
          console.log(`Auto-saved ${dataType} data`)
        } else {
          const error = await response.json()
          console.error('Auto-save failed:', error)
        }
      } catch (error) {
        console.error('Auto-save error:', error)
      } finally {
        saveInProgress.current = false
      }
    }, 1000), // Debounce for 1 second
    [userAddress, dataType, id]
  )

  useEffect(() => {
    if (data && userAddress && Object.keys(data).length > 0) {
      save(data)
    }
  }, [data, userAddress, save])

  return { 
    save: (manualData) => save(manualData || data),
    isSaving: saveInProgress.current
  }
}

// Hook for manual saving/submitting data
export function useDataSubmission() {
  const submitScreen = useCallback(async (userAddress, screenType, screenId, data) => {
    try {
      const response = await fetch('/api/submit-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          screenType,
          screenId,
          data
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed')
      }

      return result
    } catch (error) {
      console.error('Submission error:', error)
      throw error
    }
  }, [])

  const getSubmissionStatus = useCallback(async (userAddress, screenType, screenId) => {
    try {
      const params = new URLSearchParams({
        userAddress,
        screenType,
        screenId
      })

      const response = await fetch(`/api/submit-screen?${params}`)
      
      if (response.ok) {
        return await response.json()
      }
      
      return { exists: false, status: 'not_found' }
    } catch (error) {
      console.error('Get submission status error:', error)
      return { exists: false, status: 'error' }
    }
  }, [])

  return {
    submitScreen,
    getSubmissionStatus
  }
}

// Hook for loading user data
export function useUserData(userAddress) {
  const loadUserData = useCallback(async () => {
    if (!userAddress) return null

    try {
      const params = new URLSearchParams({ userAddress })
      const response = await fetch(`/api/save-progress?${params}`)
      
      if (response.ok) {
        return await response.json()
      }
      
      console.error('Failed to load user data')
      return null
    } catch (error) {
      console.error('Load user data error:', error)
      return null
    }
  }, [userAddress])

  const loadProgress = useCallback(async () => {
    if (!userAddress) return null

    try {
      const params = new URLSearchParams({ userAddress })
      const response = await fetch(`/api/user-progress?${params}`)
      
      if (response.ok) {
        return await response.json()
      }
      
      console.error('Failed to load user progress')
      return null
    } catch (error) {
      console.error('Load progress error:', error)
      return null
    }
  }, [userAddress])

  return {
    loadUserData,
    loadProgress
  }
}