'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { PriceContext } from './PriceContext'

export type Position = {
  ticker: string
  quantity: number
  avg_cost: number
  current_price: number
  unrealized_pnl: number
  pnl_percent: number
}

export type Trade = {
  id: string
  ticker: string
  side: string
  quantity: number
  price: number
  executed_at: string
}

export type Snapshot = {
  total_value: number
  recorded_at: string
}

export type PortfolioContextValue = {
  positions: Position[]
  cashBalance: number
  totalValue: number
  trades: Trade[]
  history: Snapshot[]
  executeTrade: (ticker: string, quantity: number, side: 'buy' | 'sell') => Promise<string | null>
  refetchPortfolio: () => Promise<void>
}

export const PortfolioContext = createContext<PortfolioContextValue>({
  positions: [],
  cashBalance: 0,
  totalValue: 0,
  trades: [],
  history: [],
  executeTrade: async () => null,
  refetchPortfolio: async () => {},
})

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const { prices } = useContext(PriceContext)

  const [positions, setPositions] = useState<Position[]>([])
  const [cashBalance, setCashBalance] = useState(0)
  const [trades, setTrades] = useState<Trade[]>([])
  const [history, setHistory] = useState<Snapshot[]>([])

  const refetchAll = useCallback(async () => {
    try {
      const [portResp, tradesResp, histResp] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/trades'),
        fetch('/api/portfolio/history'),
      ])
      if (portResp.ok) {
        const port = (await portResp.json()) as { cash_balance: number; positions: Position[] }
        setPositions(port.positions)
        setCashBalance(port.cash_balance)
      }
      if (tradesResp.ok) {
        const t = (await tradesResp.json()) as Trade[]
        setTrades(t)
      }
      if (histResp.ok) {
        const h = (await histResp.json()) as Snapshot[]
        setHistory(h)
      }
    } catch {
      // Silently fail — state remains at last known values
    }
  }, [])

  useEffect(() => {
    refetchAll()
  }, [refetchAll])

  // Live totalValue recalculated from SSE prices + cached positions (never polls API)
  const totalValue = useMemo(() => {
    const positionsValue = positions.reduce((sum, pos) => {
      const currentPrice = prices[pos.ticker]?.price ?? pos.current_price
      return sum + pos.quantity * currentPrice
    }, 0)
    return positionsValue + cashBalance
  }, [positions, cashBalance, prices])

  const executeTrade = useCallback(
    async (ticker: string, quantity: number, side: 'buy' | 'sell'): Promise<string | null> => {
      try {
        const resp = await fetch('/api/portfolio/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: ticker.toUpperCase(), quantity, side }),
        })
        if (resp.ok) {
          await refetchAll()
          return null
        }
        try {
          const errBody = (await resp.json()) as { detail?: string }
          return errBody.detail ?? 'Trade failed. Try again.'
        } catch {
          return 'Trade failed. Try again.'
        }
      } catch {
        return 'Trade failed. Try again.'
      }
    },
    [refetchAll],
  )

  return (
    <PortfolioContext.Provider
      value={{ positions, cashBalance, totalValue, trades, history, executeTrade, refetchPortfolio: refetchAll }}
    >
      {children}
    </PortfolioContext.Provider>
  )
}

/** Access the full portfolio context: positions, cash, total value, trades, history, executeTrade */
export function usePortfolio(): PortfolioContextValue {
  return useContext(PortfolioContext)
}
