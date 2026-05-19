'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { getDependencies } from '@/lib/seedReposDataset'
import { getDependency } from '@/lib/comprehensiveDependencyDataset'

export default function OverviewScreenLevel3({
  repoUrl,
  userAddress,
  ensName,
  onBackToList
}) {
  const [dependencies, setDependencies] = useState([])
  const [adjustedWeights, setAdjustedWeights] = useState({})
  const [inputValues, setInputValues] = useState({}) // Local input state (not debounced)
  const [editedFields, setEditedFields] = useState(new Set())
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [sortBy, setSortBy] = useState('aiWeight')
  const [sortDirection, setSortDirection] = useState('desc')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [depComments, setDepComments] = useState({}) // Per-dependency comments (keyed by dep.url)
  const [expandedComments, setExpandedComments] = useState(new Set()) // Which comment boxes are open
  const [lastSaved, setLastSaved] = useState(null)

  const parentName = repoUrl.replace('https://github.com/', '')

  // Load dependencies and weights on mount
  useEffect(() => {
    async function loadData() {
      try {
        const deps = getDependencies(repoUrl)
        setDependencies(deps)

        const response = await fetch(`/api/level3/overview/load-weights?repoUrl=${encodeURIComponent(repoUrl)}`)

        if (response.ok) {
          const data = await response.json()

          if (data.adjustedWeights && Object.keys(data.adjustedWeights).length > 0) {
            setAdjustedWeights(data.adjustedWeights)
            // Initialize input values from saved weights
            const inputs = {}
            Object.keys(data.adjustedWeights).forEach(url => {
              inputs[url] = (data.adjustedWeights[url] * 100).toFixed(2)
            })
            setInputValues(inputs)

            if (data.editedFields) {
              setEditedFields(new Set(data.editedFields))
            }

            if (data.depComments) {
              setDepComments(data.depComments)
            }
          } else {
            // Initialize with AI weights
            const aiWeights = deps.reduce((acc, dep) => {
              acc[dep.url] = dep.weight
              return acc
            }, {})
            setAdjustedWeights(aiWeights)

            // Initialize input values
            const inputs = {}
            deps.forEach(dep => {
              inputs[dep.url] = (dep.weight * 100).toFixed(2)
            })
            setInputValues(inputs)
          }
        } else {
          // Initialize with AI weights
          const aiWeights = deps.reduce((acc, dep) => {
            acc[dep.url] = dep.weight
            return acc
          }, {})
          setAdjustedWeights(aiWeights)

          const inputs = {}
          deps.forEach(dep => {
            inputs[dep.url] = (dep.weight * 100).toFixed(2)
          })
          setInputValues(inputs)
        }
      } catch (error) {
        console.error('Error loading data:', error)
        const deps = getDependencies(repoUrl)
        setDependencies(deps)
        const aiWeights = deps.reduce((acc, dep) => {
          acc[dep.url] = dep.weight
          return acc
        }, {})
        setAdjustedWeights(aiWeights)

        const inputs = {}
        deps.forEach(dep => {
          inputs[dep.url] = (dep.weight * 100).toFixed(2)
        })
        setInputValues(inputs)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [repoUrl])

  // Auto-save with debounce
  useEffect(() => {
    if (loading || Object.keys(adjustedWeights).length === 0) return

    const timeoutId = setTimeout(async () => {
      await saveToKV()
    }, 1500)

    return () => clearTimeout(timeoutId)
  }, [adjustedWeights, editedFields, depComments, loading])

  async function saveToKV() {
    if (Object.keys(adjustedWeights).length === 0) return

    setSaving(true)
    try {
      await fetch('/api/level3/overview/save-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          adjustedWeights,
          editedFields: Array.from(editedFields),
          depComments
        })
      })
      setLastSaved(new Date())
    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      setSaving(false)
    }
  }

  // Handle input change (immediate, no computation)
  const handleInputChange = (depUrl, newValuePercent) => {
    // Update local input state immediately (no debounce, no computation)
    setInputValues(prev => ({
      ...prev,
      [depUrl]: newValuePercent
    }))
  }

  // Handle when user finishes editing (blur or enter)
  const handleInputComplete = (depUrl) => {
    const newValuePercent = inputValues[depUrl]
    const newWeight = parseFloat(newValuePercent) / 100

    if (!isNaN(newWeight) && newWeight >= 0) {
      handleWeightChange(depUrl, newWeight)
    }
  }

  // Weight change handler - updates only the changed field, no auto-rebalancing
  const handleWeightChange = useCallback((depUrl, newWeight) => {
    setEditedFields(prev => new Set([...prev, depUrl]))
    setAdjustedWeights(prev => ({ ...prev, [depUrl]: newWeight }))
  }, [])

  // Reset to AI weights
  const handleReset = () => {
    if (!confirm('Reset all weights to AI recommendations? This will clear all your edits.')) {
      return
    }

    const aiWeights = dependencies.reduce((acc, dep) => {
      acc[dep.url] = dep.weight
      return acc
    }, {})

    setAdjustedWeights(aiWeights)

    // Reset input values
    const inputs = {}
    dependencies.forEach(dep => {
      inputs[dep.url] = (dep.weight * 100).toFixed(2)
    })
    setInputValues(inputs)

    setEditedFields(new Set())
  }

  // Toggle row expansion
  const toggleRowExpansion = (depUrl) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(depUrl)) {
        next.delete(depUrl)
      } else {
        next.add(depUrl)
      }
      return next
    })
  }

  // Toggle comment expansion
  const toggleCommentExpansion = (depUrl) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(depUrl)) {
        next.delete(depUrl)
      } else {
        next.add(depUrl)
      }
      return next
    })
  }

  // Handle comment change
  const handleCommentChange = (depUrl, value) => {
    setDepComments(prev => ({
      ...prev,
      [depUrl]: value
    }))
    // Auto-save will trigger automatically via useEffect
  }

  // Sorting
  const sortedDependencies = useMemo(() => {
    if (dependencies.length === 0) return []

    return [...dependencies].sort((a, b) => {
      let valueA, valueB

      switch (sortBy) {
        case 'aiWeight':
          valueA = a.weight
          valueB = b.weight
          break
        case 'userWeight':
          valueA = adjustedWeights[a.url] || 0
          valueB = adjustedWeights[b.url] || 0
          break
        case 'name':
          valueA = a.fullName.toLowerCase()
          valueB = b.fullName.toLowerCase()
          break
        default:
          valueA = a.weight
          valueB = b.weight
      }

      if (sortBy === 'name') {
        return sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA)
      } else {
        return sortDirection === 'asc'
          ? valueA - valueB
          : valueB - valueA
      }
    })
  }, [dependencies, adjustedWeights, sortBy, sortDirection])

  // Validation
  const totalWeight = useMemo(() => {
    return Object.values(adjustedWeights).reduce((sum, w) => sum + w, 0)
  }, [adjustedWeights])

  // Submit handler
  const handleSubmit = async () => {

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/level3/overview/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          dependencies: dependencies.map(d => ({
            url: d.url,
            fullName: d.fullName,
            aiWeight: d.weight
          })),
          adjustedWeights,
          depComments
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit')
      }

      onBackToList()
    } catch (error) {
      console.error('Submission error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

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
        <div style={styles.error}>
          <h2>No Dependencies Found</h2>
          <p>This repository has no dependencies to evaluate.</p>
          <button onClick={onBackToList} style={styles.backButton}>
            ← Back to Repository List
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header Section */}
      <div style={styles.headerSection}>
        <div style={styles.titleRow}>
          <h2 style={styles.pageTitle}>Overview: {parentName}</h2>
          <button onClick={onBackToList} style={styles.backButton}>
            ← Back to List
          </button>
        </div>
        <p style={styles.description}>
          Review and adjust the weights for all {dependencies.length} dependencies.
          Edit weights directly to reflect your assessment of each dependency's value.
        </p>

        {/* Status Bar */}
        <div style={styles.statusBar}>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Total:</span>
            <span style={styles.statusValue}>
              {(totalWeight * 100).toFixed(2)}%
            </span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Edited:</span>
            <span style={styles.statusValue}>{editedFields.size} of {dependencies.length}</span>
          </div>
          {lastSaved && (
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}>Saved:</span>
              <span style={styles.statusValue}>
                {saving ? 'Saving...' : new Date(lastSaved).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.sortControls}>
          <label style={styles.sortLabel}>Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={styles.sortSelect}
          >
            <option value="aiWeight">AI Weight</option>
            <option value="userWeight">Your Weight</option>
            <option value="name">Name</option>
          </select>
          <button
            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            style={styles.sortDirectionButton}
          >
            {sortDirection === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>
        <button onClick={handleReset} style={styles.resetButton}>
          Reset to AI Weights
        </button>
      </div>

      {/* Dependency Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>Dependency</th>
              <th style={styles.headerCellNarrow}>AI Weight</th>
              <th style={styles.headerCellNarrow}>Your Weight</th>
            </tr>
          </thead>
          <tbody>
            {sortedDependencies.map((dep) => (
              <DependencyRow
                key={dep.url}
                dep={dep}
                repoUrl={repoUrl}
                aiWeight={dep.weight}
                userWeight={adjustedWeights[dep.url] || 0}
                inputValue={inputValues[dep.url] || '0'}
                isEdited={editedFields.has(dep.url)}
                isExpanded={expandedRows.has(dep.url)}
                onInputChange={handleInputChange}
                onInputComplete={handleInputComplete}
                onToggleExpand={toggleRowExpansion}
                depComment={depComments[dep.url]}
                isCommentExpanded={expandedComments.has(dep.url)}
                onToggleComment={toggleCommentExpansion}
                onCommentChange={handleCommentChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit Section */}
      <div style={styles.submitSection}>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={!isSubmitting ? styles.submitButton : styles.submitButtonDisabled}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
        </button>
      </div>
    </div>
  )
}

// Dependency Row Component
function DependencyRow({
  dep,
  repoUrl,
  aiWeight,
  userWeight,
  inputValue,
  isEdited,
  isExpanded,
  onInputChange,
  onInputComplete,
  onToggleExpand,
  depComment,
  isCommentExpanded,
  onToggleComment,
  onCommentChange
}) {
  const depData = getDependency(repoUrl, dep.url)
  const summary = depData?.summary || 'No summary available'
  const difference = ((userWeight - aiWeight) / aiWeight * 100).toFixed(1)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur() // Trigger blur which will call onInputComplete
    }
  }

  return (
    <>
      <tr style={styles.row}>
        <td style={styles.cellName}>
          <div style={styles.nameContainer}>
            <button
              onClick={() => onToggleExpand(dep.url)}
              style={styles.expandButton}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
            <div style={styles.nameContent}>
              <div style={styles.depName}>{dep.fullName}</div>
              <div style={styles.depSummary}>{summary}</div>
            </div>
          </div>
        </td>
        <td style={styles.cellWeight}>
          {(aiWeight * 100).toFixed(2)}%
        </td>
        <td style={styles.cellWeightInput}>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={inputValue}
            onChange={(e) => onInputChange(dep.url, e.target.value)}
            onBlur={() => onInputComplete(dep.url)}
            onKeyDown={handleKeyDown}
            style={isEdited ? styles.weightInputEdited : styles.weightInput}
          />
          {isEdited && Math.abs(parseFloat(difference)) > 0.1 && (
            <span style={parseFloat(difference) > 0 ? styles.differencePositive : styles.differenceNegative}>
              {parseFloat(difference) > 0 ? '+' : ''}{difference}%
            </span>
          )}
          <div style={styles.commentLinkContainer}>
            <button
              onClick={() => onToggleComment(dep.url)}
              style={styles.commentLink}
            >
              {depComment ? '✓ comment (edit)' : '+ comment'}
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr style={styles.detailsRow}>
          <td colSpan="3" style={styles.detailsCell}>
            <DependencyDetails dep={dep} depData={depData} />
          </td>
        </tr>
      )}
      {isCommentExpanded && (
        <tr style={styles.commentRow}>
          <td colSpan="3" style={styles.commentCell}>
            <textarea
              value={depComment || ''}
              onChange={(e) => onCommentChange(dep.url, e.target.value)}
              placeholder="Add notes about this dependency..."
              style={styles.commentTextarea}
              rows="3"
            />
          </td>
        </tr>
      )}
    </>
  )
}

