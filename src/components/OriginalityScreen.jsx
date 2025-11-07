'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAutosave, useDataSubmission } from '@/hooks/useAutoSave'

export function OriginalityScreen({ screenId: passedScreenId, targetProject, onNext, onBack, onForward, isCompleted }) {
  const { user } = useAuth()
  const [originality, setOriginality] = useState(80)
  const [reasoning, setReasoning] = useState('')
  const [wasSkipped, setWasSkipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [error, setError] = useState(null)

  const screenType = 'originality'
  // Use the screenId passed from parent as-is (e.g., "originality_1")
  const screenId = passedScreenId || 'originality_1'

  const data = {
    targetRepo: targetProject?.repo || '',
    originalityPercentage: originality,
    reasoning: reasoning,
    wasSkipped,
    assessmentTimestamp: new Date().toISOString()
  }

  useAutosave(data, { user: user?.address, dataType: screenType, id: screenId })
  const { submitScreen, getSubmissionStatus } = useDataSubmission()

  // Load existing data when user or project changes
  useEffect(() => {
    if (user?.address && targetProject) {
      loadExistingData()
    }
  }, [user?.address, targetProject])

  const loadExistingData = async () => {
    try {
      const submission = await getSubmissionStatus(user.address, screenType, screenId)
      if (submission.exists && submission.data) {
        setOriginality(submission.data.originalityPercentage || 50)
        setReasoning(submission.data.reasoning || '')
        setWasSkipped(submission.data.wasSkipped || false)
        setLastSubmittedAt(submission.data.assessmentTimestamp)
      }
    } catch (error) {
      console.error('Failed to load existing data:', error)
    }
  }

  const handleSliderChange = (e) => {
    setOriginality(parseInt(e.target.value))
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    // Allow empty string for clearing
    if (value === '') {
      setOriginality('')
      return
    }

    // Parse and constrain to 0-100
    const num = parseInt(value)
    if (!isNaN(num)) {
      setOriginality(Math.max(0, Math.min(100, num)))
    }
  }

  const handleInputBlur = () => {
    // If empty or invalid on blur, reset to 80
    if (originality === '' || isNaN(originality)) {
      setOriginality(80)
    }
  }

  const getOriginalityLabel = (percentage) => {
    if (percentage <= 30) return 'Fork/Wrapper'
    if (percentage <= 50) return 'Heavily Dependent'
    if (percentage <= 70) return 'Substantial Original'
    return 'Mostly Original'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!wasSkipped && (originality === '' || isNaN(originality))) {
      setError('Please provide an originality percentage')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await submitScreen(user.address, screenType, screenId, data)
      setLastSubmittedAt(new Date().toISOString())

      // Auto-dismiss the success toast after 3 seconds
      setTimeout(() => {
        setLastSubmittedAt(null)
      }, 3000)

      // After brief success display, move to next screen
      setTimeout(() => {
        if (onNext) {
          onNext({ alreadyCompleted: true })
        }
        setIsSubmitting(false)
      }, 1500)
    } catch (error) {
      console.error('Submission failed:', error)
      setError('Failed to submit assessment. Please try again.')
      setIsSubmitting(false)
    }
  }

  const handleSkip = async () => {
    setWasSkipped(true)
    setOriginality(80)  // Reset to default
    setReasoning('')

    // Wait for state to update, then submit
    setTimeout(async () => {
      setIsSubmitting(true)
      setError(null)

      const skipData = {
        targetRepo: targetProject?.repo || '',
        originalityPercentage: 80,
        reasoning: '',
        wasSkipped: true,
        assessmentTimestamp: new Date().toISOString()
      }

      try {
        await submitScreen(user.address, screenType, screenId, skipData)
        setLastSubmittedAt(new Date().toISOString())

        // Auto-dismiss the success toast after 3 seconds
        setTimeout(() => {
          setLastSubmittedAt(null)
        }, 3000)

        // After brief success display, move to next screen
        setTimeout(() => {
          if (onNext) {
            onNext({ alreadyCompleted: true })
          }
          setIsSubmitting(false)
        }, 1500)
      } catch (error) {
        console.error('Skip submission failed:', error)
        setError('Failed to skip assessment. Please try again.')
        setIsSubmitting(false)
      }
    }, 0)
  }

  if (!targetProject) {
    return <div>Loading...</div>
  }

  return (
    <div className="originality-screen">
      <div className="content-container">
        <header className="screen-header">
          <h1>Credit Attribution</h1>
          <p className="subtitle">
            How much credit belongs to this project vs. its dependencies?
          </p>
        </header>

        <div className="assessment-section">
          <div className="project-info">
            <a
              href={`https://github.com/${targetProject.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="project-name"
            >
              {targetProject.repo}
            </a>
          </div>

          <div className="task-description">
            <p>
              In this task, you are determining the percentage of this project's value to Ethereum
              that comes from its original work. We're splitting credit between the original contributions
              made by this project and the dependencies it builds on—the libraries, frameworks, and tools
              it imports. We strongly recommend reviewing the GitHub repository to understand what the
              project does, what it builds upon, and how it provides value before making this determination.
            </p>
            <p className="guide-intro">Suggested percentages as a guide:</p>
            <div className="percentage-guide">
              <div className="percentage-item"><strong>20%</strong> – Mostly a fork or wrapper</div>
              <div className="percentage-item"><strong>50%</strong> – Heavily dependent with substantial original work</div>
              <div className="percentage-item"><strong>80%</strong> – Mostly original work</div>
            </div>
          </div>

          <div className="controls-section">
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="100"
                value={originality}
                onChange={handleSliderChange}
                className="originality-slider"
                disabled={isSubmitting}
              />
              <div className="slider-labels">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="value-display">
              <div className="value-input-container">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={originality}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  className="value-input"
                  disabled={isSubmitting}
                />
                <span className="value-suffix">%</span>
              </div>
              <div className="value-label">{getOriginalityLabel(originality)}</div>
            </div>
          </div>

          <div className="reasoning-section">
            <label htmlFor="reasoning" className="reasoning-label">
              Why this score? (optional)
            </label>
            <textarea
              id="reasoning"
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Explain your assessment..."
              className="reasoning-input"
              rows="4"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {lastSubmittedAt && !error && (
            <div className="submission-status">
              ✓ {wasSkipped ? 'Skipped' : 'Assessment recorded'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-actions">
            <button
              type="button"
              onClick={onBack}
              className="nav-button back-button"
              disabled={isSubmitting}
            >
              ← Back
            </button>

            <div className="right-buttons">
              {!isCompleted && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="skip-button"
                  disabled={isSubmitting}
                >
                  Skip this step
                </button>
              )}

              {isCompleted && onForward ? (
                <button
                  type="button"
                  onClick={onForward}
                  className="nav-button continue-button"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="submit"
                  className="nav-button continue-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .originality-screen {
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

        .assessment-section {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .project-info {
          text-align: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 8px;
          border: 2px solid #0ea5e9;
        }

        .project-name {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 1.5rem;
          font-weight: 600;
          color: #0c4a6e;
          text-decoration: none;
          transition: color 0.2s;
          display: block;
        }

        .project-name:hover {
          color: #3182ce;
          text-decoration: underline;
        }

        .task-description {
          padding: 1.5rem;
          background: #f7fafc;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .task-description p {
          line-height: 1.6;
          color: #2d3748;
          margin: 0 0 1rem 0;
        }

        .guide-intro {
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 0.75rem !important;
        }

        .percentage-guide {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .percentage-item {
          padding: 0.75rem;
          background: white;
          border-left: 3px solid #3b82f6;
          border-radius: 4px;
          color: #4a5568;
          font-size: 0.95rem;
        }

        .percentage-item strong {
          color: #1e40af;
          font-weight: 600;
        }

        .controls-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem;
          background: #f8fafc;
          border-radius: 8px;
        }

        .slider-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .originality-slider {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(to right, #ef4444, #f59e0b, #10b981);
          outline: none;
          -webkit-appearance: none;
        }

        .originality-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #1d4ed8;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .originality-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #1d4ed8;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .originality-slider:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #718096;
          padding: 0 4px;
        }

        .value-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .value-input-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .value-input {
          width: 100px;
          padding: 0.75rem;
          border: 2px solid #3182ce;
          border-radius: 6px;
          font-size: 2rem;
          font-weight: 700;
          text-align: center;
          color: #1d4ed8;
          background: white;
        }

        .value-input:focus {
          outline: none;
          border-color: #1d4ed8;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .value-input:disabled {
          background-color: #f7fafc;
          cursor: not-allowed;
        }

        .value-suffix {
          font-size: 1.5rem;
          font-weight: 600;
          color: #374151;
        }

        .value-label {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1d4ed8;
          padding: 0.5rem 1rem;
          background: #dbeafe;
          border-radius: 6px;
        }

        .reasoning-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .reasoning-label {
          font-size: 1rem;
          font-weight: 500;
          color: #2d3748;
        }

        .reasoning-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #cbd5e0;
          border-radius: 6px;
          font-size: 1rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          resize: vertical;
          min-height: 100px;
        }

        .reasoning-input:focus {
          outline: none;
          border-color: #3182ce;
          box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
        }

        .reasoning-input:disabled {
          background-color: #f7fafc;
          cursor: not-allowed;
        }

        .error-message {
          background-color: #fed7d7;
          color: #c53030;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .submission-status {
          background-color: #c6f6d5;
          color: #22543d;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.9rem;
          text-align: center;
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #e2e8f0;
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

        .right-buttons {
          display: flex;
          gap: 1rem;
          align-items: center;
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
          .originality-screen {
            padding: 1rem;
          }

          .content-container {
            padding: 1rem;
          }

          .screen-header h1 {
            font-size: 1.5rem;
          }

          .form-actions {
            flex-direction: column;
            gap: 1rem;
          }

          .nav-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
