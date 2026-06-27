'use client';
import { useEffect, useRef } from 'react';
import type { SparklinePoint } from '../types';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

interface Props {
  data: SparklinePoint[];
  direction?: 'up' | 'down' | 'flat';
  width?: number;
  height?: number;
}

export default function Sparkline({ data, direction = 'flat', width = 80, height = 30 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const init = async () => {
      const { createChart, LineSeries } = await import('lightweight-charts');

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }

      const color = direction === 'up' ? '#3fb950' : direction === 'down' ? '#f85149' : '#8b949e';

      const chart = createChart(containerRef.current!, {
        width,
        height,
        layout: {
          background: { color: 'transparent' },
          textColor: 'transparent',
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        timeScale: { visible: false },
        handleScroll: false,
        handleScale: false,
      });

      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      // Deduplicate timestamps to avoid lightweight-charts errors
      const seen = new Set<number>();
      const dedupedData = data
        .filter(p => {
          if (seen.has(p.time)) return false;
          seen.add(p.time);
          return true;
        })
        .sort((a, b) => a.time - b.time)
        .map(p => ({ time: p.time as UTCTimestamp, value: p.value }));

      if (dedupedData.length > 1) {
        series.setData(dedupedData);
      }

      chartRef.current = chart;
      seriesRef.current = series;
    };

    init();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [data, direction, width, height]);

  return <div ref={containerRef} style={{ width, height }} />;
}
