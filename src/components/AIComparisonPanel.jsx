'use client'

import { useState, useEffect } from 'react'
import { formatRepoName } from '@/lib/eloHelpers'

/**
 * AIComparisonPanel - Shows AI model comparison recommendations
 *
 * Displays AI-generated comparison analysis for a repo pair.
 * Each model gets a row showing winner and multiplier.
 * Reasoning is expandable per model.
 *
 * @param {string} repoA - First repository name
 * @param {string} repoB - Second repository name
 */
export function AIComparisonPanel({ repoA, repoB }) {
  const [comparisons, setComparisons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedModels, setExpandedModels] = useState(new Set())

  useEffect(() => {
    if (!repoA || !repoB) return

    const fetchComparisons = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/comparison-analysis?repo_a=${encodeURIComponent(repoA)}&repo_b=${encodeURIComponent(repoB)}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch comparison analysis')
        }

        const data = await response.json()
        setComparisons(Array.isArray(data) ? data : [data])
      } catch (err) {
        console.error('Error fetching AI comparisons:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchComparisons()
  }, [repoA, repoB])

  const toggleReasoning = (modelName) => {
    setExpandedModels(prev => {
      const next = new Set(prev)
      if (next.has(modelName)) {
        next.delete(modelName)
      } else {
        next.add(modelName)
      }
      return next
    })
  }

  // Don't render if no comparisons or still loading
  if (loading || comparisons.length === 0) {
    return null
  }

  if (error) {
    return null // Silently hide on error
  }

  return (
    <div className="ai-comparison-panel">
      <div className="panel-header">
        <span className="header-label">
          <span className="ai-indicator" title="AI-generated comparison suggestions">🤖</span>
          AI Comparison Suggestions
        </span>
      </div>

      <div className="comparisons-list">
        {comparisons.map((comparison) => {
          const isExpanded = expandedModels.has(comparison.model)

          return (
            <div key={comparison.model} className="model-row">
              <div className="row-summary">
                <div className="model-info">
                  <span className="model-name">{comparison.model}</span>
                  <span className="model-choice">
                    suggests:{' '}
                    <strong className="winner-name">
                      {formatRepoName(comparison.winner)}
                    </strong>
                  </span>
                </div>
                <div className="row-actions">
                  <span className="multiplier-badge">
                    {comparison.multiplier}x
                  </span>
                  <button
                    className="expand-button"
                    onClick={() => toggleReasoning(comparison.model)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Hide reasoning' : 'Show reasoning'}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="reasoning-content">
                  <div className="reasoning-label">Reasoning:</div>
                  <div className="reasoning-text">{comparison.final_reasoning}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .ai-comparison-panel {
          margin: 1.5rem 0;
          background: #fefce8;
          border: 1px solid #fbbf24;
          border-radius: 8px;
          overflow: hidden;
        }

        .panel-header {
          padding: 1rem 1.25rem;
          background: #fef3c7;
          border-bottom: 1px solid #fbbf24;
        }

        .header-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 0.95rem;
          color: #92400e;
        }

        .ai-indicator {
          font-size: 1.1rem;
        }

        .comparisons-list {
          display: flex;
          flex-direction: column;
        }

        .model-row {
          border-bottom: 1px solid #fde68a;
          background: white;
        }

        .model-row:last-child {
          border-bottom: none;
        }

        .row-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .row-summary:hover {
          background: #fffbeb;
        }

        .model-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }

        .model-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .model-choice {
          font-size: 0.9rem;
          color: #78716c;
        }

        .winner-name {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          color: #1d4ed8;
          font-weight: 600;
        }

        .row-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .multiplier-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 60px;
          padding: 0.375rem 0.75rem;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #1e40af;
          font-weight: 700;
          font-size: 1rem;
          border-radius: 6px;
          border: 2px solid #3b82f6;
        }

        .expand-button {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.5rem;
          transition: color 0.2s;
        }

        .expand-button:hover {
          color: #475569;
        }

        .expand-button:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 4px;
        }

        .reasoning-content {
          padding: 0 1.25rem 1.25rem 1.25rem;
          background: #fffbeb;
          border-top: 1px solid #fde68a;
        }

        .reasoning-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #92400e;
          margin-bottom: 0.5rem;
        }

        .reasoning-text {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #44403c;
          white-space: pre-wrap;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .row-summary {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
            padding: 0.875rem 1rem;
          }

          .model-info {
            width: 100%;
          }

          .row-actions {
            width: 100%;
            justify-content: space-between;
          }

          .multiplier-badge {
            font-size: 0.9rem;
            min-width: 50px;
          }

          .reasoning-content {
            padding: 0 1rem 1rem 1rem;
          }

          .reasoning-text {
            font-size: 0.85rem;
          }
        }

        @media (max-width: 640px) {
          .panel-header {
            padding: 0.875rem 1rem;
          }

          .header-label {
            font-size: 0.875rem;
          }

          .model-name {
            font-size: 0.75rem;
          }

          .model-choice {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  )
}
