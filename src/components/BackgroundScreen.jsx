'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAutosave, useDataSubmission } from '@/hooks/useAutoSave'

export function BackgroundScreen({ onNext, onBack }) {
  const { user } = useAuth()
  const [backgroundText, setBackgroundText] = useState('')
  const [wasSkipped, setWasSkipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [error, setError] = useState(null)

  const screenType = 'background'
  const screenId = 'background-info'
  const data = {
    backgroundText: backgroundText.trim() || null,
    backgroundTimestamp: new Date().toISOString(),
    wasSkipped
  }

  useAutosave(data, { user: user?.address, dataType: screenType, id: screenId })
  const { submitScreen, getSubmissionStatus } = useDataSubmission()

  useEffect(() => {
    if (user?.address) {
      loadExistingData()
    }
  }, [user?.address])

  const loadExistingData = async () => {
    try {
      const submission = await getSubmissionStatus(user.address, screenType, screenId)
      if (submission.exists && submission.data) {
        setBackgroundText(submission.data.backgroundText || '')
        setWasSkipped(submission.data.wasSkipped || false)
        setLastSubmittedAt(submission.data.backgroundTimestamp)
      }
    } catch (error) {
      console.error('Failed to load existing data:', error)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await submitScreen(user.address, screenType, screenId, data)
      setLastSubmittedAt(new Date().toISOString())
      
      if (onNext) {
        onNext()
      }
    } catch (error) {
      console.error('Submission failed:', error)
      setError('Failed to submit background information. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    if (window.confirm('Are you sure? Providing background information helps validate your expertise and increases the weight given to your comparisons.')) {
      setWasSkipped(true)
      setBackgroundText('')
      handleSubmit()
    }
  }

  const handleContinue = () => {
    if (!backgroundText.trim() && !wasSkipped) {
      if (window.confirm('Proceed without background information?')) {
        setWasSkipped(true)
        handleSubmit()
      }
    } else {
      handleSubmit()
    }
  }

  const isComplete = backgroundText.trim().length > 0 || wasSkipped
  const charCount = backgroundText.length
  const maxChars = 2000

  return (
    <div className="background-screen">
      <div className="content-container">
        <header className="screen-header">
          <h1>Tell Us About Your Background</h1>
          <p className="subtitle">
            This information helps us evaluate the credibility of your assessments
          </p>
        </header>

        <div className="form-section">
          <div className="info-prompt">
            <p>
              Please share relevant background information such as your experience in the Ethereum ecosystem, 
              technical expertise, professional role, or any other context that demonstrates your 
              qualifications to evaluate these projects.
            </p>
            <p className="privacy-note">
              This information will be reviewed by meta-jurors to assess submission quality. 
              It will not be made public without your consent.
            </p>
          </div>

          <div className="textarea-container">
            <textarea
              value={backgroundText}
              onChange={(e) => {
                if (e.target.value.length <= maxChars) {
                  setBackgroundText(e.target.value)
                  setWasSkipped(false)
                }
              }}
              placeholder="Tell us about your background, experience, and expertise..."
              className="background-textarea"
              rows={8}
              disabled={isSubmitting}
            />
            <div className="char-counter">
              {charCount}/{maxChars} characters
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {lastSubmittedAt && (
            <div className="submission-status">
              ✓ Last submitted: {new Date(lastSubmittedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div className="navigation-buttons">
          <button 
            onClick={onBack}
            className="nav-button back-button"
            disabled={isSubmitting}
          >
            ← Back to Login
          </button>

          <div className="right-buttons">
            <button
              onClick={handleSkip}
              className="skip-button"
              disabled={isSubmitting}
            >
              Skip this step
            </button>
            
            <button
              onClick={handleContinue}
              className="nav-button continue-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .background-screen {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .content-container {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .screen-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .screen-header h1 {
          font-size: 2rem;
          font-weight: 600;
          color: #1a202c;
          margin: 0 0 0.5rem 0;
        }

        .subtitle {
          font-size: 1.1rem;
          color: #4a5568;
          margin: 0;
        }

        .form-section {
          margin-bottom: 2rem;
        }

        .info-prompt {
          margin-bottom: 1.5rem;
        }

        .info-prompt p {
          margin-bottom: 1rem;
          line-height: 1.6;
          color: #2d3748;
        }

        .privacy-note {
          font-size: 0.9rem;
          color: #718096;
          font-style: italic;
        }

        .textarea-container {
          position: relative;
        }

        .background-textarea {
          width: 100%;
          min-height: 200px;
          padding: 1rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 1rem;
          line-height: 1.5;
          resize: vertical;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .background-textarea:focus {
          outline: none;
          border-color: #3182ce;
          box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
        }

        .background-textarea:disabled {
          background-color: #f7fafc;
          cursor: not-allowed;
        }

        .char-counter {
          text-align: right;
          margin-top: 0.5rem;
          font-size: 0.9rem;
          color: ${charCount > maxChars * 0.9 ? '#e53e3e' : '#718096'};
        }

        .error-message {
          background-color: #fed7d7;
          color: #c53030;
          padding: 0.75rem;
          border-radius: 6px;
          margin-top: 1rem;
          font-size: 0.9rem;
        }

        .submission-status {
          background-color: #c6f6d5;
          color: #22543d;
          padding: 0.75rem;
          border-radius: 6px;
          margin-top: 1rem;
          font-size: 0.9rem;
        }

        .navigation-buttons {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .right-buttons {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .nav-button {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button {
          background-color: #f7fafc;
          color: #4a5568;
        }

        .back-button:hover:not(:disabled) {
          background-color: #edf2f7;
        }

        .continue-button {
          background-color: #3182ce;
          color: white;
        }

        .continue-button:hover:not(:disabled) {
          background-color: #2c5282;
        }

        .skip-button {
          background: none;
          border: none;
          color: #718096;
          text-decoration: underline;
          cursor: pointer;
          font-size: 0.9rem;
          padding: 0.5rem;
        }

        .skip-button:hover:not(:disabled) {
          color: #4a5568;
        }

        .nav-button:disabled,
        .skip-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .background-screen {
            padding: 1rem;
          }

          .content-container {
            padding: 1rem;
          }

          .navigation-buttons {
            flex-direction: column;
            gap: 1rem;
          }

          .right-buttons {
            width: 100%;
            justify-content: space-between;
          }

          .nav-button {
            flex: 1;
            min-width: 120px;
          }
        }
      `}</style>
    </div>
  )
}