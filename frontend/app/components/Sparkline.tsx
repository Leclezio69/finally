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

  // Initialize chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const init = async () => {
      const { createChart, LineSeries } = await import('lightweight-charts');

      const chart = createChart(containerRef.current!, {
        width,
        height,
        layout: {
          background: { color: 'transparent' },
          textColor: 'transparent',
          attributionLogo: false,
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
        color: '#8b949e',
        lineWidth: 1,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = series;
    };

    init();

    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Update data without recreating chart
  useEffect(() => {
    if (!seriesRef.current || data.length < 2) return;

    const seen = new Set<number>();
    const deduped = data
      .filter(p => {
        if (seen.has(p.time)) return false;
        seen.add(p.time);
        return true;
      })
      .sort((a, b) => a.time - b.time)
      .map(p => ({ time: p.time as UTCTimestamp, value: p.value }));

    seriesRef.current.setData(deduped);
  }, [data]);

  // Update color when direction changes
  useEffect(() => {
    if (!seriesRef.current) return;
    const color = direction === 'up' ? '#26a641' : direction === 'down' ? '#da3633' : '#8b949e';
    seriesRef.current.applyOptions({ color });
  }, [direction]);

  return <div ref={containerRef} style={{ width, height }} />;
}
