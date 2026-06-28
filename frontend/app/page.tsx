'use client'

import { useState } from 'react'
import MainChart from './components/chart/MainChart'
import WatchlistPanel from './components/watchlist/WatchlistPanel'
import PortfolioPanel from './components/portfolio/PortfolioPanel'
import ChatPanel from './components/chat/ChatPanel'
import { usePortfolio } from './providers/PortfolioContext'
import { usePriceStatus } from './providers/PriceContext'

export default function Home() {
  const { totalValue, cashBalance } = usePortfolio()
  const priceStatus = usePriceStatus()
  const [chatOpen, setChatOpen] = useState(true)

  const statusColor =
    priceStatus === 'connected'
      ? '#22c55e'
      : priceStatus === 'reconnecting' || priceStatus === 'connecting'
        ? '#ecad0a'
        : '#ef4444'

  const statusTitle =
    priceStatus === 'connected'
      ? 'Connected'
      : priceStatus === 'reconnecting'
        ? 'Reconnecting...'
        : priceStatus === 'connecting'
          ? 'Connecting...'
          : 'Disconnected'

  return (
    <>
      {/* Header — full-width top bar */}
      <header
        style={{
          gridArea: 'header',
          backgroundColor: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 24,
        }}
      >
        <span
          style={{
            color: '#ecad0a',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '0.05em',
          }}
        >
          FinAlly
        </span>
        <span style={{ color: '#8b949e', fontSize: 11 }}>
          AI Trading Workstation
        </span>

        {/* Vertical separator */}
        <div style={{ borderLeft: '1px solid #30363d', height: 28, flexShrink: 0 }} />

        {/* Portfolio total value */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#8b949e',
              letterSpacing: '0.15em',
            }}
          >
            PORTFOLIO
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3' }}>
            {totalValue.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Cash balance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#8b949e',
              letterSpacing: '0.15em',
            }}
          >
            CASH
          </span>
          <span style={{ fontSize: 15, fontWeight: 400, color: '#e6edf3' }}>
            {cashBalance.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* SSE connection status dot + collapse toggle */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            onClick={() => setChatOpen((prev) => !prev)}
            title={chatOpen ? 'Collapse chat' : 'Expand chat'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8b949e',
              fontSize: 16,
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {chatOpen ? '\u203a' : '\u2039'}
          </button>
          <span
            title={statusTitle}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: statusColor,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: statusColor,
                flexShrink: 0,
              }}
            />
            {statusTitle}
          </span>
        </div>
      </header>

      {/* Watchlist panel */}
      <aside
        style={{
          gridArea: 'watch',
          backgroundColor: '#1a1a2e',
          borderRight: '1px solid #30363d',
          overflow: 'hidden',
        }}
      >
        <WatchlistPanel />
      </aside>

      {/* Main chart */}
      <main
        style={{
          gridArea: 'chart',
          backgroundColor: '#0d1117',
          overflow: 'hidden',
        }}
      >
        <MainChart />
      </main>

      {/* AI chat panel */}
      <aside
        style={{
          gridArea: 'chat',
          backgroundColor: '#1a1a2e',
          borderLeft: '1px solid #30363d',
          overflow: 'hidden',
          width: chatOpen ? '320px' : '40px',
          transition: 'width 200ms ease',
        }}
      >
        <div style={{ visibility: chatOpen ? 'visible' : 'hidden', height: '100%' }}>
          <ChatPanel />
        </div>
      </aside>

      {/* Portfolio section */}
      <section
        style={{
          gridArea: 'port',
          backgroundColor: '#1a1a2e',
          borderRight: '1px solid #30363d',
          borderTop: '1px solid #30363d',
          overflow: 'hidden',
        }}
      >
        <PortfolioPanel />
      </section>
    </>
  )
}
