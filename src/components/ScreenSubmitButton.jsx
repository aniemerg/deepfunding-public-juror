import { useState, useEffect } from 'react'
import { useDataSubmission } from '@/hooks/useAutoSave'

export function ScreenSubmitButton({
  userAddress,
  screenType,
  screenId,
  data,
  onSubmitSuccess,
  disabled = false,
  children
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [submissionStatus, setSubmissionStatus] = useState(null)
  
  const { submitScreen, getSubmissionStatus } = useDataSubmission()

  // Load submission status on mount
  useEffect(() => {
    if (userAddress && screenType && screenId) {
      getSubmissionStatus(userAddress, screenType, screenId)
        .then(status => {
          setSubmissionStatus(status)
          if (status.lastSubmittedAt) {
            setLastSubmittedAt(status.lastSubmittedAt)
          }
        })
        .catch(console.error)
    }
  }, [userAddress, screenType, screenId, getSubmissionStatus])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await submitScreen(userAddress, screenType, screenId, data)
      
      // Success
      setLastSubmittedAt(result.submissionTimestamp)
      setSubmissionStatus({
        exists: true,
        status: 'submitted',
        lastSubmittedAt: result.submissionTimestamp,
        submissionCount: (submissionStatus?.submissionCount || 0) + 1
      })
      
      if (onSubmitSuccess) {
        onSubmitSuccess(result)
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValidForSubmission = !disabled && data && Object.keys(data).length > 0
  const hasBeenSubmitted = submissionStatus?.status === 'submitted'
  
  return (
    <div style={styles.container}>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !isValidForSubmission}
        style={{
          ...styles.button,
          ...(isSubmitting || !isValidForSubmission ? styles.buttonDisabled : {}),
          ...(hasBeenSubmitted ? styles.buttonResubmit : {})
        }}
      >
        {children || (
          isSubmitting
            ? 'Submitting...'
            : hasBeenSubmitted
              ? 'Update Submission'
              : 'Submit This Section'
        )}
      </button>

      {lastSubmittedAt && (
        <p style={styles.success}>
          ✓ Submitted at {new Date(lastSubmittedAt).toLocaleString()}
          {submissionStatus?.submissionCount > 1 && (
            <span style={styles.resubmissionNote}>
              {' '}(Resubmission #{submissionStatus.submissionCount})
            </span>
          )}
        </p>
      )}

      {error && (
        <p style={styles.error}>
          ❌ {error}
        </p>
      )}

      <p style={styles.autoSaveNote}>
        💾 Your progress is automatically saved as you work
      </p>
    </div>
  )
}

const styles = {
  container: {
    marginTop: '20px',
    padding: '20px',
    borderTop: '1px solid #ddd',
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  buttonResubmit: {
    backgroundColor: '#ff6b35',
  },
  success: {
    marginTop: '12px',
    padding: '8px 12px',
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '4px',
    color: '#155724',
    fontSize: '14px',
    margin: '8px 0',
  },
  error: {
    marginTop: '12px',
    padding: '8px 12px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    color: '#721c24',
    fontSize: '14px',
    margin: '8px 0',
  },
  autoSaveNote: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
    margin: '8px 0 0 0',
  },
  resubmissionNote: {
    fontSize: '12px',
    color: '#856404',
  },
}