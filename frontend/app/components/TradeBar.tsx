'use client';
import { useState } from 'react';
import type { PriceUpdate } from '../types';

interface Props {
  onTrade: (ticker: string, qty: number, side: 'buy' | 'sell') => Promise<void>;
  prices: Record<string, PriceUpdate>;
  selectedTicker?: string | null;
}

export default function TradeBar({ onTrade, prices, selectedTicker }: Props) {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const effectiveTicker = ticker.trim().toUpperCase() || selectedTicker?.toUpperCase() || '';
  const currentPrice = prices[effectiveTicker]?.price;

  const handleTrade = async (side: 'buy' | 'sell') => {
    const t = effectiveTicker;
    const qty = parseFloat(quantity);
    if (!t || isNaN(qty) || qty <= 0) {
      setFeedback({ type: 'error', message: 'Enter valid ticker and quantity' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      await onTrade(t, qty, side);
      setFeedback({ type: 'success', message: `${side.toUpperCase()} ${qty} ${t} executed` });
      setQuantity('');
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Trade failed' });
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="flex items-center gap-0 bg-terminal-surface border-t border-terminal-border flex-shrink-0">
      <div className="text-[9px] text-terminal-muted uppercase tracking-widest px-3 py-2 border-r border-terminal-border whitespace-nowrap">Order Entry</div>
      <input
        type="text"
        value={ticker}
        onChange={e => setTicker(e.target.value.toUpperCase())}
        placeholder={selectedTicker || 'TICKER'}
        className="w-20 bg-transparent border-r border-terminal-border px-3 py-2 text-[11px] font-bold text-white placeholder-terminal-muted focus:outline-none focus:bg-[#0d1a2a] uppercase font-mono"
      />
      <input
        type="number"
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
        placeholder="QTY"
        min="0"
        step="any"
        className="w-20 bg-transparent border-r border-terminal-border px-3 py-2 text-[11px] font-mono text-white placeholder-terminal-muted focus:outline-none focus:bg-[#0d1a2a]"
      />
      {currentPrice !== undefined && (
        <span className="text-[11px] text-terminal-muted font-mono px-3 border-r border-terminal-border py-2">${currentPrice.toFixed(2)}</span>
      )}
      <button
        onClick={() => handleTrade('buy')}
        disabled={loading}
        className="px-5 py-2 bg-accent-blue hover:bg-blue-400 text-white text-[11px] font-bold disabled:opacity-50 transition-colors border-r border-terminal-border"
      >
        BUY
      </button>
      <button
        onClick={() => handleTrade('sell')}
        disabled={loading}
        className="px-5 py-2 bg-market-down hover:bg-red-400 text-white text-[11px] font-bold disabled:opacity-50 transition-colors border-r border-terminal-border"
      >
        SELL
      </button>
      {feedback && (
        <span className={`text-[11px] px-3 ${feedback.type === 'success' ? 'text-market-up' : 'text-market-down'}`}>
          {feedback.message}
        </span>
      )}
    </div>
  );
}
