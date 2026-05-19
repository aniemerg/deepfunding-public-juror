'use client'

import { useEffect, useState } from 'react'
import styles from './page.module.css'

function getEnsAvatarUrl(ensName) {
  if (!ensName) return null
  return `https://metadata.ens.domains/mainnet/avatar/${encodeURIComponent(ensName)}`
}

function getFallbackAvatarUrl(seed) {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed || 'juror')}`
}

function Stars({ count }) {
  const stars = Array.from({ length: 3 }, (_, i) => (i < count ? '★' : '☆')).join(' ')
  return <span className={styles.stars}>{stars}</span>
}

function JurorCard({ juror }) {
  const primary = getEnsAvatarUrl(juror.ensName)
  const fallback = getFallbackAvatarUrl(juror.ensName)
  const [src, setSrc] = useState(primary || fallback)

  return (
    <div className={styles.card}>
      <div className={styles.avatar}>
        <img
          src={src}
          alt={juror.ensName}
          onError={() => setSrc(fallback)}
          loading="lazy"
        />
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{juror.ensName}</div>
        <Stars count={juror.stars} />
        <div className={styles.badges}>
          {juror.badges.map(badge => (
            <span className={styles.badge} key={badge}>{badge}</span>
          ))}
        </div>
        {juror.lastSubmissionAt && (
          <div className={styles.timestamp}>
            Last submission: {new Date(juror.lastSubmissionAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  )
}

export default function JurorRollPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const res = await fetch('/api/juror-roll')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load juror roll')
        if (isMounted) setData(json)
      } catch (err) {
        if (isMounted) setError(err.message)
      }
    }
    load()
    return () => { isMounted = false }
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.title}>Juror Roll</div>
        <div className={styles.subtitle}>Recognition for jurors who have contributed submissions</div>
      </header>

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {!data && !error && (
        <div className={styles.loading}>Loading jurors...</div>
      )}

      {data && data.jurors?.length > 0 && (
        <>
          <div className={styles.meta}>
            <span>{data.jurors.length} jurors</span>
            <span>•</span>
            <span>Cached {new Date(data.cachedAt).toLocaleString()}</span>
          </div>
          <div className={styles.grid}>
            {data.jurors.map(juror => (
              <JurorCard key={juror.ensName} juror={juror} />
            ))}
          </div>
        </>
      )}

      {data && (!data.jurors || data.jurors.length === 0) && (
        <div className={styles.empty}>
          No juror submissions found yet.
        </div>
      )}
    </div>
  )
}
