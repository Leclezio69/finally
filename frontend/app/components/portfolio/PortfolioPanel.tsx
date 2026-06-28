'use client'

import TradeBar from './TradeBar'
import PositionsTable from './PositionsTable'
import Heatmap from './Heatmap'
import PnLChart from './PnLChart'
import TradeHistory from './TradeHistory'

const SECTIONS = [
  { label: 'POSITIONS', component: <PositionsTable /> },
  { label: 'HEATMAP',   component: <Heatmap /> },
  { label: 'P&L CHART', component: <PnLChart /> },
  { label: 'HISTORY',   component: <TradeHistory /> },
]

export default function PortfolioPanel() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Trade bar — always visible */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #30363d' }}>
        <TradeBar />
      </div>

      {/* Four equal columns — all visible simultaneously */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {SECTIONS.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: i < SECTIONS.length - 1 ? '1px solid #30363d' : 'none',
              overflow: 'hidden',
            }}
          >
            {/* Column header */}
            <div
              style={{
                height: 28,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 10,
                flexShrink: 0,
                backgroundColor: '#161b22',
                borderBottom: '1px solid #30363d',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: '#8b949e', letterSpacing: '0.15em' }}>
                {s.label}
              </span>
            </div>

            {/* Section content */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {s.component}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
