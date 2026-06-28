'use client'

import { useState } from 'react'
import { usePortfolio, type Position } from '../../providers/PortfolioContext'
import { usePrice } from '../../providers/PriceContext'

export default function PositionsTable() {
  const { positions } = usePortfolio()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sticky header row */}
      <div
        style={{
          height: 28,
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 0.8fr',
          alignItems: 'center',
          padding: '0 8px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textAlign: 'left' }}>TICKER</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textAlign: 'right' }}>QTY</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textAlign: 'right' }}>AVG COST</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textAlign: 'right' }}>PRICE</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textAlign: 'right' }}>P&L</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textAlign: 'right' }}>%</span>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {positions.length === 0 ? (
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
            No positions
          </div>
        ) : (
          positions.map((pos) => <PositionRow key={pos.ticker} position={pos} />)
        )}
      </div>
    </div>
  )
}

function PositionRow({ position }: { position: Position }) {
  const priceUpdate = usePrice(position.ticker)
  const [hovered, setHovered] = useState(false)

  const currentPrice = priceUpdate?.price ?? position.current_price
  const unrealizedPnl = (currentPrice - position.avg_cost) * position.quantity
  const pnlPercent =
    position.avg_cost > 0 ? ((currentPrice - position.avg_cost) / position.avg_cost) * 100 : 0

  const pnlColor = unrealizedPnl >= 0 ? '#22c55e' : '#ef4444'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 0.8fr',
        alignItems: 'center',
        height: 36,
        padding: '0 8px',
        borderBottom: '1px solid #21262d',
        backgroundColor: hovered ? '#161b22' : 'transparent',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', textAlign: 'left' }}>
        {position.ticker}
      </span>
      <span style={{ fontSize: 13, color: '#e6edf3', textAlign: 'right' }}>
        {parseFloat(position.quantity.toFixed(4)).toString()}
      </span>
      <span style={{ fontSize: 13, color: '#e6edf3', textAlign: 'right' }}>
        ${position.avg_cost.toFixed(2)}
      </span>
      <span style={{ fontSize: 13, color: '#e6edf3', textAlign: 'right' }}>
        ${currentPrice.toFixed(2)}
      </span>
      <span style={{ fontSize: 13, color: pnlColor, textAlign: 'right' }}>
        {unrealizedPnl >= 0 ? '+' : ''}${Math.abs(unrealizedPnl).toFixed(2)}
      </span>
      <span style={{ fontSize: 13, color: pnlColor, textAlign: 'right' }}>
        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
      </span>
    </div>
  )
}
