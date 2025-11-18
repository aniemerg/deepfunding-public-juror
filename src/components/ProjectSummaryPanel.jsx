'use client'

import { useState } from 'react'

/**
 * ProjectSummaryPanel - Collapsible panel showing AI-generated project summaries
 *
 * @param {Array} projects - Array of project objects with { repo, summary }
 * @param {string} layout - "single" or "dual" layout
 * @param {boolean} defaultExpanded - Whether to start expanded (default: false)
 */
export function ProjectSummaryPanel({ projects, layout = 'single', defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (!projects || projects.length === 0) {
    return null
  }

  // Filter out projects without summaries
  const validProjects = projects.filter(p => p && p.summary)
  if (validProjects.length === 0) {
    return null
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="project-summary-panel">
      <button
        className="summary-toggle"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Hide project summaries" : "Show project summaries"}
      >
        <span className="toggle-label">
          <span className="ai-indicator" title="AI-generated summaries">ⓘ</span>
          AI-generated project {validProjects.length > 1 ? 'summaries' : 'summary'}
        </span>
        <span className="toggle-icon">{isExpanded ? '▲' : '▼'}</span>
      </button>

      <div className={`summary-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className={`summary-layout ${layout}`}>
          {validProjects.map((project, index) => (
            <div key={project.repo || index} className="summary-item">
              <div className="summary-repo-name">{project.repo}</div>
              <div className="summary-text">{project.summary}</div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .project-summary-panel {
          margin: 1.5rem 0;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .summary-toggle {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 0.95rem;
          color: #475569;
          transition: background-color 0.2s;
        }

        .summary-toggle:hover {
          background: #f1f5f9;
        }

        .summary-toggle:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
        }

        .ai-indicator {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 50%;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: help;
        }

        .toggle-icon {
          font-size: 0.75rem;
          color: #94a3b8;
          transition: transform 0.2s;
        }

        .summary-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease-in-out;
        }

        .summary-content.expanded {
          max-height: 2000px; /* Large enough for content */
        }

        .summary-content.collapsed {
          max-height: 0;
        }

        .summary-layout {
          padding: 0 1.25rem 1.25rem 1.25rem;
        }

        .summary-layout.dual {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .summary-layout.single {
          display: block;
        }

        .summary-item {
          background: white;
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .summary-repo-name {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 0.9rem;
          font-weight: 600;
          color: #0c4a6e;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e0f2fe;
        }

        .summary-text {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #334155;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .summary-layout.dual {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .summary-toggle {
            padding: 0.875rem 1rem;
            font-size: 0.875rem;
          }

          .summary-item {
            padding: 0.875rem;
          }

          .summary-repo-name {
            font-size: 0.85rem;
          }

          .summary-text {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  )
}
