'use client';
import type { Trade } from '../types';

interface Props {
  trades: Trade[];
}

export default function TradeHistory({ trades }: Props) {
  if (trades.length === 0) {
    return <div className="text-terminal-muted text-xs p-3">No trades yet</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-terminal-muted border-b border-terminal-border">
            <th className="text-left px-3 py-1.5 font-medium">Ticker</th>
            <th className="text-left px-3 py-1.5 font-medium">Side</th>
            <th className="text-right px-3 py-1.5 font-medium">Qty</th>
            <th className="text-right px-3 py-1.5 font-medium">Price</th>
            <th className="text-right px-3 py-1.5 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(trade => (
            <tr key={trade.id} className="border-b border-terminal-border hover:bg-terminal-bg transition-colors">
              <td className="px-3 py-1.5 font-bold text-white">{trade.ticker}</td>
              <td className="px-3 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-white text-xs font-bold ${trade.side === 'buy' ? 'bg-accent-blue' : 'bg-market-down'}`}>
                  {trade.side.toUpperCase()}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right font-mono">{parseFloat(trade.quantity.toFixed(4))}</td>
              <td className="px-3 py-1.5 text-right font-mono">${trade.price.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-right text-terminal-muted">
                {new Date(trade.executed_at).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
