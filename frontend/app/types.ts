export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  change: number;
  change_percent: number;
  direction: 'up' | 'down' | 'flat';
  timestamp: string;
}

export interface WatchlistItem {
  ticker: string;
  price: number | null;
  previous_price: number | null;
  change_percent: number | null;
  direction: string | null;
  added_at: string;
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  pnl_percent: number;
}

export interface Portfolio {
  cash_balance: number;
  total_value: number;
  unrealized_pnl: number;
  positions: Position[];
}

export interface Trade {
  id: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  executed_at: string;
}

export interface PortfolioSnapshot {
  total_value: number;
  recorded_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  executed_trades?: Trade[];
  watchlist_results?: Array<{ticker: string; action: string}>;
  errors?: string[];
}

export interface SparklinePoint {
  time: number;
  value: number;
}
