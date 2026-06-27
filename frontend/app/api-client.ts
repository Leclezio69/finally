export async function fetchWatchlist() {
  const res = await fetch('/api/watchlist');
  if (!res.ok) throw new Error('Failed to fetch watchlist');
  return res.json();
}

export async function addToWatchlist(ticker: string) {
  const res = await fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Failed to add ticker');
  }
  return res.json();
}

export async function removeFromWatchlist(ticker: string) {
  const res = await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove ticker');
  return res.json();
}

export async function fetchPortfolio() {
  const res = await fetch('/api/portfolio');
  if (!res.ok) throw new Error('Failed to fetch portfolio');
  return res.json();
}

export async function executeTrade(ticker: string, quantity: number, side: 'buy' | 'sell') {
  const res = await fetch('/api/portfolio/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, quantity, side }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Trade failed');
  return data;
}

export async function fetchPortfolioHistory() {
  const res = await fetch('/api/portfolio/history');
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function fetchTrades(limit = 50) {
  const res = await fetch(`/api/trades?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch trades');
  return res.json();
}

export async function sendChatMessage(message: string) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Chat failed');
  return res.json();
}
