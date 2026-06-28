'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { usePortfolio } from '../../providers/PortfolioContext'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDollarAxis(value: number): string {
  return '$' + value.toLocaleString()
}

export default function PnLChart() {
  const { history } = usePortfolio()

  if (history.length === 0) {
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
        No history yet
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0d1117' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>
          <CartesianGrid horizontal vertical={false} stroke="#21262d" strokeDasharray="3 3" />
          <XAxis
            dataKey="recorded_at"
            tickFormatter={formatTime}
            tick={{ fill: '#8b949e', fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatDollarAxis}
            tick={{ fill: '#8b949e', fontSize: 11, fontWeight: 600 }}
            orientation="right"
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              color: '#e6edf3',
              fontSize: 11,
            }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Value']}
            labelFormatter={(label) => formatTime(String(label))}
          />
          <Line
            type="monotone"
            dataKey="total_value"
            stroke="#209dd7"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
