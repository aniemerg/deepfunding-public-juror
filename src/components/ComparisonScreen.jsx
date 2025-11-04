'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAutosave, useDataSubmission } from '@/hooks/useAutoSave'
import { 
  getRandomPair,
  getDiversePair,
  getFundingPercentage,
  formatRepoName
} from '@/lib/eloHelpers'

export function ComparisonScreen({ projectPair: plannedProjectPair, onNext, onBack, onProjectChange }) {
  const { user } = useAuth()
  const [projectA, setProjectA] = useState(null)
  const [projectB, setProjectB] = useState(null)
  const [multiplier, setMultiplier] = useState('')
  const [selectedWinner, setSelectedWinner] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [error, setError] = useState(null)
  const [showWeights, setShowWeights] = useState(false)

  const screenType = 'comparison'
  const comparisonId = projectA && projectB ? `${projectA.repo}-vs-${projectB.repo}` : 'pending'
  const screenId = `comparison-${comparisonId}`
  
  const data = {
    projectA: projectA?.repo || '',
    projectB: projectB?.repo || '',
    winner: selectedWinner,
    multiplier: multiplier ? parseFloat(multiplier) : null,
    comparisonTimestamp: new Date().toISOString()
  }

  useAutosave(data, { user: user?.address, dataType: screenType, id: screenId })
  const { submitScreen, getSubmissionStatus } = useDataSubmission()

  // Initialize with planned pair or random if not provided
  useEffect(() => {
    if (plannedProjectPair) {
      setProjectA(plannedProjectPair[0])
      setProjectB(plannedProjectPair[1])
      setSelectedWinner('')
      setMultiplier('')
      setError(null)
      setShowWeights(false)
      
      // Notify parent of project change for navigation
      if (onProjectChange) {
        onProjectChange({ 
          projectA: plannedProjectPair[0].repo, 
          projectB: plannedProjectPair[1].repo 
        })
      }
    } else {
      loadNewComparison()
    }
  }, [plannedProjectPair])

  // Update navigation text when projects change
  useEffect(() => {
    if (projectA && projectB && onProjectChange) {
      onProjectChange({ 
        projectA: projectA.repo, 
        projectB: projectB.repo 
      })
    }
  }, [projectA, projectB, onProjectChange])

  // Load existing data when user or projects change
  useEffect(() => {
    if (user?.address && projectA && projectB) {
      loadExistingData()
    }
  }, [user?.address, projectA, projectB])

  const loadNewComparison = () => {
    // Get a random pair
    const pair = getRandomPair()
    setProjectA(pair[0])
    setProjectB(pair[1])
    setSelectedWinner('')
    setMultiplier('')
    setError(null)
    setShowWeights(false)
    setIsSubmitting(false) // Reset submitting state
    
    // Notify parent of project change for navigation
    if (onProjectChange) {
      onProjectChange({ 
        projectA: pair[0].repo, 
        projectB: pair[1].repo 
      })
    }
  }

  const loadExistingData = async () => {
    try {
      const submission = await getSubmissionStatus(user.address, screenType, screenId)
      if (submission.exists && submission.data) {
        setSelectedWinner(submission.data.winner || '')
        setMultiplier(submission.data.multiplier ? String(submission.data.multiplier) : '')
        setLastSubmittedAt(submission.data.comparisonTimestamp)
      }
    } catch (error) {
      console.error('Failed to load existing data:', error)
    }
  }

  const handleProjectSelect = (project) => {
    setSelectedWinner(project)
    if (!multiplier) {
      // Set a default multiplier of 1.1
      setMultiplier('1.1')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedWinner || !multiplier) {
      setError('Please select a more valuable project and specify the multiplier')
      return
    }

    const mult = parseFloat(multiplier)
    if (mult < 1) {
      setError('Multiplier must be at least 1.0 (equal value)')
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
        setIsSubmitting(false) // Reset submitting state after navigation
      }, 1500)
    } catch (error) {
      console.error('Submission failed:', error)
      setError('Failed to submit comparison. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (!projectA || !projectB) {
    return <div>Loading...</div>
  }

  const weightA = parseFloat(getFundingPercentage(projectA.repo))
  const weightB = parseFloat(getFundingPercentage(projectB.repo))
  const expectedRatio = weightA / weightB

  return (
    <div className="comparison-screen">
      <div className="content-container">
        <header className="screen-header">
          <h1>Project Comparison</h1>
          <p className="subtitle">
            Compare two projects and indicate their relative value
          </p>
        </header>

        <div className="comparison-section">
          <div className="comparison-prompt">
            Which project is more valuable to the Ethereum ecosystem?
          </div>

          <div className="projects-container">
            <button
              className={`project-card ${selectedWinner === projectA.repo ? 'selected' : ''}`}
              onClick={() => handleProjectSelect(projectA.repo)}
              disabled={isSubmitting}
            >
              <div className="project-name">{projectA.repo}</div>
              <div className="project-rank">Rank #{projectA.rank}</div>
              {showWeights && (
                <div className="project-weight">Weight: {weightA.toFixed(2)}%</div>
              )}
            </button>

            <div className="vs-divider">VS</div>

            <button
              className={`project-card ${selectedWinner === projectB.repo ? 'selected' : ''}`}
              onClick={() => handleProjectSelect(projectB.repo)}
              disabled={isSubmitting}
            >
              <div className="project-name">{projectB.repo}</div>
              <div className="project-rank">Rank #{projectB.rank}</div>
              {showWeights && (
                <div className="project-weight">Weight: {weightB.toFixed(2)}%</div>
              )}
            </button>
          </div>

          {selectedWinner && (
            <div className="multiplier-section">
              <label htmlFor="multiplier">
                How many times more valuable is{' '}
                <strong>{formatRepoName(selectedWinner)}</strong>{' '}
                compared to{' '}
                <strong>{formatRepoName(selectedWinner === projectA.repo ? projectB.repo : projectA.repo)}</strong>?
              </label>
              <div className="multiplier-container">
                <input
                  id="multiplier"
                  type="number"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  placeholder="1.5"
                  min="1"
                  step="0.1"
                  className="multiplier-input"
                  disabled={isSubmitting}
                />
                <span className="multiplier-suffix">x</span>
              </div>
              <div className="multiplier-examples">
                <span>1x = equal value</span>
                <span>2x = twice as valuable</span>
                <span>10x = ten times more valuable</span>
              </div>
            </div>
          )}

          <div className="context-section">
            <button
              type="button"
              className="context-toggle"
              onClick={() => setShowWeights(!showWeights)}
            >
              {showWeights ? 'Hide' : 'Show'} ELO weights for reference
            </button>
            {showWeights && (
              <div className="context-info">
                <p>
                  Based on current ELO rankings, {weightA > weightB ? projectA.repo : projectB.repo} is{' '}
                  {expectedRatio > 1 ? expectedRatio.toFixed(1) : (1/expectedRatio).toFixed(1)}x more valuable.
                </p>
                <p className="context-note">
                  Your evaluation may differ from the current consensus - that's valuable input!
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {lastSubmittedAt && !error && (
            <div className="submission-status">
              ✓ Comparison recorded
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
            <button
              type="submit"
              className="nav-button continue-button"
              disabled={isSubmitting || !selectedWinner || !multiplier}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Comparison'}
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        .comparison-screen {
          max-width: 900px;
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
          margin: 0 0 0.5rem 0;
        }

        .progress-indicator {
          display: inline-block;
          margin-top: 0.5rem;
          padding: 0.25rem 0.75rem;
          background-color: #edf2f7;
          color: #4a5568;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .comparison-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .comparison-prompt {
          text-align: center;
          font-size: 1.1rem;
          font-weight: 500;
          color: #2d3748;
        }

        .projects-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          margin: 1rem 0;
        }

        .project-card {
          flex: 1;
          max-width: 300px;
          padding: 1.5rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .project-card:hover:not(:disabled) {
          border-color: #3182ce;
          box-shadow: 0 4px 12px rgba(49, 130, 206, 0.15);
        }

        .project-card.selected {
          border-color: #3182ce;
          background: linear-gradient(135deg, #ebf8ff 0%, #e0f2fe 100%);
          box-shadow: 0 4px 12px rgba(49, 130, 206, 0.2);
        }

        .project-card:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .project-name {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 1rem;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 0.5rem;
        }

        .project-rank {
          font-size: 0.85rem;
          color: #4a5568;
        }

        .project-weight {
          font-size: 0.85rem;
          color: #3182ce;
          margin-top: 0.25rem;
          font-weight: 500;
        }

        .vs-divider {
          font-weight: 700;
          color: #cbd5e0;
          font-size: 1.2rem;
        }

        .multiplier-section {
          background-color: #f7fafc;
          border-radius: 6px;
          padding: 1.5rem;
        }

        .multiplier-section label {
          display: block;
          margin-bottom: 1rem;
          color: #2d3748;
          line-height: 1.6;
        }

        .multiplier-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .multiplier-input {
          width: 150px;
          padding: 0.75rem;
          border: 2px solid #3182ce;
          border-radius: 6px;
          font-size: 2rem;
          font-weight: 700;
          text-align: center;
          color: #1d4ed8;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          transition: all 0.2s;
        }

        .multiplier-input:focus {
          outline: none;
          border-color: #1d4ed8;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .multiplier-input:disabled {
          background-color: #f7fafc;
          cursor: not-allowed;
        }

        .multiplier-suffix {
          font-size: 1.5rem;
          font-weight: 600;
          color: #374151;
        }

        .multiplier-examples {
          display: flex;
          justify-content: center;
          gap: 2rem;
          font-size: 0.85rem;
          color: #718096;
        }

        .context-section {
          text-align: center;
        }

        .context-toggle {
          background: none;
          border: none;
          color: #3182ce;
          text-decoration: underline;
          cursor: pointer;
          font-size: 0.9rem;
          padding: 0.25rem;
        }

        .context-toggle:hover {
          color: #2c5282;
        }

        .context-info {
          margin-top: 1rem;
          padding: 1rem;
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
        }

        .context-info p {
          margin: 0.5rem 0;
          color: #0c4a6e;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .context-note {
          font-style: italic;
          font-size: 0.85rem !important;
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

        @media (max-width: 768px) {
          .projects-container {
            flex-direction: column;
            gap: 1rem;
          }

          .project-card {
            max-width: 100%;
          }

          .vs-divider {
            transform: rotate(90deg);
            margin: -0.5rem 0;
          }

          .multiplier-examples {
            flex-direction: column;
            gap: 0.25rem;
          }
        }

        @media (max-width: 640px) {
          .comparison-screen {
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
        }
      `}</style>
    </div>
  )
}