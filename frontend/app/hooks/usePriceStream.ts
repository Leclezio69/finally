'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { PriceUpdate, SparklinePoint } from '../types';

const MAX_SPARKLINE_POINTS = 60;

export function usePriceStream() {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [sparklines, setSparklines] = useState<Record<string, SparklinePoint[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');
    const es = new EventSource('/api/stream/prices');
    eventSourceRef.current = es;

    es.addEventListener('price_update', (event: MessageEvent) => {
      const update: PriceUpdate = JSON.parse(event.data);

      setPrices(prev => ({ ...prev, [update.ticker]: update }));

      setSparklines(prev => {
        const existing = prev[update.ticker] || [];
        const newPoint: SparklinePoint = {
          time: Math.floor(new Date(update.timestamp).getTime() / 1000),
          value: update.price,
        };
        const updated = [...existing, newPoint].slice(-MAX_SPARKLINE_POINTS);
        return { ...prev, [update.ticker]: updated };
      });

      if (update.direction !== 'flat') {
        setFlashMap(prev => ({ ...prev, [update.ticker]: update.direction as 'up' | 'down' }));
        setTimeout(() => {
          setFlashMap(prev => {
            const next = { ...prev };
            delete next[update.ticker];
            return next;
          });
        }, 700);
      }
    });

    es.onopen = () => setConnectionStatus('connected');

    es.onerror = () => {
      setConnectionStatus('disconnected');
      es.close();
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      eventSourceRef.current?.close();
    };
  }, [connect]);

  return { prices, sparklines, connectionStatus, flashMap };
}
