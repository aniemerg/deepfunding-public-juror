'use client'
import { useState } from 'react'
import { getDependency, getRepositorySummary, getDependencyDetails } from '@/lib/comprehensiveDependencyDataset'

export default function ComparisonScreenLevel3({
  repoUrl,
  comparison,
  comparisonIndex,
  totalComparisons,
  onSubmit,
  isSubmitting
}) {
  const [parentSummaryOpen, setParentSummaryOpen] = useState(false)
  const [depADetailsOpen, setDepADetailsOpen] = useState(false)
  const [depBDetailsOpen, setDepBDetailsOpen] = useState(false)

  // Get data
  const parentSummary = getRepositorySummary(repoUrl)
  const depA = getDependency(repoUrl, comparison.depA)
  const depB = getDependency(repoUrl, comparison.depB)

  const parentName = repoUrl.replace('https://github.com/', '')
  const multiplierText = comparison.multiplier.toLocaleString('en-US', { maximumFractionDigits: 1 })

  const handleAnswer = (agrees) => {
    onSubmit({
      comparisonIndex,
      depA: comparison.depA,
      depB: comparison.depB,
      multiplier: comparison.multiplier,
      userAgrees: agrees
    })
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

      {/* Question */}
      <div style={styles.questionSection}>
        <h2 style={styles.question}>
          Is <span style={styles.highlight}>{depA.name}</span> {multiplierText}× more valuable to{' '}
          {parentName} than <span style={styles.highlight}>{depB.name}</span>?
        </h2>
      </div>

      {/* Dependency A Card */}
      <div style={styles.depCard}>
        <div style={styles.depHeader} onClick={() => setDepADetailsOpen(!depADetailsOpen)}>
          <span style={styles.depName}>{depA.name}</span>
          <span style={styles.expandIcon}>{depADetailsOpen ? '▼' : '▶'} Show details</span>
        </div>
        {depADetailsOpen && (
          <div style={styles.depDetails}>
            <p style={styles.depDescription}>{depA.description}</p>
            {depA.usage_summary && (
              <DepDetails usageSummary={depA.usage_summary} />
            )}
          </div>
        )}
      </div>

      {/* Dependency B Card */}
      <div style={styles.depCard}>
        <div style={styles.depHeader} onClick={() => setDepBDetailsOpen(!depBDetailsOpen)}>
          <span style={styles.depName}>{depB.name}</span>
          <span style={styles.expandIcon}>{depBDetailsOpen ? '▼' : '▶'} Show details</span>
        </div>
        {depBDetailsOpen && (
          <div style={styles.depDetails}>
            <p style={styles.depDescription}>{depB.description}</p>
            {depB.usage_summary && (
              <DepDetails usageSummary={depB.usage_summary} />
            )}
          </div>
        )}
      </div>

      {/* Answer Buttons */}
      <div style={styles.buttonSection}>
        <button
          onClick={() => handleAnswer(true)}
          disabled={isSubmitting}
          style={{...styles.button, ...styles.buttonYes}}
        >
          Yes, {depA.name} is {multiplierText}× or more
        </button>
        <button
          onClick={() => handleAnswer(false)}
          disabled={isSubmitting}
          style={{...styles.button, ...styles.buttonNo}}
        >
          No, {depA.name} is less than {multiplierText}×
        </button>
      </div>

      {/* Progress */}
      <div style={styles.progress}>
        Progress: {comparisonIndex + 1} / {totalComparisons} comparisons
      </div>
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
    maxWidth: '800px',
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
  expandIcon: {
    fontSize: '14px',
    color: '#718096',
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
  depCard: {
    marginBottom: '16px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: 'white',
  },
  depHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    cursor: 'pointer',
  },
  depName: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#2d3748',
    fontFamily: 'monospace',
  },
  depDetails: {
    padding: '0 20px 16px 20px',
    borderTop: '1px solid #f7fafc',
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
  buttonSection: {
    marginTop: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  button: {
    padding: '16px 24px',
    fontSize: '16px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  buttonYes: {
    backgroundColor: '#48bb78',
    color: 'white',
  },
  buttonNo: {
    backgroundColor: '#f56565',
    color: 'white',
  },
  progress: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#718096',
  },
}
