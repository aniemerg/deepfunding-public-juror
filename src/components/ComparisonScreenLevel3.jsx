'use client'
import { useState } from 'react'
import { getDependency, getRepositorySummary, getDependencyDetails } from '@/lib/comprehensiveDependencyDataset'

export default function ComparisonScreenLevel3({
  repoUrl,
  comparison,
  comparisonIndex,
  totalComparisons,
  onSubmit,
  isSubmitting,
  isCompleted
}) {
  const [parentSummaryOpen, setParentSummaryOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(null) // 'depA' or 'depB' or null
  const [wasSkipped, setWasSkipped] = useState(false)
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null)
  const [showCommentBox, setShowCommentBox] = useState(false)
  const [comment, setComment] = useState('')

  // Get data
  const parentSummary = getRepositorySummary(repoUrl)
  const depA = getDependency(repoUrl, comparison.depA)
  const depB = getDependency(repoUrl, comparison.depB)

  const parentName = repoUrl.replace('https://github.com/', '')
  const multiplierText = comparison.multiplier.toLocaleString('en-US', { maximumFractionDigits: 1 })

  const handleAnswer = async (agrees) => {
    setWasSkipped(false)
    setLastSubmittedAt(new Date().toISOString())

    await onSubmit({
      comparisonIndex,
      depA: comparison.depA,
      depB: comparison.depB,
      multiplier: comparison.multiplier,
      userAgrees: agrees,
      wasSkipped: false,
      comment: comment.trim() || null
    })

    // Auto-dismiss success message
    setTimeout(() => {
      setLastSubmittedAt(null)
    }, 3000)
  }

  const handleSkip = async () => {
    setWasSkipped(true)
    setLastSubmittedAt(new Date().toISOString())

    await onSubmit({
      comparisonIndex,
      depA: comparison.depA,
      depB: comparison.depB,
      multiplier: comparison.multiplier,
      userAgrees: null,
      wasSkipped: true
    })

    // Auto-dismiss success message
    setTimeout(() => {
      setLastSubmittedAt(null)
    }, 3000)
  }

  if (!depA || !depB) {
    return <div style={styles.error}>Error loading dependency data</div>
  }

  return (
    <div style={styles.container}>
      {/* Parent Repository Context */}
      <div style={styles.parentSection}>
        <div style={styles.parentHeader} onClick={() => setParentSummaryOpen(!parentSummaryOpen)}>
          <span style={styles.parentName}>Evaluating: {parentName}</span>
          <span style={styles.expandIcon}>{parentSummaryOpen ? '▼' : '▶'}</span>
        </div>
        {parentSummaryOpen && parentSummary && (
          <div style={styles.parentSummary}>
            <p style={styles.summaryText}>{parentSummary.purpose}</p>
            {parentSummary.key_capabilities && parentSummary.key_capabilities.length > 0 && (
              <div style={styles.capabilities}>
                <strong>Key Capabilities:</strong>
                <ul style={styles.capabilitiesList}>
                  {parentSummary.key_capabilities.map((cap, i) => (
                    <li key={i}>{cap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statement */}
      <div style={styles.questionSection}>
        <h2 style={styles.question}>
          <span style={styles.highlight}>{depA.name}</span> is {multiplierText}× more valuable than{' '}
          <span style={styles.highlight}>{depB.name}</span>
        </h2>
      </div>

      {/* Dependency Cards Container */}
      <div className="depCardsContainer" style={styles.depCardsContainer}>
        {/* Dependency A Card */}
        <div style={styles.depCard}>
          <div style={styles.depHeaderContent}>
            <span style={styles.depName}>{depA.name}</span>
            {depA.summary && (
              <p style={styles.depSummary}>{depA.summary}</p>
            )}
          </div>
          <button
            onClick={() => setModalOpen('depA')}
            style={styles.moreButton}
          >
            + More
          </button>
        </div>

        {/* Dependency B Card */}
        <div style={styles.depCard}>
          <div style={styles.depHeaderContent}>
            <span style={styles.depName}>{depB.name}</span>
            {depB.summary && (
              <p style={styles.depSummary}>{depB.summary}</p>
            )}
          </div>
          <button
            onClick={() => setModalOpen('depB')}
            style={styles.moreButton}
          >
            + More
          </button>
        </div>
      </div>

      {/* Details Modal */}
      {modalOpen && (
        <div style={styles.modalOverlay} onClick={() => setModalOpen(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {modalOpen === 'depA' ? depA.name : depB.name}
              </h3>
              <button
                onClick={() => setModalOpen(null)}
                style={styles.modalClose}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.depDescription}>
                {modalOpen === 'depA' ? depA.description : depB.description}
              </p>
              {(modalOpen === 'depA' ? depA.usage_summary : depB.usage_summary) && (
                <DepDetails usageSummary={modalOpen === 'depA' ? depA.usage_summary : depB.usage_summary} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submission Status */}
      {lastSubmittedAt && (
        <div style={styles.submissionStatus}>
          ✓ {wasSkipped ? 'Skipped' : 'Comparison recorded'}
        </div>
      )}

      {/* Comment Section */}
      <div style={styles.commentContainer}>
        {!showCommentBox ? (
          <button
            onClick={() => setShowCommentBox(true)}
            style={styles.commentLink}
            disabled={isSubmitting}
          >
            Leave a comment (optional)
          </button>
        ) : (
          <div style={styles.commentSection}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add any thoughts or reasoning about this comparison..."
              style={styles.commentTextarea}
              rows="3"
              disabled={isSubmitting}
            />
          </div>
        )}
      </div>

      {/* Answer Buttons */}
      <div style={styles.buttonSection}>
        <div className="answerButtons" style={styles.answerButtons}>
          <button
            onClick={() => handleAnswer(true)}
            disabled={isSubmitting}
            style={{...styles.button, ...styles.buttonYes}}
          >
            <span style={styles.buttonIcon}>▲</span>
            <span style={styles.buttonText}>{depA.name} is {multiplierText}× or more</span>
          </button>
          <button
            onClick={() => handleAnswer(false)}
            disabled={isSubmitting}
            style={{...styles.button, ...styles.buttonNo}}
          >
            <span style={styles.buttonIcon}>▼</span>
            <span style={styles.buttonText}>{depA.name} is less than {multiplierText}×</span>
          </button>
        </div>

        {!isCompleted && (
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            style={{...styles.button, ...styles.buttonSkip}}
          >
            Skip this comparison
          </button>
        )}
      </div>

      {/* Progress */}
      <div style={styles.progress}>
        Progress: {comparisonIndex + 1} / {totalComparisons} comparisons
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .answerButtons {
            flex-direction: column !important;
          }
          .depCardsContainer {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  )
}

function DepDetails({ usageSummary }) {
  if (!usageSummary) return null

  const contexts = []
  if (usageSummary.appears_in_runtime_code) contexts.push('Runtime code')
  if (usageSummary.appears_in_test_code) contexts.push('Test code')
  if (usageSummary.appears_in_build_or_docs) contexts.push('Build/Docs')

  return (
    <div style={styles.detailsSection}>
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

      {/* Notes */}
      {usageSummary.notes && usageSummary.notes.length > 0 && (
        <div style={styles.detailBlock}>
          <div style={styles.detailLabel}>Notes:</div>
          <ul style={styles.bulletList}>
            {usageSummary.notes.map((note, i) => (
              <li key={i} style={styles.bulletItem}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  },
  error: {
    color: '#d32f2f',
    padding: '20px',
    textAlign: 'center',
  },
  parentSection: {
    marginBottom: '24px',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '16px',
  },
  parentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '12px 0',
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
    marginTop: '8px',
  },
  summaryText: {
    margin: '0 0 12px 0',
    lineHeight: '1.6',
    color: '#2d3748',
  },
  capabilities: {
    marginTop: '12px',
  },
  capabilitiesList: {
    marginTop: '8px',
    paddingLeft: '20px',
  },
  questionSection: {
    marginBottom: '32px',
    textAlign: 'center',
  },
  question: {
    fontSize: '20px',
    fontWeight: '500',
    lineHeight: '1.5',
    color: '#2d3748',
  },
  highlight: {
    color: '#3182ce',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  depCardsContainer: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
  },
  depCard: {
    flex: 1,
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: 'white',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  depHeaderContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginBottom: '16px',
  },
  depName: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2d3748',
    fontFamily: 'monospace',
    marginBottom: '8px',
    display: 'block',
    textAlign: 'center',
  },
  depSummary: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#4a5568',
    margin: '8px 0 0 0',
    textAlign: 'center',
  },
  moreButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#3182ce',
    backgroundColor: 'transparent',
    border: '1px solid #3182ce',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
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
    maxWidth: '700px',
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
    fontSize: '20px',
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
  depDescription: {
    marginTop: '12px',
    lineHeight: '1.6',
    color: '#4a5568',
    fontSize: '14px',
  },
  detailsSection: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#f7fafc',
    borderRadius: '6px',
    fontSize: '14px',
  },
  detailBlock: {
    marginBottom: '16px',
  },
  detailLabel: {
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '6px',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  detailValue: {
    color: '#4a5568',
    lineHeight: '1.5',
  },
  rolesList: {
    marginTop: '8px',
  },
  roleItem: {
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e2e8f0',
  },
  roleName: {
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '4px',
  },
  roleDescription: {
    color: '#4a5568',
    marginBottom: '4px',
    lineHeight: '1.5',
  },
  roleHow: {
    color: '#718096',
    fontSize: '13px',
    fontStyle: 'italic',
    lineHeight: '1.5',
  },
  bulletList: {
    marginTop: '8px',
    paddingLeft: '20px',
    listStyleType: 'disc',
  },
  bulletItem: {
    color: '#4a5568',
    marginBottom: '6px',
    lineHeight: '1.5',
  },
  submissionStatus: {
    marginTop: '24px',
    padding: '12px 16px',
    backgroundColor: '#c6f6d5',
    color: '#22543d',
    borderRadius: '6px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '500',
  },
  buttonSection: {
    marginTop: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
  },
  answerButtons: {
    display: 'flex',
    gap: '16px',
    width: '100%',
    maxWidth: '700px',
    justifyContent: 'center',
  },
  button: {
    padding: '20px 32px',
    fontSize: '16px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    minHeight: '80px',
    flex: 1,
    maxWidth: '320px',
  },
  buttonIcon: {
    fontSize: '32px',
    fontWeight: 'bold',
    lineHeight: '1',
  },
  buttonText: {
    fontSize: '16px',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: '1.4',
    marginTop: '8px',
  },
  buttonYes: {
    backgroundColor: '#48bb78',
    color: 'white',
  },
  buttonNo: {
    backgroundColor: '#f56565',
    color: 'white',
  },
  buttonSkip: {
    backgroundColor: '#f7fafc',
    color: '#4a5568',
    border: '1px solid #cbd5e0',
    padding: '12px 24px',
    minHeight: 'auto',
    maxWidth: '240px',
  },
  commentContainer: {
    marginTop: '24px',
    marginBottom: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
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
    maxWidth: '700px',
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
  },
  progress: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#718096',
  },
}