// Dependency Details Component
function DependencyDetails({ dep, depData }) {
  if (!depData) {
    return <div style={styles.detailsContent}>No additional information available.</div>
  }

  const usageSummary = depData.usage_summary

  return (
    <div style={styles.detailsContent}>
      {/* Description */}
      <div style={styles.detailSection}>
        <strong>Description:</strong>
        <p style={styles.descriptionText}>{depData.description || 'No description available'}</p>
      </div>

      {/* Repository Link */}
      <div style={styles.detailSection}>
        <strong>Repository:</strong>{' '}
        <a href={dep.url} target="_blank" rel="noopener noreferrer" style={styles.link}>
          {dep.url}
        </a>
      </div>

      {/* Usage Details (same as ComparisonScreen) */}
      {usageSummary && <DepDetails usageSummary={usageSummary} />}
    </div>
  )
}

// DepDetails component (matching ComparisonScreenLevel3)
function DepDetails({ usageSummary }) {
  if (!usageSummary) return null

  const contexts = []
  if (usageSummary.appears_in_runtime_code) contexts.push('Runtime code')
  if (usageSummary.appears_in_test_code) contexts.push('Test code')
  if (usageSummary.appears_in_build_or_docs) contexts.push('Build/Docs')

  return (
    <div style={styles.usageDetailsSection}>
      {/* Usage Class */}
      {usageSummary.usage_class && (
        <div style={styles.detailBlock}>
          <div style={styles.detailLabel}>Usage Classification:</div>
          <div style={styles.detailValue}>{usageSummary.usage_class}</div>
        </div>
      )}

      {/* Inclusion Type */}
      {usageSummary.inclusion_type && (
        <div style={styles.detailBlock}>
          <div style={styles.detailLabel}>Inclusion:</div>
          <div style={styles.detailValue}>
            {usageSummary.inclusion_type === 'direct' ? 'Direct dependency' : 'Transitive dependency'}
          </div>
        </div>
      )}

      {/* Contexts */}
      {contexts.length > 0 && (
        <div style={styles.detailBlock}>
          <div style={styles.detailLabel}>Used in:</div>
          <div style={styles.detailValue}>{contexts.join(', ')}</div>
        </div>
      )}

      {/* Usage Roles */}
      {usageSummary.usage_roles && usageSummary.usage_roles.length > 0 && (
        <div style={styles.detailBlock}>
          <div style={styles.detailLabel}>Usage Roles:</div>
          <div style={styles.rolesList}>
            {usageSummary.usage_roles.map((role, i) => (
              <div key={i} style={styles.roleItem}>
                <div style={styles.roleName}>{role.role_name}</div>
                <div style={styles.roleDescription}>{role.description}</div>
                {role.how_dependency_is_used && (
                  <div style={styles.roleHow}>{role.how_dependency_is_used}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Responsibilities Provided */}
      {usageSummary.responsibilities_provided_by_dependency &&
       usageSummary.responsibilities_provided_by_dependency.length > 0 && (
        <div style={styles.detailBlock}>
          <div style={styles.detailLabel}>Responsibilities provided by dependency:</div>
          <ul style={styles.bulletList}>
            {usageSummary.responsibilities_provided_by_dependency.map((resp, i) => (
              <li key={i} style={styles.bulletItem}>{resp}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Responsibilities Left to Parent */}
      {usageSummary.responsibilities_left_to_parent &&
       usageSummary.responsibilities_left_to_parent.length > 0 && (
        <div style={styles.detailBlock}>
          <div style={styles.detailLabel}>Responsibilities left to parent:</div>
          <ul style={styles.bulletList}>
            {usageSummary.responsibilities_left_to_parent.map((resp, i) => (
              <li key={i} style={styles.bulletItem}>{resp}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Styles
const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px',
    color: '#666',
  },
  error: {
    textAlign: 'center',
    padding: '40px',
  },
  headerSection: {
    marginBottom: '24px',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#2d3748',
    margin: 0,
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#3182ce',
    border: '1px solid #3182ce',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  description: {
    fontSize: '16px',
    color: '#4a5568',
    lineHeight: '1.5',
    marginBottom: '16px',
  },
  statusBar: {
    display: 'flex',
    gap: '24px',
    padding: '12px 16px',
    backgroundColor: '#edf2f7',
    borderRadius: '6px',
    flexWrap: 'wrap',
  },
  statusItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: '14px',
    color: '#4a5568',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: '14px',
    color: '#2d3748',
    fontWeight: '600',
  },
  statusValueValid: {
    fontSize: '14px',
    color: '#38a169',
    fontWeight: '600',
  },
  statusValueInvalid: {
    fontSize: '14px',
    color: '#e53e3e',
    fontWeight: '600',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    flexWrap: 'wrap',
    gap: '12px',
  },
  sortControls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: '14px',
    color: '#4a5568',
    fontWeight: '500',
  },
  sortSelect: {
    padding: '6px 12px',
    fontSize: '14px',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  sortDirectionButton: {
    padding: '6px 12px',
    fontSize: '14px',
    backgroundColor: 'white',
    color: '#4a5568',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  resetButton: {
    padding: '6px 12px',
    fontSize: '14px',
    backgroundColor: '#fc8181',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    overflowX: 'auto',
    overflowY: 'hidden',
    marginBottom: '24px',
    WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
  },
  table: {
    width: '100%',
    minWidth: '600px', // Prevent column squashing on mobile
    borderCollapse: 'collapse',
  },
  headerRow: {
    backgroundColor: '#f7fafc',
    borderBottom: '2px solid #e2e8f0',
  },
  headerCell: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#2d3748',
    minWidth: '200px',
  },
  headerCellNarrow: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#2d3748',
    width: '120px',
    minWidth: '120px',
  },
  row: {
    borderBottom: '1px solid #e2e8f0',
  },
  cellName: {
    padding: '12px 16px',
    minWidth: '200px',
  },
  nameContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  expandButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#4a5568',
    flexShrink: 0,
  },
  nameContent: {
    flex: 1,
  },
  depName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2d3748',
    fontFamily: 'monospace',
    marginBottom: '4px',
  },
  depSummary: {
    fontSize: '13px',
    color: '#718096',
    lineHeight: '1.4',
  },
  cellWeight: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#4a5568',
    verticalAlign: 'top',
    width: '120px',
    minWidth: '120px',
  },
  cellWeightInput: {
    padding: '12px 16px',
    verticalAlign: 'top',
    width: '120px',
    minWidth: '120px',
  },
  weightInput: {
    width: '100px',
    padding: '6px 8px',
    fontSize: '14px',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    textAlign: 'right',
  },
  weightInputEdited: {
    width: '100px',
    padding: '6px 8px',
    fontSize: '14px',
    border: '2px solid #4299e1',
    borderRadius: '4px',
    textAlign: 'right',
    backgroundColor: '#ebf8ff',
  },
  differencePositive: {
    marginLeft: '8px',
    fontSize: '12px',
    color: '#38a169',
    fontWeight: '600',
  },
  differenceNegative: {
    marginLeft: '8px',
    fontSize: '12px',
    color: '#e53e3e',
    fontWeight: '600',
  },
  detailsRow: {
    backgroundColor: '#f7fafc',
  },
  detailsCell: {
    padding: '16px',
  },
  detailsContent: {
    fontSize: '14px',
    color: '#4a5568',
    lineHeight: '1.6',
  },
  detailSection: {
    marginBottom: '16px',
  },
  descriptionText: {
    marginTop: '8px',
    marginBottom: '0',
  },
  link: {
    color: '#3182ce',
    textDecoration: 'none',
  },
  usageDetailsSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0',
  },
  detailBlock: {
    marginBottom: '16px',
  },
  detailLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '6px',
  },
  detailValue: {
    fontSize: '13px',
    color: '#4a5568',
  },
  rolesList: {
    marginTop: '8px',
  },
  roleItem: {
    marginBottom: '12px',
    paddingLeft: '12px',
    borderLeft: '3px solid #e2e8f0',
  },
  roleName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '4px',
  },
  roleDescription: {
    fontSize: '13px',
    color: '#4a5568',
    marginBottom: '4px',
  },
  roleHow: {
    fontSize: '12px',
    color: '#718096',
    fontStyle: 'italic',
  },
  bulletList: {
    marginTop: '8px',
    marginBottom: '0',
    paddingLeft: '20px',
  },
  bulletItem: {
    fontSize: '13px',
    color: '#4a5568',
    marginBottom: '4px',
  },
  commentSection: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  commentLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#2d3748',
  },
  commentTextarea: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  submitSection: {
    textAlign: 'center',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  validationWarning: {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#fff5f5',
    color: '#c53030',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
  },
  submitButton: {
    padding: '12px 32px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#48bb78',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  submitButtonDisabled: {
    padding: '12px 32px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#cbd5e0',
    color: '#a0aec0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'not-allowed',
  },
  commentLinkContainer: {
    marginTop: '4px',
  },
  commentLink: {
    fontSize: '12px',
    color: '#718096',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 0',
    textDecoration: 'none',
  },
  commentRow: {
    backgroundColor: '#f7fafc',
  },
  commentCell: {
    padding: '12px 16px',
  },
}
