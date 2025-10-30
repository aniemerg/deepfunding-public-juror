import { useEffect, useRef } from "react";

export function useAutosave(value, { user, dataType, id }) {
  const timer = useRef();
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await fetch("/api/save-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user, dataType, id, payload: value }),
        credentials: "include"
      });
    }, 1000);
    return () => window.clearTimeout(timer.current);
  }, [value, user, dataType, id]);
}

// Hook for manual saving/submitting data
export function useDataSubmission() {
  const submitScreen = async (userAddress, screenType, screenId, data) => {
    try {
      const response = await fetch('/api/submit-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userAddress,
          dataType: screenType,
          id: screenId,
          payload: data
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      return result;
    } catch (error) {
      console.error('Submission error:', error);
      throw error;
    }
  };

  const getSubmissionStatus = async (userAddress, screenType, screenId) => {
    try {
      const params = new URLSearchParams({
        userAddress,
        screenType,
        screenId
      });

      const response = await fetch(`/api/submit-screen?${params}`);
      
      if (response.ok) {
        return await response.json();
      }
      
      return { exists: false, status: 'not_found' };
    } catch (error) {
      console.error('Get submission status error:', error);
      return { exists: false, status: 'error' };
    }
  };

  return {
    submitScreen,
    getSubmissionStatus
  };
}

// Hook for loading user data
export function useUserData(userAddress) {
  const loadUserData = async () => {
    if (!userAddress) return null;

    try {
      const params = new URLSearchParams({ userAddress });
      const response = await fetch(`/api/save-progress?${params}`);
      
      if (response.ok) {
        return await response.json();
      }
      
      console.error('Failed to load user data');
      return null;
    } catch (error) {
      console.error('Load user data error:', error);
      return null;
    }
  };

  const loadProgress = async () => {
    if (!userAddress) return null;

    try {
      const params = new URLSearchParams({ userAddress });
      const response = await fetch(`/api/user-progress?${params}`);
      
      if (response.ok) {
        return await response.json();
      }
      
      console.error('Failed to load user progress');
      return null;
    } catch (error) {
      console.error('Load progress error:', error);
      return null;
    }
  };

  return {
    loadUserData,
    loadProgress
  };
}