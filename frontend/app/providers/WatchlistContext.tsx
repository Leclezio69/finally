'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { PriceContext } from './PriceContext'

export type WatchlistContextValue = {
  tickers: string[]
  selectedTicker: string | null
  setSelectedTicker: (ticker: string) => void
  priceHistory: Record<string, number[]>
  firstPrice: Record<string, number>
  addTicker: (ticker: string) => Promise<void>
  removeTicker: (ticker: string) => Promise<void>
  refetchWatchlist: () => Promise<void>
}

export const WatchlistContext = createContext<WatchlistContextValue>({
  tickers: [],
  selectedTicker: null,
  setSelectedTicker: () => {},
  priceHistory: {},
  firstPrice: {},
  addTicker: async () => {},
  removeTicker: async () => {},
  refetchWatchlist: async () => {},
})

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { prices } = useContext(PriceContext)

  const [tickers, setTickers] = useState<string[]>([])
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const priceHistoryRef = useRef<Record<string, number[]>>({})
  const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({})
  const firstPriceRef = useRef<Record<string, number>>({})
  const [firstPrice, setFirstPrice] = useState<Record<string, number>>({})

  const refetchWatchlist = useCallback(async () => {
    try {
      const resp = await fetch('/api/watchlist')
      const data = (await resp.json()) as Array<{ ticker: string }>
      const list = data.map((t) => t.ticker)
      setTickers(list)
      if (list.length > 0 && !selectedTicker) {
        setSelectedTicker(list[0])
      }
    } catch {
      // Silently fail
    }
  }, [selectedTicker])

  // Effect 1 — mount fetch: load watchlist from API and auto-select first ticker
  useEffect(() => {
    refetchWatchlist()
  }, [refetchWatchlist])

  // Effect 2 — price history accumulation: ring buffer (D-03: 100-point cap)
  useEffect(() => {
    const updated: Record<string, number[]> = { ...priceHistoryRef.current }
    let changed = false
    let firstPriceChanged = false

    for (const [ticker, update] of Object.entries(prices)) {
      // Accumulate ring buffer
      const prev = updated[ticker] ?? []
      const next = [...prev, update.price].slice(-100)
      updated[ticker] = next
      changed = true

      // Track first-ever price per ticker (never overwrite once set — D-02 baseline)
      if (!firstPriceRef.current[ticker]) {
        firstPriceRef.current[ticker] = update.price
        firstPriceChanged = true
      }
    }

    if (changed) {
      priceHistoryRef.current = updated
      setPriceHistory({ ...updated })
    }

    if (firstPriceChanged) {
      setFirstPrice({ ...firstPriceRef.current })
    }
  }, [prices])

  async function addTicker(ticker: string): Promise<void> {
    const uppercased = ticker.toUpperCase()
    const resp = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: uppercased }),
    })
    if (!resp.ok) throw new Error(await resp.text())
    setTickers((prev) => [...prev, uppercased])
  }

  async function removeTicker(ticker: string): Promise<void> {
    await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' })
    setTickers((prev) => {
      const remaining = prev.filter((t) => t !== ticker)
      if (selectedTicker === ticker) {
        setSelectedTicker(remaining[0] ?? null)
      }
      return remaining
    })
  }

  return (
    <WatchlistContext.Provider
      value={{
        tickers,
        selectedTicker,
        setSelectedTicker,
        priceHistory,
        firstPrice,
        addTicker,
        removeTicker,
        refetchWatchlist,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  )
}

/** Access the full watchlist context: tickers, selected ticker, price history, add/remove */
export function useWatchlist(): WatchlistContextValue {
  return useContext(WatchlistContext)
}
