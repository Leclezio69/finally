'use client'

import TradeBar from './TradeBar'
import PositionsTable from './PositionsTable'
import Heatmap from './Heatmap'
import PnLChart from './PnLChart'
import TradeHistory from './TradeHistory'

export default function PortfolioPanel() {
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
          PORTFOLIO
        </span>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Row A: Heatmap (left) + P&L Chart (right) */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #30363d' }}>
            <Heatmap />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PnLChart />
          </div>
        </div>

        {/* Row B: Trade Bar + Positions table + Trade history */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            borderTop: '1px solid #30363d',
          }}
        >
          <TradeBar />
          <div style={{ flex: 1, minHeight: 0 }}>
            <PositionsTable />
          </div>
          <div style={{ flex: 1, minHeight: 0, borderTop: '1px solid #30363d' }}>
            <TradeHistory />
          </div>
        </div>
      </div>
    </div>
  )
}
