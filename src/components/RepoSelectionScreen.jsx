'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAutosave, useDataSubmission } from '@/hooks/useAutoSave'
import { getInitialRepoSelection, getRandomRepoExcluding, formatRepoName } from '@/lib/eloHelpers'

export function RepoSelectionScreen({ onNext, onBack, onForward, isCompleted }) {
  const { user } = useAuth()
  const [selectedRepos, setSelectedRepos] = useState([])
  const [initialRepos, setInitialRepos] = useState([])
  const [vetoedRepos, setVetoedRepos] = useState([])
  const [lockedRepos, setLockedRepos] = useState({ most: null, least: null })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [error, setError] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const screenType = 'repo_selection'
  const screenId = 'repo-selection'
  const data = {
    initialRepos: initialRepos.map(p => p.repo),
    vetoedRepos: vetoedRepos,
    finalSelectedRepos: selectedRepos.map(p => p.repo),
    mostValuableFromScale: lockedRepos.most,
    leastValuableFromScale: lockedRepos.least,
    timestamp: new Date().toISOString()
  }

  useAutosave(data, { user: user?.address, dataType: screenType, id: screenId })
  const { submitScreen, getSubmissionStatus } = useDataSubmission()

  useEffect(() => {
    if (user?.address && !isInitialized) {
      loadExistingDataOrInitialize()
    }
  }, [user?.address, isInitialized])

  const loadExistingDataOrInitialize = async () => {
    try {
      // First, get the Personal Scale data to know the locked repos
      const rangeDefSubmission = await getSubmissionStatus(user.address, 'personal_scale', 'range-definition')

      if (!rangeDefSubmission.exists || !rangeDefSubmission.data) {
        setError('Please complete the Personal Scale screen first')
        return
      }

      const mostValuable = rangeDefSubmission.data.mostValuableProject
      const leastValuable = rangeDefSubmission.data.leastValuableProject

      setLockedRepos({ most: mostValuable, least: leastValuable })

      // Check if repo selection was already done
      const submission = await getSubmissionStatus(user.address, screenType, screenId)

      if (submission.exists && submission.data) {
        // Load existing selection
        const initial = submission.data.initialRepos || []
        const vetoed = submission.data.vetoedRepos || []
        const final = submission.data.finalSelectedRepos || []

        // Convert repo names to project objects
        const { getProjectByRepo } = await import('@/lib/eloHelpers')
        setInitialRepos(initial.map(repo => getProjectByRepo(repo)).filter(p => p))
        setVetoedRepos(vetoed)
        setSelectedRepos(final.map(repo => getProjectByRepo(repo)).filter(p => p))
        setLastSubmittedAt(submission.data.timestamp)
      } else {
        // Generate initial selection
        const initial = getInitialRepoSelection(mostValuable, leastValuable)
        setInitialRepos(initial)
        setSelectedRepos(initial)
      }

      setIsInitialized(true)
    } catch (error) {
      console.error('Failed to load or initialize repo selection:', error)
      setError('Failed to load data. Please try again.')
    }
  }

  const handleDismiss = (repoToRemove) => {
    // Can't remove locked repos
    if (repoToRemove === lockedRepos.most || repoToRemove === lockedRepos.least) {
      return
    }

    // Add to vetoed list
    const newVetoedRepos = [...vetoedRepos, repoToRemove]
    setVetoedRepos(newVetoedRepos)

    // Get all repos that should be excluded
    const excludeList = [
      ...selectedRepos.map(p => p.repo),
      ...newVetoedRepos
    ]

    // Get a random replacement
    const replacement = getRandomRepoExcluding(excludeList)

    if (!replacement) {
      setError('No more projects available to select')
      return
    }

    // Replace in selected repos
    setSelectedRepos(prev =>
      prev.map(p => p.repo === repoToRemove ? replacement : p)
    )
  }

  const handleSubmit = async () => {
    if (selectedRepos.length !== 10) {
      setError('Please ensure you have exactly 10 projects selected')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const submitData = {
      initialRepos: initialRepos.map(p => p.repo),
      vetoedRepos: vetoedRepos,
      finalSelectedRepos: selectedRepos.map(p => p.repo),
      mostValuableFromScale: lockedRepos.most,
      leastValuableFromScale: lockedRepos.least,
      timestamp: new Date().toISOString(),
      wasSkipped: false
    }

    try {
      await submitScreen(user.address, screenType, screenId, submitData)

      // Then handle navigation
      if (onNext) {
        await onNext(submitData)
      }

      setLastSubmittedAt(new Date().toISOString())
    } catch (error) {
      console.error('Submission failed:', error)
      setError('Failed to submit selection. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLocked = (repo) => {
    return repo === lockedRepos.most || repo === lockedRepos.least
  }

  if (!isInitialized) {
    return (
      <div className="repo-selection-screen">
        <div className="content-container">
          <div className="loading">Loading projects...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="repo-selection-screen">
      <div className="content-container">
        <header className="screen-header">
          <h1>Select Projects to Evaluate</h1>
          <p className="subtitle">
            Choose 10 projects you're familiar with. Remove projects you don't know well - they'll be replaced automatically.
          </p>
        </header>

        <div className="info-section">
          <p>
            We've pre-selected projects including your most and least valuable choices from the previous step.
            You can remove unfamiliar projects (except the two locked ones).
          </p>
          <div className="stats">
            <span>Projects selected: {selectedRepos.length}/10</span>
            <span>•</span>
            <span>Projects removed: {vetoedRepos.length}</span>
          </div>
        </div>

        <div className="projects-grid">
          {selectedRepos.map((project) => (
            <div key={project.repo} className={`project-card ${isLocked(project.repo) ? 'locked' : ''}`}>
              <div className="project-header">
                <div className="project-name">{project.repo}</div>
                {isLocked(project.repo) ? (
                  <div className="lock-icon" title="From Personal Scale - cannot remove">
                    🔒
                  </div>
                ) : (
                  <button
                    onClick={() => handleDismiss(project.repo)}
                    className="dismiss-button"
                    disabled={isSubmitting}
                    title="Remove this project"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="project-meta">
                {isLocked(project.repo) && (
                  <span className="locked-label">
                    {project.repo === lockedRepos.most ? 'Most Valuable' : 'Least Valuable'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {lastSubmittedAt && (
          <div className="submission-status">
            ✓ Submitted successfully!
          </div>
        )}

        <div className="navigation-buttons">
          <button
            onClick={onBack}
            className="nav-button back-button"
            disabled={isSubmitting}
          >
            ← Back
          </button>

          <div className="right-buttons">
            {isCompleted && onForward ? (
              <button
                onClick={onForward}
                className="nav-button continue-button"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="nav-button continue-button"
                disabled={isSubmitting || selectedRepos.length !== 10}
              >
                {isSubmitting ? 'Submitting...' : 'Continue with These Projects'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .repo-selection-screen {
          max-width: 1000px;
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

        .info-section {
          background-color: #f7fafc;
          border-left: 4px solid #3182ce;
          padding: 1rem;
          margin-bottom: 2rem;
          border-radius: 4px;
        }

        .info-section p {
          margin: 0 0 0.5rem 0;
          line-height: 1.6;
          color: #2d3748;
        }

        .stats {
          display: flex;
          gap: 1rem;
          align-items: center;
          font-size: 0.9rem;
          color: #718096;
          margin-top: 0.5rem;
        }

        .projects-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .project-card {
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem;
          transition: all 0.2s;
        }

        .project-card:hover:not(.locked) {
          border-color: #cbd5e0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .project-card.locked {
          background: #f7fafc;
          border-color: #cbd5e0;
        }

        .project-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 0.5rem;
        }

        .project-name {
          font-family: monospace;
          font-size: 0.95rem;
          color: #2d3748;
          flex: 1;
          word-break: break-all;
        }

        .lock-icon {
          font-size: 1.2rem;
          opacity: 0.5;
          flex-shrink: 0;
        }

        .dismiss-button {
          background: transparent;
          border: none;
          font-size: 1.5rem;
          color: #cbd5e0;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          line-height: 1;
          flex-shrink: 0;
          transition: color 0.2s;
        }

        .dismiss-button:hover:not(:disabled) {
          color: #e53e3e;
        }

        .dismiss-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .project-meta {
          margin-top: 0.5rem;
          min-height: 20px;
        }

        .locked-label {
          font-size: 0.8rem;
          color: #718096;
          font-style: italic;
        }

        .loading {
          text-align: center;
          padding: 4rem 2rem;
          color: #718096;
          font-size: 1.1rem;
        }

        .error-message {
          background-color: #fed7d7;
          color: #c53030;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .submission-status {
          background-color: #c6f6d5;
          color: #22543d;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1rem;
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

        .nav-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .repo-selection-screen {
            padding: 1rem;
          }

          .content-container {
            padding: 1rem;
          }

          .projects-grid {
            grid-template-columns: 1fr;
          }

          .navigation-buttons {
            flex-direction: column;
            gap: 1rem;
          }

          .right-buttons {
            width: 100%;
            justify-content: stretch;
          }

          .nav-button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  )
}
