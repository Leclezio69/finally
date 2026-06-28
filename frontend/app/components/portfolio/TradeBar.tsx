'use client'

import { useState } from 'react'
import { usePortfolio } from '../../providers/PortfolioContext'

export default function TradeBar() {
  const { executeTrade } = usePortfolio()
  const [tickerInput, setTickerInput] = useState('')
  const [qtyInput, setQtyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTrade(side: 'buy' | 'sell') {
    const ticker = tickerInput.trim()
    const qty = parseFloat(qtyInput)

    if (!ticker) {
      setError('Enter a ticker symbol.')
      setTimeout(() => setError(null), 3000)
      return
    }
    if (isNaN(qty) || qty <= 0) {
      setError('Enter a valid quantity.')
      setTimeout(() => setError(null), 3000)
      return
    }

    setLoading(true)
    setError(null)

    const result = await executeTrade(ticker, qty, side)

    if (result !== null) {
      setError(result)
      setTimeout(() => setError(null), 3000)
    } else {
      setTickerInput('')
      setQtyInput('')
    }

    setLoading(false)
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          height: 40,
          backgroundColor: '#161b22',
          borderTop: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: 4,
        }}
      >
        {/* Ticker input */}
        <input
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
          placeholder="Ticker"
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 64,
            height: 28,
            background: '#0d1117',
            border: '1px solid #30363d',
            color: '#e6edf3',
            fontSize: 13,
            paddingLeft: 8,
            outline: 'none',
            borderRadius: 0,
          }}
        />

        {/* Qty input */}
        <input
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
          placeholder="Qty"
          type="number"
          min="0"
          step="any"
          disabled={loading}
          style={{
            width: 80,
            height: 28,
            background: '#0d1117',
            border: '1px solid #30363d',
            color: '#e6edf3',
            fontSize: 13,
            paddingLeft: 8,
            outline: 'none',
            borderRadius: 0,
          }}
        />

        {/* Buy button */}
        <button
          onClick={() => handleTrade('buy')}
          disabled={loading}
          style={{
            width: 64,
            height: 28,
            background: '#209dd7',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
            border: 'none',
            borderRadius: 0,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : 'Buy'}
        </button>

        {/* Sell button */}
        <button
          onClick={() => handleTrade('sell')}
          disabled={loading}
          style={{
            width: 64,
            height: 28,
            background: '#753991',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
            border: 'none',
            borderRadius: 0,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : 'Sell'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            fontSize: 11,
            color: '#ef4444',
            padding: '2px 8px 0 8px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
