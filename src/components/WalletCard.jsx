'use client'
import { useAccount, useDisconnect } from 'wagmi'

// Generate a deterministic color from an address for identicon fallback
function addressToColor(address) {
  const hash = address.toLowerCase().slice(2, 8)
  const hue = parseInt(hash, 16) % 360
  return `hsl(${hue}, 65%, 55%)`
}

// Generate initials from ENS name
function getInitials(ensName) {
  if (!ensName) return '?'
  const name = ensName.replace('.eth', '')
  return name.slice(0, 2).toUpperCase()
}

// Shorten address for display
function shortenAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function WalletCard({ ensName, avatar, isValid }) {
  const { address, connector } = useAccount()
  const { disconnect } = useDisconnect()

  const walletName = connector?.name || 'Wallet'
  const bgColor = addressToColor(address || '0x000000')

  return (
    <div style={styles.card}>
      <div style={styles.cardContent}>
        {/* Avatar */}
        <div style={styles.avatarContainer}>
          {avatar ? (
            <img
              src={avatar}
              alt={ensName || 'Avatar'}
              style={styles.avatar}
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            style={{
              ...styles.avatarFallback,
              backgroundColor: bgColor,
              display: avatar ? 'none' : 'flex'
            }}
          >
            {getInitials(ensName)}
          </div>
        </div>

        {/* Info */}
        <div style={styles.info}>
          <div style={styles.nameRow}>
            <span style={styles.ensName}>{ensName || 'No ENS'}</span>
            {isValid && (
              <svg
                style={styles.checkmark}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <div style={styles.address}>{shortenAddress(address)}</div>
          <div style={styles.walletInfo}>Connected via {walletName}</div>
        </div>
      </div>

      {/* Disconnect button */}
      <button
        onClick={() => disconnect()}
        style={styles.disconnectButton}
      >
        Disconnect
      </button>
    </div>
  )
}

const styles = {
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    gap: '16px',
  },
  cardContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    minWidth: 0,
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    width: '48px',
    height: '48px',
    flexShrink: 0,
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  avatarFallback: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '600',
    fontSize: '16px',
    letterSpacing: '0.5px',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  ensName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  checkmark: {
    width: '16px',
    height: '16px',
    color: '#10b981',
    flexShrink: 0,
  },
  address: {
    fontSize: '13px',
    color: '#6b7280',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  walletInfo: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  disconnectButton: {
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
}
