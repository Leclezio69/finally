'use client';
import { useEffect, useRef } from 'react';
import type { SparklinePoint } from '../types';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

interface Props {
  ticker: string | null;
  data: SparklinePoint[];
  currentPrice: number | null;
}

export default function MainChart({ ticker, data, currentPrice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const init = async () => {
      const { createChart, LineSeries } = await import('lightweight-charts');

      if (!chartRef.current) {
        const chart = createChart(containerRef.current!, {
          width: containerRef.current!.clientWidth,
          height: containerRef.current!.clientHeight,
          layout: {
            background: { color: '#161b22' },
            textColor: '#8b949e',
          },
          grid: {
            vertLines: { color: '#21262d' },
            horzLines: { color: '#21262d' },
          },
          crosshair: { mode: 1 },
          rightPriceScale: {
            borderColor: '#21262d',
          },
          timeScale: {
            borderColor: '#21262d',
            timeVisible: true,
          },
        });

        const series = chart.addSeries(LineSeries, {
          color: '#209dd7',
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: true,
          priceLineColor: '#209dd7',
        });

        chartRef.current = chart;
        seriesRef.current = series;

        const resizeObserver = new ResizeObserver(() => {
          if (containerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: containerRef.current.clientWidth,
              height: containerRef.current.clientHeight,
            });
          }
        });
        resizeObserver.observe(containerRef.current!);
      }

      // Update data
      if (seriesRef.current && data.length > 0) {
        const seen = new Set<number>();
        const deduped = data
          .filter(p => { if (seen.has(p.time)) return false; seen.add(p.time); return true; })
          .sort((a, b) => a.time - b.time)
          .map(p => ({ time: p.time as UTCTimestamp, value: p.value }));
        seriesRef.current.setData(deduped);
      }
    };

    init();
  }, [data]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-terminal-surface">
      <div className="px-3 py-2 border-b border-terminal-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-sm">{ticker || 'Select a ticker'}</span>
          {currentPrice !== null && (
            <span className="text-accent-blue font-mono text-sm">${currentPrice.toFixed(2)}</span>
          )}
        </div>
        {ticker && <span className="text-xs text-terminal-muted">Price (accumulated)</span>}
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
