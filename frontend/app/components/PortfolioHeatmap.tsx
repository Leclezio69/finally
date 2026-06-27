'use client';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { Position, PriceUpdate } from '../types';

interface Props {
  positions: Position[];
  prices: Record<string, PriceUpdate>;
}

function pnlColor(pct: number): string {
  if (pct > 5) return '#1a7f37';
  if (pct > 2) return '#2ea043';
  if (pct > 0) return '#3fb950';
  if (pct > -2) return '#da3633';
  if (pct > -5) return '#f85149';
  return '#ff7b72';
}

interface TreemapEntry {
  name: string;
  size: number;
  pnlPct: number;
  pnl: number;
  fill: string;
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomContent(props: any) {
  const { x, y, width, height, name, pnlPct, fill } = props;
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#0d1117" strokeWidth={2} rx={3} />
      {width > 50 && height > 30 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="white" fontSize={12} fontWeight="bold">
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct?.toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
}

export default function PortfolioHeatmap({ positions, prices }: Props) {
  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-terminal-muted text-sm">
        No positions
      </div>
    );
  }

  const data: TreemapEntry[] = positions.map(pos => {
    const price = prices[pos.ticker]?.price ?? pos.current_price;
    const value = pos.quantity * price;
    const pnlPct = pos.pnl_percent;
    return {
      name: pos.ticker,
      size: Math.max(value, 1),
      pnlPct,
      pnl: pos.unrealized_pnl,
      fill: pnlColor(pnlPct),
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={data}
        dataKey="size"
        aspectRatio={4 / 3}
        content={<CustomContent />}
      >
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload as TreemapEntry;
            return (
              <div className="bg-terminal-surface border border-terminal-border rounded px-2 py-1 text-xs">
                <div className="font-bold text-white">{d.name}</div>
                <div className={d.pnl >= 0 ? 'text-market-up' : 'text-market-down'}>
                  P&L: ${d.pnl.toFixed(2)} ({d.pnlPct >= 0 ? '+' : ''}{d.pnlPct.toFixed(2)}%)
                </div>
              </div>
            );
          }}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
