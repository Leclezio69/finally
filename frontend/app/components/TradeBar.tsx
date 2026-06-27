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
    <div className="flex items-center gap-2 px-3 py-2 bg-terminal-surface border-t border-terminal-border">
      <input
        type="text"
        value={ticker}
        onChange={e => setTicker(e.target.value.toUpperCase())}
        placeholder={selectedTicker || 'TICKER'}
        className="w-24 bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-sm font-bold text-white placeholder-terminal-muted focus:outline-none focus:border-accent-blue uppercase"
      />
      <input
        type="number"
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
        placeholder="Qty"
        min="0"
        step="any"
        className="w-24 bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-sm font-mono text-white placeholder-terminal-muted focus:outline-none focus:border-accent-blue"
      />
      {currentPrice !== undefined && (
        <span className="text-xs text-terminal-muted font-mono">${currentPrice.toFixed(2)}</span>
      )}
      <button
        onClick={() => handleTrade('buy')}
        disabled={loading}
        className="px-4 py-1.5 bg-accent-blue hover:bg-blue-400 text-white text-sm font-bold rounded disabled:opacity-50 transition-colors"
      >
        BUY
      </button>
      <button
        onClick={() => handleTrade('sell')}
        disabled={loading}
        className="px-4 py-1.5 bg-market-down hover:bg-red-400 text-white text-sm font-bold rounded disabled:opacity-50 transition-colors"
      >
        SELL
      </button>
      {feedback && (
        <span className={`text-xs ${feedback.type === 'success' ? 'text-market-up' : 'text-market-down'}`}>
          {feedback.message}
        </span>
      )}
    </div>
  );
}
