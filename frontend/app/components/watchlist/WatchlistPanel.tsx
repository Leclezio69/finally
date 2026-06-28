'use client'

import { useState } from 'react'
import { useWatchlist } from '../../providers/WatchlistContext'
import WatchlistRow from './WatchlistRow'

export default function WatchlistPanel() {
  const { tickers, addTicker } = useWatchlist()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    const ticker = input.trim()
    if (!ticker) return

    setLoading(true)
    setError(null)

    try {
      await addTicker(ticker)
      setInput('')
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('UNIQUE') || message.includes('409')) {
        setError(`Already watching ${ticker}`)
      } else {
        setError('Failed to add ticker. Try again.')
      }
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Panel header */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          borderBottom: '1px solid #30363d',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#8b949e',
            letterSpacing: '0.15em',
          }}
        >
          WATCHLIST
        </span>
      </div>

      {/* Scrollable ticker list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tickers.length === 0 ? (
          <div style={{ padding: '16px 8px', color: '#8b949e', fontSize: 11 }}>
            No tickers. Add one below.
          </div>
        ) : (
          tickers.map((ticker) => <WatchlistRow key={ticker} ticker={ticker} />)
        )}
      </div>

      {/* Add-ticker footer */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 1, backgroundColor: '#30363d' }} />
        <div
          style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
            placeholder="Ticker..."
            disabled={loading}
            style={{
              flex: 1,
              height: 28,
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#e6edf3',
              fontSize: 13,
              paddingLeft: 8,
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            style={{
              width: 72,
              height: 28,
              background: '#209dd7',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              borderRadius: 0,
            }}
          >
            Add Ticker
          </button>
          {error && (
            <div style={{ fontSize: 11, color: '#ef4444', padding: '2px 0 0 0', width: '100%' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
