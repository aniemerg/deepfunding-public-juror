'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAutosave, useDataSubmission } from '@/hooks/useAutoSave'

export function OriginalityScreen({ targetProject, onNext, onBack, onForward, isCompleted }) {
  const { user } = useAuth()
  const [originality, setOriginality] = useState(50)
  const [reasoning, setReasoning] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [error, setError] = useState(null)

  const screenType = 'originality'
  const screenId = targetProject ? `originality-${targetProject.repo.replace(/\//g, '-')}` : 'pending'

  const data = {
    targetRepo: targetProject?.repo || '',
    originalityPercentage: originality,
    reasoning: reasoning,
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
    // If empty or invalid on blur, reset to 50
    if (originality === '' || isNaN(originality)) {
      setOriginality(50)
    }
  }

  const getOriginalityLabel = (percentage) => {
    if (percentage <= 20) return 'Derivative'
    if (percentage <= 40) return 'Incremental'
    if (percentage <= 60) return 'Hybrid'
    if (percentage <= 80) return 'Innovative'
    return 'Foundational'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (originality === '' || isNaN(originality)) {
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
          onNext()
        }
        setIsSubmitting(false)
      }, 1500)
    } catch (error) {
      console.error('Submission failed:', error)
      setError('Failed to submit assessment. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (!targetProject) {
    return <div>Loading...</div>
  }

  return (
    <div className="originality-screen">
      <div className="content-container">
        <header className="screen-header">
          <h1>Originality Assessment</h1>
          <p className="subtitle">
            Evaluate intrinsic vs derivative value
          </p>
        </header>

        <div className="assessment-section">
          <div className="project-info">
            <div className="project-name">{targetProject.repo}</div>
          </div>

          <div className="question-section">
            <label className="question-label">
              How original is this project?
            </label>
            <div className="scale-description">
              <span className="scale-anchor">0% = Derivative (implementation of existing ideas)</span>
              <span className="scale-anchor">25% = Incremental (meaningful improvements)</span>
              <span className="scale-anchor">50% = Hybrid (mix of novel and derivative)</span>
              <span className="scale-anchor">75% = Innovative (significant original contributions)</span>
              <span className="scale-anchor">100% = Foundational (created entirely new paradigms)</span>
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
              ✓ Assessment recorded
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
        }

        .question-section {
          text-align: center;
        }

        .question-label {
          display: block;
          font-size: 1.25rem;
          font-weight: 500;
          color: #2d3748;
          margin-bottom: 1rem;
        }

        .scale-description {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: #f7fafc;
          border-radius: 6px;
          font-size: 0.9rem;
          color: #4a5568;
          text-align: left;
        }

        .scale-anchor {
          line-height: 1.5;
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

        .nav-button:disabled {
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
