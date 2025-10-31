'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAutosave, useDataSubmission } from '@/hooks/useAutoSave'
import { 
  getAllProjects, 
  getRandomProject, 
  getSimilarProjects,
  formatRepoName,
  getFundingPercentage 
} from '@/lib/eloDataset'

export function SimilarProjectsScreen({ onNext, onBack, onProjectChange }) {
  const { user } = useAuth()
  const [targetProject, setTargetProject] = useState(null)
  const [selectedProject, setSelectedProject] = useState('')
  const [multiplier, setMultiplier] = useState('1.0')
  const [suggestions, setSuggestions] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [error, setError] = useState(null)
  const [completedComparisons, setCompletedComparisons] = useState([])

  const screenType = 'similar_projects'
  const screenId = `similar-${targetProject?.repo || 'pending'}`
  const data = {
    targetProject: targetProject?.repo || '',
    similarProject: selectedProject,
    similarMultiplier: multiplier ? parseFloat(multiplier) : null,
    similarTimestamp: new Date().toISOString()
  }

  useAutosave(data, { user: user?.address, dataType: screenType, id: screenId })
  const { submitScreen, getSubmissionStatus } = useDataSubmission()

  const projects = getAllProjects()

  // Initialize with a random project
  useEffect(() => {
    selectNewTarget()
  }, [])

  // Load existing data when user or target changes
  useEffect(() => {
    if (user?.address && targetProject) {
      loadExistingData()
    }
  }, [user?.address, targetProject])

  const selectNewTarget = () => {
    const newTarget = getRandomProject()
    setTargetProject(newTarget)
    setSelectedProject('')
    setMultiplier('1.0')
    setError(null)
    setIsSubmitting(false) // Reset submitting state
    
    // Get similar projects based on ELO weights
    const similar = getSimilarProjects(newTarget.repo, 2.0, 3)
    setSuggestions(similar)
    
    // Notify parent of project change for navigation
    if (onProjectChange) {
      onProjectChange({ targetProject: newTarget.repo })
    }
  }

  const loadExistingData = async () => {
    try {
      const submission = await getSubmissionStatus(user.address, screenType, screenId)
      if (submission.exists && submission.data) {
        setSelectedProject(submission.data.similarProject || '')
        setMultiplier(submission.data.similarMultiplier ? String(submission.data.similarMultiplier) : '1.0')
        setLastSubmittedAt(submission.data.similarTimestamp)
      }
    } catch (error) {
      console.error('Failed to load existing data:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedProject || !multiplier) {
      setError('Please select a project and specify the multiplier')
      return
    }

    const mult = parseFloat(multiplier)
    if (mult < 1.0 || mult > 2.0) {
      setError('Multiplier must be between 1.0 and 2.0')
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
      
      // Track this comparison
      const newCompletedComparisons = [...completedComparisons, targetProject.repo]
      setCompletedComparisons(newCompletedComparisons)
      
      // After brief success display, get a new project
      setTimeout(() => {
        if (newCompletedComparisons.length >= 2) {
          // After 2 comparisons, move to next screen
          if (onNext) {
            onNext()
          }
        } else {
          selectNewTarget()
        }
        setIsSubmitting(false) // Reset submitting state after navigation
      }, 1500)
    } catch (error) {
      console.error('Submission failed:', error)
      setError('Failed to submit comparison. Please try again.')
      setIsSubmitting(false)
    }
  }

  const handleSuggestionClick = (suggestion) => {
    setSelectedProject(suggestion.repo)
    // Set a reasonable default multiplier based on weight ratio
    const ratio = suggestion.weight / targetProject.weight
    setMultiplier(ratio > 1 ? ratio.toFixed(1) : (1 / ratio).toFixed(1))
  }

  // Create dropdown options with None first
  const getDropdownOptions = () => {
    const options = [{ value: 'None', label: 'None - No similar projects' }]
    const filteredRepos = projects.filter(repo => repo !== targetProject?.repo)
    filteredRepos.forEach(repo => {
      options.push({ value: repo, label: repo })
    })
    return options
  }

  if (!targetProject) {
    return <div>Loading...</div>
  }

  const progress = completedComparisons.length + 1

  return (
    <div className="similar-projects-screen">
      <div className="content-container">
        <header className="screen-header">
          <h1>Find Similar Projects</h1>
          <p className="subtitle">
            Identify projects of similar value to establish value clusters
          </p>
          <div className="progress-indicator">
            Comparison {progress} of 2
          </div>
        </header>

        <div className="target-section">
          <div className="target-label">Target Project:</div>
          <div className="target-project">
            <strong>{targetProject.repo}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="similarity-form">
          <div className="question-text">
            Name a project of equal or greater value to <strong>{formatRepoName(targetProject.repo)}</strong>, 
            within a factor of two (or select "None" if no similar projects exist):
          </div>

          <div className="form-group">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="project-select"
              disabled={isSubmitting}
            >
              <option value="">Select a similar project...</option>
              {getDropdownOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {suggestions.length > 0 && (
            <div className="suggestions-section">
              <div className="suggestions-label">Possibly similar projects:</div>
              <div className="suggestions-grid">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className="suggestion-button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isSubmitting}
                  >
                    <div className="suggestion-repo">{suggestion.repo}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedProject && selectedProject !== 'None' && (
            <div className="form-group">
              <label htmlFor="multiplier">
                How many times more valuable is {formatRepoName(selectedProject)} compared to {formatRepoName(targetProject.repo)}?
              </label>
              <div className="multiplier-container">
                <input
                  id="multiplier"
                  type="number"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  placeholder="1.0"
                  min="1.0"
                  max="2.0"
                  step="0.1"
                  className="multiplier-input"
                  disabled={isSubmitting}
                />
                <span className="multiplier-hint">
                  (1.0 = equally valuable, 2.0 = twice as valuable)
                </span>
              </div>
            </div>
          )}

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
              disabled={isSubmitting || !selectedProject}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Comparison'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .similar-projects-screen {
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

        .target-section {
          background-color: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .target-label {
          font-size: 0.85rem;
          color: #0c4a6e;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .target-project {
          text-align: center;
        }

        .target-project strong {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 1.1rem;
          color: #0c4a6e;
        }

        .similarity-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .question-text {
          line-height: 1.6;
          color: #2d3748;
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

        .suggestions-section {
          background-color: #f7fafc;
          border-radius: 6px;
          padding: 1rem;
        }

        .suggestions-label {
          font-size: 0.85rem;
          color: #4a5568;
          margin-bottom: 0.75rem;
          font-weight: 500;
        }

        .suggestions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 0.75rem;
        }

        .suggestion-button {
          background-color: white;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .suggestion-button:hover:not(:disabled) {
          border-color: #3182ce;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .suggestion-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .suggestion-repo {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 0.9rem;
          color: #2d3748;
        }

        .multiplier-container {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .multiplier-input {
          width: 120px;
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

        .multiplier-hint {
          font-size: 0.85rem;
          color: #718096;
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
          .similar-projects-screen {
            padding: 1rem;
          }

          .content-container {
            padding: 1rem;
          }

          .suggestions-grid {
            grid-template-columns: 1fr;
          }

          .multiplier-container {
            flex-direction: column;
            align-items: flex-start;
          }

          .multiplier-input {
            width: 100%;
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