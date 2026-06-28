'use client'

interface SparklineProps {
  prices: number[]
  baselinePrice: number
}

export default function Sparkline({ prices, baselinePrice }: SparklineProps) {
  if (prices.length < 2) return <svg width={60} height={24} />

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min

  const points = prices
    .map((price, i) => {
      const x = (i / (prices.length - 1)) * 60
      const y = range === 0 ? 12 : 22 - ((price - min) / range) * 20
      return `${x},${y}`
    })
    .join(' ')

  const color = prices[prices.length - 1] >= baselinePrice ? '#22c55e' : '#ef4444'

  return (
    <svg width={60} height={24} style={{ display: 'block' }}>
      <polyline
        points={points}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
