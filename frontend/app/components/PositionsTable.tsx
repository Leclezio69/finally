'use client';
import type { Position, PriceUpdate } from '../types';

interface Props {
  positions: Position[];
  prices: Record<string, PriceUpdate>;
}

function formatQty(qty: number): string {
  // Up to 4 decimal places, trimming trailing zeros
  return parseFloat(qty.toFixed(4)).toString();
}

export default function PositionsTable({ positions, prices }: Props) {
  if (positions.length === 0) {
    return <div className="text-terminal-muted text-xs p-3">No open positions</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-terminal-muted border-b border-terminal-border">
            <th className="text-left px-3 py-1.5 font-medium">Ticker</th>
            <th className="text-right px-3 py-1.5 font-medium">Qty</th>
            <th className="text-right px-3 py-1.5 font-medium">Avg Cost</th>
            <th className="text-right px-3 py-1.5 font-medium">Current</th>
            <th className="text-right px-3 py-1.5 font-medium">P&L</th>
            <th className="text-right px-3 py-1.5 font-medium">P&L%</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(pos => {
            const live = prices[pos.ticker];
            const currentPrice = live?.price ?? pos.current_price;
            const positionValue = pos.quantity * currentPrice;
            const costBasis = pos.quantity * pos.avg_cost;
            const pnl = positionValue - costBasis;
            const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
            const isUp = pnl >= 0;

            return (
              <tr key={pos.ticker} className="border-b border-terminal-border hover:bg-terminal-bg transition-colors">
                <td className="px-3 py-1.5 font-bold text-white">{pos.ticker}</td>
                <td className="px-3 py-1.5 text-right font-mono">{formatQty(pos.quantity)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-terminal-muted">${pos.avg_cost.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-white">${currentPrice.toFixed(2)}</td>
                <td className={`px-3 py-1.5 text-right font-mono ${isUp ? 'text-market-up' : 'text-market-down'}`}>
                  {isUp ? '+' : ''}${pnl.toFixed(2)}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${isUp ? 'text-market-up' : 'text-market-down'}`}>
                  {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
