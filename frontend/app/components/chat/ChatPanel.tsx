'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePortfolio } from '../../providers/PortfolioContext'
import { useWatchlist } from '../../providers/WatchlistContext'

// ─── Local Types ──────────────────────────────────────────────────────────────

type ActionChip =
  | { kind: 'trade'; ticker: string; side: string; quantity: number; price: number }
  | { kind: 'watchlist'; ticker: string; action: string }
  | { kind: 'error'; text: string }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  chips?: ActionChip[]
}

type ChatApiResponse = {
  message: string
  trades: { ticker: string; side: string; quantity: number }[]
  watchlist_changes: { ticker: string; action: string }[]
  executed_trades: {
    id: string
    ticker: string
    side: string
    quantity: number
    price: number
    executed_at: string
  }[]
  watchlist_results: { ticker: string; action: string }[]
  errors: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const { refetchPortfolio } = usePortfolio()
  const { refetchWatchlist } = useWatchlist()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = (await resp.json()) as ChatApiResponse

      // Build chips: trade chips from executed_trades (NOT trades), watchlist chips from watchlist_results
      const chips: ActionChip[] = []

      for (const t of data.executed_trades ?? []) {
        chips.push({ kind: 'trade', ticker: t.ticker, side: t.side, quantity: t.quantity, price: t.price })
      }
      for (const w of data.watchlist_results ?? []) {
        chips.push({ kind: 'watchlist', ticker: w.ticker, action: w.action })
      }
      for (const e of data.errors ?? []) {
        chips.push({ kind: 'error', text: e })
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.message,
        chips: chips.length > 0 ? chips : undefined,
      }
      setMessages((prev) => [...prev, assistantMsg])

      await refetchPortfolio()
      await refetchWatchlist()
    } catch {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Connection error. Please try again.',
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, refetchPortfolio, refetchWatchlist])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 32,
          flexShrink: 0,
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          backgroundColor: '#161b22',
        }}
      >
        <span
          style={{
            color: '#8b949e',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.15em',
          }}
        >
          AI CHAT
        </span>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#30363d',
              fontSize: 11,
              textAlign: 'center',
              padding: '0 16px',
            }}
          >
            Ask FinAlly anything about your portfolio
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              data-role={msg.role}
              style={{
                padding: '6px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: '#8b949e',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  marginBottom: 2,
                }}
              >
                {msg.role === 'user' ? 'YOU' : 'FINALLY'}
              </span>
              <div
                style={{
                  backgroundColor: msg.role === 'user' ? '#161b22' : undefined,
                  padding: msg.role === 'user' ? '6px 10px' : undefined,
                  maxWidth: '90%',
                }}
              >
                <span style={{ fontSize: 12, color: '#e6edf3', lineHeight: 1.5 }}>
                  {msg.text}
                </span>

                {/* Action chips */}
                {msg.chips && msg.chips.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      paddingTop: 4,
                    }}
                  >
                    {msg.chips.map((chip, i) => {
                      if (chip.kind === 'trade') {
                        const isBuy = chip.side === 'buy'
                        return (
                          <span
                            key={i}
                            style={{
                              display: 'inline-flex',
                              border: `1px solid ${isBuy ? '#22c55e' : '#ef4444'}`,
                              backgroundColor: isBuy
                                ? 'rgba(34,197,94,0.15)'
                                : 'rgba(239,68,68,0.15)',
                              color: isBuy ? '#22c55e' : '#ef4444',
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 2,
                              fontWeight: 600,
                            }}
                          >
                            {chip.side.toUpperCase()} {chip.quantity} {chip.ticker} @ ${chip.price.toFixed(2)}
                          </span>
                        )
                      }
                      if (chip.kind === 'watchlist') {
                        return (
                          <span
                            key={i}
                            style={{
                              display: 'inline-flex',
                              border: '1px solid #209dd7',
                              backgroundColor: 'rgba(32,157,215,0.15)',
                              color: '#209dd7',
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 2,
                            }}
                          >
                            {chip.action === 'added' ? '+' : '\u2212'} {chip.ticker} watchlist
                          </span>
                        )
                      }
                      // error chip
                      return (
                        <span
                          key={i}
                          style={{
                            display: 'inline-flex',
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 2,
                          }}
                        >
                          {chip.text}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              color: '#8b949e',
              fontSize: 11,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                border: '2px solid #30363d',
                borderTop: '2px solid #209dd7',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            FinAlly is thinking...
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid #30363d',
          padding: 8,
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSubmit()
            }
          }}
          disabled={isLoading}
          placeholder="Ask FinAlly..."
          style={{
            flex: 1,
            height: 28,
            background: '#0d1117',
            border: '1px solid #30363d',
            color: '#e6edf3',
            fontSize: 13,
            paddingLeft: 8,
            borderRadius: 0,
            outline: 'none',
          }}
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={isLoading}
          style={{
            backgroundColor: '#753991',
            color: '#e6edf3',
            border: 'none',
            height: 28,
            padding: '0 12px',
            fontSize: 12,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            borderRadius: 0,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
