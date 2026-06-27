'use client';
import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

interface Props {
  onSendMessage: (message: string) => Promise<{ message: string; executed_trades?: unknown[]; watchlist_results?: unknown[]; errors?: string[] }>;
}

export default function ChatPanel({ onSendMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm FinAlly, your AI trading assistant. Ask me to analyze your portfolio, suggest trades, or execute orders on your behalf.",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const response = await onSendMessage(msg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.message,
        executed_trades: response.executed_trades as ChatMessage['executed_trades'],
        watchlist_results: response.watchlist_results as ChatMessage['watchlist_results'],
        errors: response.errors,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-terminal-surface border-l border-terminal-border">
      <div className="px-3 py-1.5 border-b border-terminal-border flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-accent-yellow tracking-widest uppercase">AI Assistant</h2>
        <span className="text-[9px] text-accent-purple uppercase tracking-widest">FinAlly</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-accent-purple text-white'
                : 'bg-terminal-bg text-white border border-terminal-border'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.executed_trades && msg.executed_trades.length > 0 && (
                <div className="mt-2 pt-2 border-t border-terminal-border">
                  <p className="text-terminal-muted mb-1">Executed:</p>
                  {msg.executed_trades.map((t, j) => {
                    const trade = t as { ticker: string; side: string; quantity: number; price: number };
                    return (
                      <div key={j} className="flex items-center gap-1">
                        <span className={`px-1 rounded text-white text-xs font-bold ${trade.side === 'buy' ? 'bg-accent-blue' : 'bg-market-down'}`}>
                          {trade.side.toUpperCase()}
                        </span>
                        <span>{trade.quantity} {trade.ticker} @ ${trade.price?.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {msg.errors && msg.errors.length > 0 && (
                <div className="mt-1 text-market-down text-xs">
                  {msg.errors.map((e, j) => <p key={j}>{e}</p>)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-muted">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-terminal-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask FinAlly..."
            disabled={loading}
            className="flex-1 bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-xs text-white placeholder-terminal-muted focus:outline-none focus:border-accent-purple disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-1.5 bg-accent-purple hover:bg-purple-600 text-white text-xs font-bold rounded disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
