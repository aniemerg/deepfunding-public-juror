'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function NavigationSidebar({
  navigationItems,
  currentScreen,
  onNavigate,
  isMobileMenuOpen = false,
  onCloseMobileMenu = () => {},
  showLevel3Link = false
}) {
  const [itemWidths, setItemWidths] = useState({})
  const sidebarRef = useRef()
  const router = useRouter()

  // Measure available width for each navigation item
  useEffect(() => {
    const measureWidths = () => {
      if (!sidebarRef.current) return
      
      const sidebarWidth = sidebarRef.current.clientWidth
      const availableWidth = sidebarWidth - 48 // Account for padding and icons
      
      setItemWidths(prev => ({
        ...prev,
        available: availableWidth
      }))
    }

    measureWidths()
    window.addEventListener('resize', measureWidths)
    return () => window.removeEventListener('resize', measureWidths)
  }, [navigationItems])

  const truncateText = (text, availableWidth) => {
    if (!availableWidth) return text
    
    // Rough character width estimation (this could be more precise)
    const charWidth = 8
    const maxChars = Math.floor(availableWidth / charWidth)
    
    if (text.length <= maxChars) return text
    
    // Truncation hierarchy for different text types
    if (text.startsWith('Comparison:')) {
      const match = text.match(/Comparison: (.+) vs (.+)/)
      if (match) {
        const [, projectA, projectB] = match
        
        if (maxChars >= 50) {
          // Full version
          return text
        } else if (maxChars >= 30) {
          // Medium: strip org names
          const nameA = projectA.split('/')[1] || projectA
          const nameB = projectB.split('/')[1] || projectB
          return `Comparison: ${nameA} vs ${nameB}`
        } else if (maxChars >= 20) {
          // Short version
          const nameA = (projectA.split('/')[1] || projectA).substring(0, 8)
          const nameB = (projectB.split('/')[1] || projectB).substring(0, 8)
          return `Comp: ${nameA} vs ${nameB}`
        } else {
          // Tiny version
          const nameA = (projectA.split('/')[1] || projectA).substring(0, 4)
          const nameB = (projectB.split('/')[1] || projectB).substring(0, 4)
          return `C: ${nameA} vs ${nameB}`
        }
      }
    } else if (text.startsWith('Similar:')) {
      const match = text.match(/Similar: (.+)/)
      if (match) {
        const [, project] = match
        
        if (maxChars >= 40) {
          // Full version
          return text
        } else if (maxChars >= 25) {
          // Medium: strip org name
          const name = project.split('/')[1] || project
          return `Similar: ${name}`
        } else if (maxChars >= 15) {
          // Short version
          const name = (project.split('/')[1] || project).substring(0, 8)
          return `Sim: ${name}`
        } else {
          // Tiny version
          const name = (project.split('/')[1] || project).substring(0, 6)
          return `S: ${name}`
        }
      }
    }
    
    // Fallback: simple truncation
    if (maxChars <= 10) {
      return text.substring(0, maxChars - 3) + '...'
    }
    return text.substring(0, maxChars)
  }

  const getStatusIcon = (item) => {
    switch (item.status) {
      case 'completed':
        return '✓'
      case 'current':
        return '→'
      case 'in-progress':
        return '○'
      case 'skipped':
        return '⊘'
      default:
        return ''
    }
  }

  const getStatusColor = (item) => {
    switch (item.status) {
      case 'completed':
        return '#22543d' // Green
      case 'current':
        return '#1e40af' // Blue
      case 'in-progress':
        return '#7c3aed' // Purple
      case 'skipped':
        return '#d69e2e' // Orange
      default:
        return '#718096' // Gray
    }
  }

  const isClickable = (item) => {
    // Can click completed items, skipped items, current item, or in-progress items
    return item.status === 'completed' || item.status === 'skipped' || item.status === 'current' || item.status === 'in-progress'
  }

  const handleItemClick = (itemId) => {
    if (isClickable(navigationItems.find(item => item.id === itemId))) {
      onNavigate(itemId)
      onCloseMobileMenu() // Close menu after navigation on mobile
    }
  }

  return (
    <>
      {/* Backdrop for mobile overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-backdrop" onClick={onCloseMobileMenu} />
      )}

      <div className={`navigation-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`} ref={sidebarRef}>
        <div className="sidebar-header">
          <h3>Evaluation Progress</h3>
          <button className="close-button" onClick={onCloseMobileMenu}>
            ✕
          </button>
        </div>

        <div className="navigation-list">
          {navigationItems.map((item, index) => {
            const truncatedText = truncateText(item.text, itemWidths.available)
            const clickable = isClickable(item)

            return (
              <button
                key={item.id}
                className={`nav-item ${item.status} ${item.id === currentScreen ? 'active' : ''}`}
                onClick={() => handleItemClick(item.id)}
                disabled={!clickable}
                style={{
                  color: getStatusColor(item),
                  cursor: clickable ? 'pointer' : 'default'
                }}
              >
                <span className="nav-icon">{getStatusIcon(item)}</span>
                <span className="nav-text">{truncatedText}</span>
              </button>
            )
          })}
        </div>

        {showLevel3Link && (
          <div className="level3-section">
            <button
              className="level3-link"
              onClick={() => router.push('/level3')}
            >
              Level 3: Dependencies →
            </button>
          </div>
        )}

      <style jsx>{`
        /* Mobile backdrop - hidden on desktop */
        .mobile-backdrop {
          display: none;
        }

        /* Close button - hidden on desktop */
        .close-button {
          display: none;
        }

        .navigation-sidebar {
          width: 280px;
          min-width: 200px;
          max-width: 350px;
          height: 100%;
          background-color: #f8fafc;
          border-right: 1px solid #e2e8f0;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .sidebar-header {
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-header h3 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1a202c;
          margin: 0;
        }

        .navigation-list {
          flex: 1;
          overflow-y: auto;
          max-height: calc(100% - 120px);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border: none;
          border-radius: 6px;
          background: transparent;
          text-align: left;
          font-size: 0.9rem;
          line-height: 1.4;
          transition: all 0.2s;
          width: 100%;
        }

        .nav-item:hover:not(:disabled) {
          background-color: #edf2f7;
        }

        .nav-item.active {
          background-color: #ebf8ff;
          border: 1px solid #bfdbfe;
        }

        .nav-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .nav-item.completed {
          background-color: rgba(34, 84, 61, 0.1);
        }

        .nav-item.current {
          background-color: rgba(30, 64, 175, 0.1);
          border: 1px solid rgba(30, 64, 175, 0.3);
        }

        .nav-item.in-progress {
          background-color: rgba(124, 58, 237, 0.1);
          border: 1px solid rgba(124, 58, 237, 0.2);
        }

        .nav-item.skipped {
          background-color: rgba(214, 158, 46, 0.1);
        }

        .nav-icon {
          font-size: 1rem;
          font-weight: bold;
          min-width: 16px;
          text-align: center;
        }

        .nav-text {
          flex: 1;
          overflow: hidden;
          white-space: nowrap;
        }

        .level3-section {
          margin-top: auto;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
        }

        .level3-link {
          width: 100%;
          padding: 0.75rem;
          background-color: #ebf8ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          color: #1e40af;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .level3-link:hover {
          background-color: #dbeafe;
          border-color: #93c5fd;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .mobile-backdrop {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 998;
          }

          .close-button {
            display: block;
            background: none;
            border: none;
            font-size: 1.5rem;
            color: #4a5568;
            cursor: pointer;
            padding: 0.5rem;
          }

          .navigation-sidebar {
            position: fixed;
            top: 0;
            left: -100%;
            width: 80%;
            max-width: 320px;
            height: 100vh;
            z-index: 999;
            transition: left 0.3s ease-in-out;
            border-right: 1px solid #e2e8f0;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
          }

          .navigation-sidebar.mobile-open {
            left: 0;
          }

          .navigation-list {
            max-height: calc(100vh - 120px);
          }

          .nav-item {
            font-size: 0.85rem;
            padding: 0.5rem;
          }
        }
      `}</style>
    </div>
    </>
  )
}