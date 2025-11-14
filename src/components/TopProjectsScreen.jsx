'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAutosave, useDataSubmission } from '@/hooks/useAutoSave'
import { getAllProjectsWithSummaries, getGitHubUrl } from '@/lib/projectSummaries'

const MAX_SELECTIONS = 3

export function TopProjectsScreen({ onNext, onBack, onForward, isCompleted }) {
  const { user } = useAuth()
  const [selectedRepos, setSelectedRepos] = useState([])
  const [expandedRepos, setExpandedRepos] = useState([])
  const [screenOpenedAt, setScreenOpenedAt] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [error, setError] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const hasSetOpenTime = useRef(false)

  // Safely load projects with error handling
  const allProjects = useMemo(() => {
    try {
      console.log('TopProjectsScreen: Loading project summaries...')
      const projects = getAllProjectsWithSummaries()
      console.log('TopProjectsScreen: Loaded', projects?.length, 'projects')
      if (!projects || projects.length === 0) {
        throw new Error('No projects returned from getAllProjectsWithSummaries()')
      }
      return projects
    } catch (error) {
      console.error('TopProjectsScreen: Failed to load project summaries:', error)
      console.error('TopProjectsScreen: Error stack:', error.stack)
      setError(`Failed to load project data: ${error.message}`)
      return []
    }
  }, [])

  const screenType = 'top_projects'
  const screenId = 'top-projects'

  const data = {
    selectedRepos: selectedRepos,
    screenOpenedAt: screenOpenedAt,
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
      // Check if this screen was already completed
      const submission = await getSubmissionStatus(user.address, screenType, screenId)

      if (submission.exists && submission.data) {
        // Load existing selections
        const existing = submission.data.selectedRepos || []
        setSelectedRepos(existing)
        setScreenOpenedAt(submission.data.screenOpenedAt || new Date().toISOString())
        setLastSubmittedAt(submission.data.timestamp)
        hasSetOpenTime.current = true
      } else {
        // First time - set screen opened time
        if (!hasSetOpenTime.current) {
          const now = new Date().toISOString()
          setScreenOpenedAt(now)
          hasSetOpenTime.current = true
        }
      }

      setIsInitialized(true)
    } catch (error) {
      console.error('Failed to load or initialize top projects:', error)
      setError('Failed to load data. Please try again.')
    }
  }

  const handleToggleSelection = (repo) => {
    setSelectedRepos(prev => {
      if (prev.includes(repo)) {
        // Unselecting
        return prev.filter(r => r !== repo)
      } else {
        // Selecting - check limit
        if (prev.length >= MAX_SELECTIONS) {
          return prev // Already at max, don't add
        }
        return [...prev, repo]
      }
    })
  }

  const handleToggleExpand = (repo) => {
    setExpandedRepos(prev => {
      if (prev.includes(repo)) {
        return prev.filter(r => r !== repo)
      } else {
        return [...prev, repo]
      }
    })
  }

  const handleSubmit = async () => {
    if (selectedRepos.length !== MAX_SELECTIONS) {
      setError(`Please select exactly ${MAX_SELECTIONS} projects`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    const submitData = {
      selectedRepos: selectedRepos,
      screenOpenedAt: screenOpenedAt,
      timestamp: new Date().toISOString(),
      reposShownOrder: allProjects.map(p => p.repo), // Track order they were shown
      wasSkipped: false
    }

    try {
      await submitScreen(user.address, screenType, screenId, submitData)

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

  const isSelected = (repo) => selectedRepos.includes(repo)
  const isExpanded = (repo) => expandedRepos.includes(repo)
  const atMaxSelections = selectedRepos.length >= MAX_SELECTIONS

  // Show error if project data failed to load
  if (allProjects.length === 0 && error) {
    return (
      <div className="top-projects-screen">
        <div className="content-container">
          <div className="error-message">
            <h2>Error Loading Projects</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Reload Page</button>
          </div>
        </div>
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="top-projects-screen">
        <div className="content-container">
          <div className="loading">Loading projects...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="top-projects-screen">
      <div className="content-container">
        <header className="screen-header">
          <h1>Select Top {MAX_SELECTIONS} Most Valuable Projects</h1>
          <p className="subtitle">
            Choose the {MAX_SELECTIONS} projects you consider most valuable to the Ethereum ecosystem
          </p>
        </header>

        {selectedRepos.length > 0 && (
          <div className="selected-section">
            <h2>Selected ({selectedRepos.length}/{MAX_SELECTIONS})</h2>
            <div className="selected-list">
              {selectedRepos.map(repo => (
                <div key={repo} className="selected-item">
                  <span className="repo-name">{repo}</span>
                  <button
                    onClick={() => handleToggleSelection(repo)}
                    className="unselect-button"
                    title="Remove selection"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="info-section">
          <p>
            Select {MAX_SELECTIONS} projects from the list below. You can expand each project to read its summary.
          </p>
          <div className="stats">
            <span>Selected: {selectedRepos.length}/{MAX_SELECTIONS}</span>
            {atMaxSelections && (
              <>
                <span>•</span>
                <span className="limit-reached">Maximum reached (unselect to change)</span>
              </>
            )}
          </div>
        </div>

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
                disabled={isSubmitting || selectedRepos.length !== MAX_SELECTIONS}
              >
                {isSubmitting ? 'Submitting...' : `Continue with ${selectedRepos.length}/${MAX_SELECTIONS} Selected`}
              </button>
            )}
          </div>
        </div>

        <div className="projects-list">
          <h2>All Projects</h2>
          {allProjects.map((project) => {
            const selected = isSelected(project.repo)
            const expanded = isExpanded(project.repo)
            const checkboxDisabled = !selected && atMaxSelections

            return (
              <div key={project.repo} className={`project-item ${selected ? 'selected' : ''}`}>
                <div className="project-row">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => handleToggleSelection(project.repo)}
                    disabled={checkboxDisabled}
                    className="project-checkbox"
                    id={`checkbox-${project.repo}`}
                  />
                  <button
                    onClick={() => handleToggleExpand(project.repo)}
                    className="expand-button"
                    aria-label={expanded ? 'Collapse summary' : 'Expand summary'}
                  >
                    <span className="disclosure-triangle">{expanded ? '▼' : '▶'}</span>
                  </button>
                  <label
                    htmlFor={`checkbox-${project.repo}`}
                    className="project-name-label"
                  >
                    {project.repo}
                  </label>
                </div>

                {expanded && (
                  <div className="project-summary">
                    <p className="summary-label">AI Generated Project Summary:</p>
                    <p>{project.summary}</p>
                    <a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="github-link"
                    >
                      View on GitHub: {project.repo} →
                    </a>
                  </div>
                )}
              </div>
            )
          })}
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
                disabled={isSubmitting || selectedRepos.length !== MAX_SELECTIONS}
              >
                {isSubmitting ? 'Submitting...' : `Continue with ${selectedRepos.length}/${MAX_SELECTIONS} Selected`}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .top-projects-screen {
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
          margin: 0;
        }

        .selected-section {
          background-color: #e6fffa;
          border: 2px solid #38b2ac;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .selected-section h2 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #234e52;
          margin: 0 0 0.75rem 0;
        }

        .selected-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .selected-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: white;
          border: 1px solid #38b2ac;
          border-radius: 6px;
          padding: 0.5rem 0.75rem;
        }

        .selected-item .repo-name {
          font-family: monospace;
          font-size: 0.9rem;
          color: #2d3748;
        }

        .unselect-button {
          background: transparent;
          border: none;
          color: #e53e3e;
          cursor: pointer;
          font-size: 1.2rem;
          padding: 0;
          line-height: 1;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .unselect-button:hover {
          color: #c53030;
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

        .limit-reached {
          color: #d69e2e;
          font-weight: 500;
        }

        .projects-list {
          margin-bottom: 2rem;
        }

        .projects-list h2 {
          font-size: 1.3rem;
          font-weight: 600;
          color: #2d3748;
          margin: 0 0 1rem 0;
        }

        .project-item {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          margin-bottom: 0.5rem;
          padding: 0.75rem;
          transition: all 0.2s;
        }

        .project-item:hover {
          background-color: #f7fafc;
          border-color: #cbd5e0;
        }

        .project-item.selected {
          background-color: #e6fffa;
          border-color: #38b2ac;
        }

        .project-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .project-checkbox {
          width: 20px;
          height: 20px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .project-checkbox:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .expand-button {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        .disclosure-triangle {
          color: #718096;
          font-size: 0.9rem;
          transition: transform 0.2s;
        }

        .expand-button:hover .disclosure-triangle {
          color: #4a5568;
        }

        .project-name-label {
          font-family: monospace;
          font-size: 1rem;
          color: #2d3748;
          cursor: pointer;
          flex: 1;
          user-select: none;
        }

        .project-summary {
          margin-top: 1rem;
          padding: 1rem;
          background-color: #f7fafc;
          border-radius: 4px;
          border-left: 3px solid #3182ce;
        }

        .project-summary p {
          margin: 0 0 1rem 0;
          line-height: 1.6;
          color: #2d3748;
          font-size: 0.95rem;
        }

        .project-summary .summary-label {
          font-weight: 600;
          color: #718096;
          font-size: 0.85rem;
          font-style: italic;
          margin-bottom: 0.5rem;
        }

        .github-link {
          display: inline-block;
          color: #3182ce;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .github-link:hover {
          text-decoration: underline;
          color: #2c5282;
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
          .top-projects-screen {
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
