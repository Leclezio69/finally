'use client'

import { createChart, AreaSeries, ColorType, UTCTimestamp } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import { usePrice } from '../../providers/PriceContext'
import { useWatchlist } from '../../providers/WatchlistContext'

/** Main chart area — lightweight-charts v5 area series, dark terminal theme.
 *
 * Data flow:
 *  - Ticker switch: Effect 2 calls setData() with synthesized history buffer
 *  - Live tick: Effect 3 calls series.update() on each SSE price event (D-06: never setData on tick)
 *  - Resize: ResizeObserver calls chart.applyOptions({width, height}) on container resize
 */
export default function MainChart() {
  const { selectedTicker, priceHistory } = useWatchlist()
  const update = usePrice(selectedTicker ?? '')

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null)

  // Effect 1 — Chart initialization (mount once)
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#161b22' },
      },
      crosshair: { mode: 1 }, // Magnet mode
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: true,
      },
      rightPriceScale: { borderColor: '#30363d' },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })
    chartRef.current = chart

    // v5 breaking change: use addSeries with the AreaSeries class token (v4 addArea variant removed)
    const series = chart.addSeries(AreaSeries, {
      topColor: 'rgba(32, 157, 215, 0.4)',
      bottomColor: 'rgba(32, 157, 215, 0.0)',
      lineColor: '#209dd7',
      lineWidth: 2,
    })
    seriesRef.current = series

    const observer = new ResizeObserver((entries) => {
      if (!chartRef.current) return
      const { width, height } = entries[0].contentRect
      chartRef.current.applyOptions({ width, height })
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Effect 2 — Ticker switch: load history buffer via setData() then scroll to present
  useEffect(() => {
    if (!selectedTicker || !seriesRef.current || !chartRef.current) return

    const history = priceHistory[selectedTicker] ?? []
    // Synthesize timestamps spaced 500ms apart ending at now
    // (priceHistory stores raw prices without timestamps — T-02-10: approximate times, visual only)
    const now = Math.floor(Date.now() / 1000)
    const data = history.map((price, i) => ({
      time: (now - (history.length - 1 - i) * 0.5) as UTCTimestamp,
      value: price,
    }))

    seriesRef.current.setData(data)
    chartRef.current.timeScale().scrollToRealTime()
  }, [selectedTicker]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 3 — Live tick: append each SSE price event via update() (D-06: not setData on tick)
  useEffect(() => {
    if (!update || !seriesRef.current) return
    // timestamp is a string in PriceUpdate — convert to number for UTCTimestamp
    const t = parseFloat(update.timestamp) as UTCTimestamp
    seriesRef.current.update({ time: t, value: update.price })
  }, [update])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chart header bar — 32px, shows selected ticker + live price */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid #30363d',
          gap: 12,
          flexShrink: 0,
          backgroundColor: '#0d1117',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>
          {selectedTicker ?? '—'}
        </span>
        {update && (
          <span
            style={{
              fontSize: 13,
              color:
                update.direction === 'up'
                  ? '#22c55e'
                  : update.direction === 'down'
                    ? '#ef4444'
                    : '#e6edf3',
            }}
          >
            {update.price.toFixed(2)}
          </span>
        )}
        {!update && selectedTicker && (
          <span style={{ fontSize: 11, color: '#8b949e' }}>Waiting for data...</span>
        )}
      </div>

      {/* Chart canvas container — flex: 1 fills remaining height; minHeight: 0 allows shrink */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
}
