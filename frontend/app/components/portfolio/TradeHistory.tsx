'use client'

import { useState } from 'react'
import { usePortfolio, type Trade } from '../../providers/PortfolioContext'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatQuantity(qty: number): string {
  return parseFloat(qty.toFixed(4)).toString()
}

function TradeRow({ trade }: { trade: Trade }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        borderBottom: '1px solid #21262d',
        gap: 8,
        backgroundColor: hovered ? '#161b22' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Side badge */}
      <span
        style={{
          width: 32,
          fontSize: 11,
          fontWeight: 600,
          color: trade.side === 'buy' ? '#22c55e' : '#ef4444',
          flexShrink: 0,
        }}
      >
        {trade.side.toUpperCase()}
      </span>

      {/* Ticker */}
      <span
        style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', width: 48, flexShrink: 0 }}
      >
        {trade.ticker}
      </span>

      {/* Qty */}
      <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', flexShrink: 0 }}>
        {formatQuantity(trade.quantity)}
      </span>

      {/* Price */}
      <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', flexShrink: 0 }}>
        ${trade.price.toFixed(2)}
      </span>

      {/* Time */}
      <span style={{ fontSize: 11, color: '#30363d', marginLeft: 'auto', flexShrink: 0 }}>
        {formatTime(trade.executed_at)}
      </span>
    </div>
  )
}

export default function TradeHistory() {
  const { trades } = usePortfolio()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Section header */}
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
          HISTORY
        </span>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {trades.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: 11,
              color: '#30363d',
            }}
          >
            No trades yet
          </div>
        ) : (
          trades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
        )}
      </div>
    </div>
  )
}
