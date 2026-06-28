'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type PriceUpdate = {
  ticker: string
  price: number
  previous_price: number
  change: number
  change_percent: number
  direction: 'up' | 'down' | 'flat'
  timestamp: string
}

type PriceContextValue = {
  prices: Record<string, PriceUpdate>
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
}

export const PriceContext = createContext<PriceContextValue>({
  prices: {},
  status: 'connecting',
})

export function PriceProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({})
  const [status, setStatus] = useState<PriceContextValue['status']>('connecting')

  useEffect(() => {
    const es = new EventSource('/api/stream/prices')

    es.onopen = () => setStatus('connected')

    es.onerror = () => {
      // Native EventSource handles reconnection automatically with exponential backoff
      setStatus('reconnecting')
    }

    // Named event — backend emits: event: price_update\ndata: {...}
    es.addEventListener('price_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as PriceUpdate
        setPrices((prev) => ({ ...prev, [data.ticker]: data }))
      } catch {
        // Malformed SSE data — skip silently
      }
    })

    return () => {
      es.close()
    }
  }, [])

  return (
    <PriceContext.Provider value={{ prices, status }}>
      {children}
    </PriceContext.Provider>
  )
}

/** Subscribe to the latest price update for a specific ticker */
export function usePrice(ticker: string): PriceUpdate | undefined {
  const { prices } = useContext(PriceContext)
  return prices[ticker]
}

/** Subscribe to the SSE connection status */
export function usePriceStatus(): PriceContextValue['status'] {
  return useContext(PriceContext).status
}
