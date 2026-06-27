'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { PortfolioSnapshot } from '../types';

interface Props {
  data: PortfolioSnapshot[];
  initialValue?: number;
}

export default function PnLChart({ data, initialValue = 10000 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-terminal-muted text-sm">
        No history yet
      </div>
    );
  }

  const chartData = data.map(d => ({
    time: new Date(d.recorded_at).toLocaleTimeString(),
    value: d.total_value,
  }));

  const minVal = Math.min(...data.map(d => d.total_value));
  const maxVal = Math.max(...data.map(d => d.total_value));
  const padding = (maxVal - minVal) * 0.1 || 100;

  const latestValue = data[data.length - 1]?.total_value ?? initialValue;
  const isProfit = latestValue >= initialValue;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <XAxis dataKey="time" tick={{ fill: '#8b949e', fontSize: 9 }} interval="preserveStartEnd" />
        <YAxis
          domain={[minVal - padding, maxVal + padding]}
          tick={{ fill: '#8b949e', fontSize: 9 }}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          width={65}
        />
        <Tooltip
          contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 4, fontSize: 11 }}
          labelStyle={{ color: '#8b949e' }}
          formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Value']}
        />
        <ReferenceLine y={initialValue} stroke="#21262d" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="value"
          stroke={isProfit ? '#3fb950' : '#f85149'}
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
