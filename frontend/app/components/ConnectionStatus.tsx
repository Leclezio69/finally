'use client';

interface Props {
  status: 'connected' | 'connecting' | 'disconnected';
}

const statusConfig = {
  connected: { color: 'bg-market-up', label: 'Live' },
  connecting: { color: 'bg-yellow-400', label: 'Connecting' },
  disconnected: { color: 'bg-market-down', label: 'Disconnected' },
};

export default function ConnectionStatus({ status }: Props) {
  const { color, label } = statusConfig[status];
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`w-2 h-2 rounded-full ${color} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-terminal-muted">{label}</span>
    </div>
  );
}
