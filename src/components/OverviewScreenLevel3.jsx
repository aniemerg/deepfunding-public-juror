'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getDependencies, getRepositorySummary } from '@/lib/seedReposDataset'

export default function OverviewScreenLevel3({ repoUrl, user }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dependencies, setDependencies] = useState([])
  const [parentSummary, setParentSummary] = useState(null)

  // Separate state for display values and computed weights
  const [inputValues, setInputValues] = useState({}) // User's input (percentage strings)
  const [adjustedWeights, setAdjustedWeights] = useState({}) // Computed values (decimals)
  const [editedFields, setEditedFields] = useState(new Set()) // Track which fields were edited

  const [comment, setComment] = useState('')
  const [showCommentBox, setShowCommentBox] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const [autoSaveStatus, setAutoSaveStatus] = useState(null) // 'saving' | 'saved' | null
  const [lastSaved, setLastSaved] = useState(null)

  const [modalOpen, setModalOpen] = useState(null) // dep URL or null

  const autoSaveTimerRef = useRef(null)

  const parentName = repoUrl.replace('https://github.com/', '')

  // Load dependencies and AI weights
  useEffect(() => {
    async function loadDependencies() {
      try {
        const deps = getDependencies(repoUrl)

        if (!deps || deps.length === 0) {
          throw new Error('No dependencies found for this repository')
        }

        // Transform to include aiWeight
        const depsWithWeights = deps.map(dep => ({
          url: dep.url,
          name: dep.fullName,
          aiWeight: dep.weight, // This comes from seedReposWithDependenciesAndWeights.json
          summary: dep.summary || null
        }))

        setDependencies(depsWithWeights)

        // Initialize input values with AI weights (as percentages)
        const initialInputs = {}
        const initialAdjusted = {}
        depsWithWeights.forEach(dep => {
          const percentage = (dep.aiWeight * 100).toFixed(2)
          initialInputs[dep.url] = percentage
          initialAdjusted[dep.url] = dep.aiWeight
        })
        setInputValues(initialInputs)
        setAdjustedWeights(initialAdjusted)

        // Load parent summary
        const summary = getRepositorySummary(repoUrl)
        setParentSummary(summary)

        setLoading(false)
      } catch (error) {
        console.error('Error loading dependencies:', error)
        setLoading(false)
      }
    }

    loadDependencies()
  }, [repoUrl])

  // Load saved data from KV
  useEffect(() => {
    if (dependencies.length === 0) return

    async function loadSavedData() {
      try {
        const response = await fetch(`/api/level3/overview/load-weights?repoUrl=${encodeURIComponent(repoUrl)}`)
        const data = await response.json()

        if (data.hasData && data.weights) {
          // Load saved adjusted weights
          setAdjustedWeights(data.weights)

          // Convert to input values (percentages)
          const savedInputs = {}
          Object.entries(data.weights).forEach(([url, weight]) => {
            savedInputs[url] = (weight * 100).toFixed(2)
          })
          setInputValues(savedInputs)

          // Mark all fields as edited since they've been saved before
          setEditedFields(new Set(Object.keys(data.weights)))

          if (data.comment) {
            setComment(data.comment)
            setShowCommentBox(true)
          }

          if (data.lastSaved) {
            setLastSaved(data.lastSaved)
          }
        }
      } catch (error) {
        console.error('Error loading saved data:', error)
      }
    }

    loadSavedData()
  }, [dependencies, repoUrl])

  // Auto-save function with debounce
  const triggerAutoSave = useCallback(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new timer (1.5s debounce)
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving')

      try {
        const response = await fetch('/api/level3/overview/save-weights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoUrl,
            adjustedWeights,
            comment
          })
        })

        if (response.ok) {
          const data = await response.json()
          setLastSaved(data.lastSaved)
          setAutoSaveStatus('saved')

          // Clear saved status after 2 seconds
          setTimeout(() => {
            setAutoSaveStatus(null)
          }, 2000)
        } else {
          setAutoSaveStatus(null)
        }
      } catch (error) {
        console.error('Auto-save error:', error)
        setAutoSaveStatus(null)
      }
    }, 1500)
  }, [repoUrl, adjustedWeights, comment])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // Handle input change (immediate display update)
  const handleInputChange = (depUrl, value) => {
    setInputValues(prev => ({
      ...prev,
      [depUrl]: value
    }))
  }

  // Handle blur or enter (recalculate and auto-save)
  const handleInputFinalize = (depUrl) => {
    const rawValue = inputValues[depUrl]

    // Parse percentage to decimal
    let numValue = parseFloat(rawValue)
    if (isNaN(numValue)) {
      numValue = 0
    }

    const decimalValue = numValue / 100

    // Update adjusted weights
    setAdjustedWeights(prev => ({
      ...prev,
      [depUrl]: decimalValue
    }))

    // Mark as edited
    setEditedFields(prev => new Set([...prev, depUrl]))

    // Format display value to 2 decimals
    setInputValues(prev => ({
      ...prev,
      [depUrl]: numValue.toFixed(2)
    }))

    // Trigger auto-save after brief delay to allow state to settle
    setTimeout(() => {
      triggerAutoSave()
    }, 50)
  }

  // Handle enter key
  const handleKeyDown = (e, depUrl) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.target.blur()
    }
  }

  // Submit to Google Sheets
  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const response = await fetch('/api/level3/overview/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          dependencies: dependencies.map(dep => ({
            url: dep.url,
            aiWeight: dep.aiWeight
          })),
          adjustedWeights,
          comment: comment.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      setSubmitSuccess(true)
      setLastSaved(data.submittedAt)

      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setSubmitSuccess(false)
      }, 5000)
    } catch (error) {
      console.error('Submit error:', error)
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate total adjusted weight
  const totalAdjusted = Object.values(adjustedWeights).reduce((sum, val) => sum + val, 0)
  const totalPercentage = (totalAdjusted * 100).toFixed(2)

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading dependencies...</div>
      </div>
    )
  }

  if (dependencies.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>No dependencies found for this repository</div>
        <button onClick={() => router.push('/level3')} style={styles.backButton}>
          ← Back to repository list
        </button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>Verdict</h1>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{user?.ensName}</span>
          </div>
        </div>
        <div style={styles.headerBottom}>
          <button onClick={() => router.push('/level3')} style={styles.backButton}>
            ← Back to repository list
          </button>
          {autoSaveStatus === 'saving' && (
            <span style={styles.autoSaveStatus}>Saving...</span>
          )}
          {autoSaveStatus === 'saved' && (
            <span style={styles.autoSaveStatusSaved}>✓ Saved</span>
          )}
          {lastSaved && !autoSaveStatus && (
            <span style={styles.lastSavedText}>
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Parent Repository Info */}
      <div style={styles.parentSection}>
        <div style={styles.parentHeader}>
          <span style={styles.parentName}>Repository: {parentName}</span>
        </div>
        {parentSummary && (
          <div style={styles.parentSummary}>
            <p style={styles.summaryText}>{parentSummary.purpose || parentSummary.description}</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={styles.instructions}>
        <h2 style={styles.instructionsTitle}>Overview Mode: Adjust Dependency Weights</h2>
        <p style={styles.instructionsText}>
          Review the AI-generated weights for each dependency below. You can adjust any weight
          by editing the percentage value. Changes are saved automatically.
        </p>
      </div>

      {/* Total Summary */}
      <div style={styles.totalSection}>
        <div style={styles.totalLabel}>Total Weight:</div>
        <div style={styles.totalValue}>{totalPercentage}%</div>
        <div style={styles.totalSubtext}>
          {Math.abs(totalAdjusted - 1.0) < 0.01
            ? '(Normalized to 100%)'
            : '(Not yet normalized - adjust weights as needed)'}
        </div>
      </div>

      {/* Dependencies Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.tableHeader}>Dependency</th>
              <th style={styles.tableHeader}>AI Weight</th>
              <th style={styles.tableHeader}>Your Weight</th>
              <th style={styles.tableHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dependencies.map((dep) => {
              const aiPercentage = (dep.aiWeight * 100).toFixed(2)
              const isEdited = editedFields.has(dep.url)
              const inputValue = inputValues[dep.url] || '0.00'

              return (
                <tr key={dep.url} style={styles.tableRow}>
                  <td style={styles.tableCell}>
                    <div style={styles.depNameCell}>
                      <span style={styles.depName}>{dep.name}</span>
                      {dep.summary && (
                        <span style={styles.depSummary}>{dep.summary}</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.tableCellCenter}>
                    <span style={styles.aiWeight}>{aiPercentage}%</span>
                  </td>
                  <td style={styles.tableCellCenter}>
                    <div style={styles.inputWrapper}>
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => handleInputChange(dep.url, e.target.value)}
                        onBlur={() => handleInputFinalize(dep.url)}
                        onKeyDown={(e) => handleKeyDown(e, dep.url)}
                        style={{
                          ...styles.input,
                          ...(isEdited ? styles.inputEdited : {})
                        }}
                        disabled={isSubmitting}
                      />
                      <span style={styles.percentSign}>%</span>
                    </div>
                  </td>
                  <td style={styles.tableCellCenter}>
                    <button
                      onClick={() => setModalOpen(dep.url)}
                      style={styles.moreButton}
                      disabled={isSubmitting}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Comment Section */}
      <div style={styles.commentContainer}>
        {!showCommentBox ? (
          <button
            onClick={() => setShowCommentBox(true)}
            style={styles.commentLink}
            disabled={isSubmitting}
          >
            Add a comment (optional)
          </button>
        ) : (
          <div style={styles.commentSection}>
            <label style={styles.commentLabel}>Comment (optional):</label>
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value)
                triggerAutoSave()
              }}
              placeholder="Add any thoughts, reasoning, or notes about these weights..."
              style={styles.commentTextarea}
              rows="4"
              disabled={isSubmitting}
            />
          </div>
        )}
      </div>

      {/* Submit Section */}
      <div style={styles.submitSection}>
        {submitSuccess && (
          <div style={styles.successMessage}>
            ✓ Weights submitted successfully!
          </div>
        )}
        {submitError && (
          <div style={styles.errorMessage}>
            Error: {submitError}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{
            ...styles.submitButton,
            ...(isSubmitting ? styles.submitButtonDisabled : {})
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit to Google Sheets'}
        </button>
        <p style={styles.submitHelp}>
          Your weights will be saved to Google Sheets. You can submit multiple times;
          each submission creates a new record.
        </p>
      </div>

      {/* Details Modal */}
      {modalOpen && (
        <DependencyModal
          depUrl={modalOpen}
          dependencies={dependencies}
          onClose={() => setModalOpen(null)}
        />
      )}
    </div>
  )
}

// Dependency Details Modal Component
function DependencyModal({ depUrl, dependencies, onClose }) {
  const dep = dependencies.find(d => d.url === depUrl)

  if (!dep) {
    return null
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{dep.name}</h3>
          <button onClick={onClose} style={styles.modalClose}>
            ✕
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.modalSection}>
            <div style={styles.modalLabel}>Repository URL:</div>
            <a
              href={dep.url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.modalLink}
            >
              {dep.url}
            </a>
          </div>

          <div style={styles.modalSection}>
            <div style={styles.modalLabel}>AI-Generated Weight:</div>
            <div style={styles.modalValue}>
              {(dep.aiWeight * 100).toFixed(2)}%
            </div>
          </div>

          {dep.summary && (
            <div style={styles.modalSection}>
              <div style={styles.modalLabel}>Summary:</div>
              <div style={styles.modalValue}>{dep.summary}</div>
            </div>
          )}

          <div style={styles.modalSection}>
            <div style={styles.modalLabel}>About Weights:</div>
            <div style={styles.modalValue}>
              Weights represent the relative value of each dependency to the parent repository.
              The AI weight is based on analysis of how the dependency is used throughout the codebase.
              You can adjust this weight based on your own assessment of the dependency's importance.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    marginBottom: '24px',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  headerBottom: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: 0,
    color: '#333',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
  },
  userName: {
    fontSize: '14px',
    color: '#666',
    fontFamily: 'monospace',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#3182ce',
    border: '1px solid #3182ce',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  autoSaveStatus: {
    fontSize: '13px',
    color: '#718096',
    fontStyle: 'italic',
  },
  autoSaveStatusSaved: {
    fontSize: '13px',
    color: '#48bb78',
    fontWeight: '500',
  },
  lastSavedText: {
    fontSize: '13px',
    color: '#718096',
  },
  parentSection: {
    maxWidth: '1200px',
    margin: '0 auto 24px auto',
    padding: '0 24px',
  },
  parentHeader: {
    marginBottom: '12px',
  },
  parentName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2d3748',
    fontFamily: 'monospace',
  },
  parentSummary: {
    padding: '16px',
    backgroundColor: '#f7fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  summaryText: {
    margin: 0,
    lineHeight: '1.6',
    color: '#2d3748',
    fontSize: '14px',
  },
  instructions: {
    maxWidth: '1200px',
    margin: '0 auto 24px auto',
    padding: '0 24px',
  },
  instructionsTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '8px',
  },
  instructionsText: {
    fontSize: '14px',
    color: '#4a5568',
    lineHeight: '1.6',
    margin: 0,
  },
  totalSection: {
    maxWidth: '1200px',
    margin: '0 auto 24px auto',
    padding: '16px 24px',
    backgroundColor: '#edf2f7',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2d3748',
  },
  totalValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#3182ce',
  },
  totalSubtext: {
    fontSize: '13px',
    color: '#718096',
    fontStyle: 'italic',
  },
  tableContainer: {
    maxWidth: '1200px',
    margin: '0 auto 24px auto',
    padding: '0 24px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    borderCollapse: 'collapse',
  },
  tableHeaderRow: {
    borderBottom: '2px solid #e2e8f0',
  },
  tableHeader: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '600',
    color: '#4a5568',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    backgroundColor: '#f7fafc',
  },
  tableRow: {
    borderBottom: '1px solid #e2e8f0',
    transition: 'background-color 0.15s ease',
  },
  tableCell: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#2d3748',
  },
  tableCellCenter: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#2d3748',
    textAlign: 'center',
  },
  depNameCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  depName: {
    fontFamily: 'monospace',
    fontWeight: '500',
    color: '#2d3748',
  },
  depSummary: {
    fontSize: '13px',
    color: '#718096',
    lineHeight: '1.4',
  },
  aiWeight: {
    fontFamily: 'monospace',
    color: '#718096',
  },
  inputWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    width: '80px',
    padding: '6px 24px 6px 8px',
    fontSize: '14px',
    fontFamily: 'monospace',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    textAlign: 'right',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
  inputEdited: {
    backgroundColor: '#fef5e7',
    borderColor: '#3182ce',
  },
  percentSign: {
    position: 'absolute',
    right: '8px',
    fontSize: '14px',
    color: '#718096',
    pointerEvents: 'none',
  },
  moreButton: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#3182ce',
    backgroundColor: 'transparent',
    border: '1px solid #3182ce',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  commentContainer: {
    maxWidth: '1200px',
    margin: '0 auto 24px auto',
    padding: '0 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  commentLink: {
    backgroundColor: 'transparent',
    color: '#718096',
    border: 'none',
    padding: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  commentSection: {
    width: '100%',
  },
  commentLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#2d3748',
    marginBottom: '8px',
  },
  commentTextarea: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #cbd5e0',
    borderRadius: '6px',
    fontFamily: 'inherit',
    resize: 'vertical',
    lineHeight: '1.5',
    outline: 'none',
  },
  submitSection: {
    maxWidth: '1200px',
    margin: '0 auto 48px auto',
    padding: '0 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  successMessage: {
    padding: '12px 20px',
    backgroundColor: '#c6f6d5',
    color: '#22543d',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
  },
  errorMessage: {
    padding: '12px 20px',
    backgroundColor: '#fed7d7',
    color: '#742a2a',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
  },
  submitButton: {
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#3182ce',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(49, 130, 206, 0.3)',
  },
  submitButtonDisabled: {
    backgroundColor: '#a0aec0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  submitHelp: {
    margin: 0,
    fontSize: '13px',
    color: '#718096',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  },
  error: {
    color: '#d32f2f',
    padding: '20px',
    textAlign: 'center',
    fontSize: '16px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2d3748',
    fontFamily: 'monospace',
    margin: 0,
  },
  modalClose: {
    fontSize: '24px',
    fontWeight: '400',
    color: '#718096',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.15s ease',
  },
  modalBody: {
    padding: '24px',
  },
  modalSection: {
    marginBottom: '20px',
  },
  modalLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#4a5568',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  modalValue: {
    fontSize: '14px',
    color: '#2d3748',
    lineHeight: '1.6',
  },
  modalLink: {
    fontSize: '14px',
    color: '#3182ce',
    textDecoration: 'none',
    wordBreak: 'break-all',
  },
}
