'use client';
import { useState } from 'react';
import type { PriceUpdate, WatchlistItem, SparklinePoint } from '../types';
import Sparkline from './Sparkline';

interface Props {
  watchlist: WatchlistItem[];
  prices: Record<string, PriceUpdate>;
  flashMap: Record<string, 'up' | 'down'>;
  sparklines: Record<string, SparklinePoint[]>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onAddTicker: (ticker: string) => Promise<void>;
  onRemoveTicker: (ticker: string) => Promise<void>;
}

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return price.toFixed(2);
}

function formatPercent(pct: number | null): string {
  if (pct === null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export default function WatchlistPanel({
  watchlist, prices, flashMap, sparklines, selectedTicker, onSelectTicker, onAddTicker, onRemoveTicker
}: Props) {
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = addInput.trim().toUpperCase();
    if (!ticker) return;
    setAdding(true);
    setError('');
    try {
      await onAddTicker(ticker);
      setAddInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-terminal-surface border-r border-terminal-border">
      <div className="px-3 py-2 border-b border-terminal-border">
        <h2 className="text-xs font-bold text-accent-yellow tracking-widest uppercase">Watchlist</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {watchlist.map(item => {
          const live = prices[item.ticker];
          const price = live?.price ?? item.price;
          const pct = live?.change_percent ?? item.change_percent;
          const dir = live?.direction ?? item.direction ?? 'flat';
          const flash = flashMap[item.ticker];
          const sparkData = sparklines[item.ticker] || [];
          const isSelected = selectedTicker === item.ticker;

          return (
            <div
              key={item.ticker}
              className={`group px-3 py-2 border-b border-terminal-border cursor-pointer hover:bg-terminal-bg transition-colors ${isSelected ? 'bg-terminal-bg border-l-2 border-l-accent-blue' : ''}`}
              onClick={() => onSelectTicker(item.ticker)}
            >
              <div className={`rounded transition-colors duration-100 ${flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-white">{item.ticker}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveTicker(item.ticker); }}
                    className="opacity-0 group-hover:opacity-100 text-terminal-muted hover:text-market-down text-xs transition-opacity"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white">${formatPrice(price)}</span>
                    <span className={`text-xs ${(pct ?? 0) >= 0 ? 'text-market-up' : 'text-market-down'}`}>
                      {(pct ?? 0) >= 0 ? '▲' : '▼'} {formatPercent(pct)}
                    </span>
                  </div>
                  <Sparkline data={sparkData} direction={dir as 'up' | 'down' | 'flat'} width={70} height={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="p-3 border-t border-terminal-border">
        {error && <p className="text-xs text-market-down mb-1">{error}</p>}
        <div className="flex gap-1">
          <input
            type="text"
            value={addInput}
            onChange={e => setAddInput(e.target.value.toUpperCase())}
            placeholder="Add ticker..."
            className="flex-1 bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs text-white placeholder-terminal-muted focus:outline-none focus:border-accent-blue uppercase"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-2 py-1 bg-accent-blue hover:bg-blue-500 text-white text-xs rounded disabled:opacity-50"
          >
            +
          </button>
        </div>
      </form>
    </div>
  );
}
