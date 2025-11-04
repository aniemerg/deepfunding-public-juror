'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAutosave, useDataSubmission } from '@/hooks/useAutoSave'
import { getAllProjects, formatRepoName } from '@/lib/eloHelpers'

export function RangeDefinitionScreen({ onNext, onBack }) {
  const { user } = useAuth()
  const [mostValuable, setMostValuable] = useState('')
  const [leastValuable, setLeastValuable] = useState('')
  const [multiplier, setMultiplier] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [error, setError] = useState(null)

  const screenType = 'personal_scale'
  const screenId = 'range-definition'
  const data = {
    mostValuableProject: mostValuable,
    leastValuableProject: leastValuable,
    scaleMultiplier: multiplier ? parseFloat(multiplier) : null,
    scaleTimestamp: new Date().toISOString()
  }

  useAutosave(data, { user: user?.address, dataType: screenType, id: screenId })
  const { submitScreen, getSubmissionStatus } = useDataSubmission()

  const projects = getAllProjects()

  useEffect(() => {
    if (user?.address) {
      loadExistingData()
    }
  }, [user?.address])

  const loadExistingData = async () => {
    try {
      const submission = await getSubmissionStatus(user.address, screenType, screenId)
      if (submission.exists && submission.data) {
        setMostValuable(submission.data.mostValuableProject || '')
        setLeastValuable(submission.data.leastValuableProject || '')
        setMultiplier(submission.data.scaleMultiplier ? String(submission.data.scaleMultiplier) : '')
        setLastSubmittedAt(submission.data.scaleTimestamp)
      }
    } catch (error) {
      console.error('Failed to load existing data:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!mostValuable || !leastValuable || !multiplier) {
      setError('Please complete all fields')
      return
    }

    if (mostValuable === leastValuable) {
      setError('Please select different projects for most and least valuable')
      return
    }

    if (parseFloat(multiplier) < 1) {
      setError('Multiplier must be at least 1')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await submitScreen(user.address, screenType, screenId, data)
      setLastSubmittedAt(new Date().toISOString())
      
      // Brief success state before moving to next screen
      setTimeout(() => {
        if (onNext) {
          onNext()
        }
      }, 1000)
    } catch (error) {
      console.error('Submission failed:', error)
      setError('Failed to submit scale definition. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="range-definition-screen">
      <div className="content-container">
        <header className="screen-header">
          <h1>Define Your Personal Scale</h1>
          <p className="subtitle">
            Help us understand your evaluation scale by identifying the extremes
          </p>
        </header>

        <div className="form-section">
          <div className="info-prompt">
            <p>
              Before making comparisons, we need to understand your personal scale.
              Select the projects you consider most and least valuable, then indicate
              how many times more valuable the top project is compared to the bottom.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="range-form">
            <div className="form-group">
              <label htmlFor="most-valuable">
                Most valuable project in the ecosystem:
              </label>
              <select
                id="most-valuable"
                value={mostValuable}
                onChange={(e) => setMostValuable(e.target.value)}
                className="project-select"
                disabled={isSubmitting}
              >
                <option value="">Select most valuable project...</option>
                {projects.map((repo) => (
                  <option key={repo} value={repo}>
                    {repo}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="least-valuable">
                Least valuable project in the ecosystem:
              </label>
              <select
                id="least-valuable"
                value={leastValuable}
                onChange={(e) => setLeastValuable(e.target.value)}
                className="project-select"
                disabled={isSubmitting}
              >
                <option value="">Select least valuable project...</option>
                {projects.map((repo) => (
                  <option key={repo} value={repo}>
                    {repo}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="multiplier">
                How many times more valuable is {mostValuable ? formatRepoName(mostValuable) : 'the top project'} compared to {leastValuable ? formatRepoName(leastValuable) : 'the bottom project'}?
              </label>
              <input
                id="multiplier"
                type="number"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                placeholder="e.g., 1000"
                min="1"
                step="0.1"
                className="multiplier-input"
                disabled={isSubmitting}
              />
              <span className="input-hint">
                Enter 1 if they are equally valuable, 10 if top is 10x more valuable, etc.
              </span>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {lastSubmittedAt && !error && (
              <div className="submission-status">
                ✓ Scale defined: {formatRepoName(mostValuable)} is {multiplier}x more valuable than {formatRepoName(leastValuable)}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={onBack}
                className="nav-button back-button"
                disabled={isSubmitting}
              >
                ← Back
              </button>
              <button
                type="submit"
                className="nav-button continue-button"
                disabled={isSubmitting || !mostValuable || !leastValuable || !multiplier}
              >
                {isSubmitting ? 'Submitting...' : 'Define My Scale'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .range-definition-screen {
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
          margin-bottom: 2rem;
        }

        .info-prompt p {
          line-height: 1.6;
          color: #2d3748;
        }

        .range-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 500;
          color: #2d3748;
          font-size: 0.95rem;
        }

        .project-select {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 6px;
          font-size: 1rem;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          background-color: white;
          transition: border-color 0.2s;
        }

        .project-select:focus {
          outline: none;
          border-color: #3182ce;
          box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
        }

        .project-select:disabled {
          background-color: #f7fafc;
          cursor: not-allowed;
        }

        .multiplier-input {
          width: 200px;
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 6px;
          font-size: 1.25rem;
          font-weight: 600;
          text-align: center;
          transition: border-color 0.2s;
        }

        .multiplier-input:focus {
          outline: none;
          border-color: #3182ce;
          box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
        }

        .multiplier-input:disabled {
          background-color: #f7fafc;
          cursor: not-allowed;
        }

        .input-hint {
          font-size: 0.85rem;
          color: #718096;
          font-style: italic;
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
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2rem;
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
          .range-definition-screen {
            padding: 1rem;
          }

          .content-container {
            padding: 1rem;
          }

          .form-actions {
            flex-direction: column;
            gap: 1rem;
          }

          .nav-button {
            width: 100%;
          }

          .multiplier-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}