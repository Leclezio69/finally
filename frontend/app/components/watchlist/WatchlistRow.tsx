'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrice } from '../../providers/PriceContext'
import { useWatchlist } from '../../providers/WatchlistContext'
import Sparkline from './Sparkline'

interface WatchlistRowProps {
  ticker: string
}

export default function WatchlistRow({ ticker }: WatchlistRowProps) {
  const update = usePrice(ticker)
  const { priceHistory, firstPrice, selectedTicker, setSelectedTicker, removeTicker } =
    useWatchlist()
  const priceCellRef = useRef<HTMLDivElement>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!update || !priceCellRef.current) return
    const el = priceCellRef.current

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    el.classList.remove('flash-up', 'flash-down')
    void el.offsetHeight // force reflow — REQUIRED to restart CSS animation

    if (update.direction === 'up') el.classList.add('flash-up')
    else if (update.direction === 'down') el.classList.add('flash-down')

    flashTimerRef.current = setTimeout(() => {
      el.classList.remove('flash-up', 'flash-down')
      flashTimerRef.current = null
    }, 500)

    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [update])

  const isSelected = selectedTicker === ticker
  const changePercent = update?.change_percent ?? null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 64px 52px 60px 16px',
        alignItems: 'center',
        height: 36,
        padding: '0 8px',
        paddingLeft: isSelected ? '6px' : '8px',
        cursor: 'pointer',
        borderBottom: '1px solid #21262d',
        borderLeft: isSelected ? '2px solid #209dd7' : 'none',
        backgroundColor: isSelected || hovered ? '#161b22' : 'transparent',
      }}
      onClick={() => setSelectedTicker(ticker)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Ticker symbol */}
      <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13 }}>{ticker}</span>

      {/* Price cell with flash animation */}
      <div ref={priceCellRef} style={{ textAlign: 'right', color: '#e6edf3', fontSize: 13 }}>
        {update?.price.toFixed(2) ?? '—'}
      </div>

      {/* Change % */}
      <span
        style={{
          textAlign: 'right',
          color: changePercent != null && changePercent >= 0 ? '#22c55e' : '#ef4444',
          fontSize: 11,
        }}
      >
        {changePercent != null
          ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
          : '—'}
      </span>

      {/* Sparkline */}
      <Sparkline
        prices={priceHistory[ticker] ?? []}
        baselinePrice={firstPrice[ticker] ?? (priceHistory[ticker]?.[0] ?? 0)}
      />

      {/* Remove button (visible on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          removeTicker(ticker)
        }}
        aria-label={`Remove ${ticker}`}
        style={{
          opacity: hovered ? 1 : 0,
          color: '#8b949e',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
