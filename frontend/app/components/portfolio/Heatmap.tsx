'use client'

import { useContext, useMemo } from 'react'
import { ResponsiveContainer, Treemap } from 'recharts'
import { PriceContext } from '../../providers/PriceContext'
import { usePortfolio } from '../../providers/PortfolioContext'

type HeatmapData = {
  name: string
  value: number
  unrealized_pnl: number
  pnl_percent: number
  [key: string]: unknown
}

type HeatmapCellProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  [key: string]: unknown
}

function HeatmapCell(props: HeatmapCellProps) {
  const { x = 0, y = 0, width = 0, height = 0, name } = props
  const pnl = (props.unrealized_pnl as number) ?? 0
  const pnlPct = (props.pnl_percent as number) ?? 0

  const fill =
    pnl > 0
      ? 'rgba(34, 197, 94, 0.6)'
      : pnl < 0
        ? 'rgba(239, 68, 68, 0.6)'
        : '#30363d'

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#0d1117" />
      {width > 30 && height > 24 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#e6edf3"
            fontSize={11}
            fontWeight={600}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 8}
            textAnchor="middle"
            fill="#e6edf3"
            fontSize={11}
            fontWeight={600}
          >
            {pnlPct >= 0 ? '+' : ''}
            {pnlPct.toFixed(2)}%
          </text>
        </>
      )}
    </g>
  )
}

export default function Heatmap() {
  const { positions } = usePortfolio()
  const { prices } = useContext(PriceContext)

  const heatmapData = useMemo<HeatmapData[]>(() => {
    return positions.map((pos) => {
      const currentPrice = prices[pos.ticker]?.price ?? pos.current_price
      const positionValue = Math.abs(pos.quantity * currentPrice)
      const unrealizedPnl = (currentPrice - pos.avg_cost) * pos.quantity
      const pnlPercent =
        pos.avg_cost > 0 ? ((currentPrice - pos.avg_cost) / pos.avg_cost) * 100 : 0
      return {
        name: pos.ticker,
        value: positionValue,
        unrealized_pnl: unrealizedPnl,
        pnl_percent: pnlPercent,
      }
    })
  }, [positions, prices])

  if (positions.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0d1117',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#30363d',
        }}
      >
        No open positions
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0d1117' }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={heatmapData}
          dataKey="value"
          content={<HeatmapCell />}
          isAnimationActive={false}
          stroke="#0d1117"
        />
      </ResponsiveContainer>
    </div>
  )
}
