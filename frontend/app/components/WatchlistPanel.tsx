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
      <div className="px-3 py-1.5 border-b border-terminal-border flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-accent-yellow tracking-widest uppercase">Watchlist</h2>
        <span className="text-[9px] text-terminal-muted">{watchlist.length} tickers</span>
      </div>

      <div className="flex items-center gap-1 px-2 py-1 border-b border-terminal-border bg-terminal-bg">
        <span className="text-[9px] text-terminal-muted uppercase tracking-widest w-12 shrink-0">Ticker</span>
        <span className="text-[9px] text-terminal-muted uppercase tracking-widest w-16 text-right shrink-0">Price</span>
        <span className="text-[9px] text-terminal-muted uppercase tracking-widest w-14 text-right shrink-0">Chg%</span>
        <span className="text-[9px] text-terminal-muted uppercase tracking-widest flex-1 text-right">Chart</span>
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
          const isUp = (pct ?? 0) >= 0;

          return (
            <div
              key={item.ticker}
              className={`group relative cursor-pointer transition-colors ${isSelected ? 'bg-[#0d1a2a]' : 'hover:bg-[#0d131a]'}`}
              style={isSelected ? {borderLeft: '2px solid #209dd7'} : {borderLeft: '2px solid transparent'}}
              onClick={() => onSelectTicker(item.ticker)}
            >
              <div className={`px-2 py-1.5 border-b border-terminal-border ${flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''}`}>
                {/* Row: ticker | price | pct | sparkline */}
                <div className="flex items-center gap-1">
                  <span className="font-bold text-white w-12 text-[11px] shrink-0">{item.ticker}</span>
                  <span className="font-mono text-white text-[11px] w-16 text-right shrink-0">${formatPrice(price)}</span>
                  <span className={`text-[10px] w-14 text-right shrink-0 ${isUp ? 'text-market-up' : 'text-market-down'}`}>
                    {isUp ? '▲' : '▼'}{formatPercent(pct)}
                  </span>
                  <div className="flex-1 flex justify-end">
                    <Sparkline data={sparkData} direction={dir as 'up' | 'down' | 'flat'} width={56} height={20} />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveTicker(item.ticker); }}
                    className="opacity-0 group-hover:opacity-100 text-terminal-muted hover:text-market-down text-xs transition-opacity w-4 shrink-0 text-center"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="px-2 py-2 border-t border-terminal-border">
        {error && <p className="text-[10px] text-market-down mb-1">{error}</p>}
        <div className="flex gap-1">
          <input
            type="text"
            value={addInput}
            onChange={e => setAddInput(e.target.value.toUpperCase())}
            placeholder="Add ticker..."
            className="flex-1 bg-terminal-bg border border-terminal-border px-2 py-1 text-[11px] text-white placeholder-terminal-muted focus:outline-none focus:border-accent-blue uppercase font-mono"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-3 py-1 bg-accent-blue hover:bg-blue-500 text-white text-[11px] disabled:opacity-50 font-bold"
          >
            +
          </button>
        </div>
      </form>
    </div>
  );
}
