'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePriceStream } from './hooks/usePriceStream';
import ConnectionStatus from './components/ConnectionStatus';
import WatchlistPanel from './components/WatchlistPanel';
import MainChart from './components/MainChart';
import PortfolioHeatmap from './components/PortfolioHeatmap';
import PnLChart from './components/PnLChart';
import PositionsTable from './components/PositionsTable';
import TradeHistory from './components/TradeHistory';
import TradeBar from './components/TradeBar';
import ChatPanel from './components/ChatPanel';
import {
  fetchWatchlist, addToWatchlist, removeFromWatchlist,
  fetchPortfolio, executeTrade, fetchPortfolioHistory,
  fetchTrades, sendChatMessage,
} from './api-client';
import type { WatchlistItem, Portfolio, Trade, PortfolioSnapshot } from './types';

export default function Home() {
  const { prices, sparklines, connectionStatus, flashMap } = usePriceStream();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const loadWatchlist = useCallback(async () => {
    try { setWatchlist(await fetchWatchlist()); } catch { /* ignore */ }
  }, []);

  const loadPortfolio = useCallback(async () => {
    try { setPortfolio(await fetchPortfolio()); } catch { /* ignore */ }
  }, []);

  const loadTrades = useCallback(async () => {
    try { setTrades(await fetchTrades()); } catch { /* ignore */ }
  }, []);

  const loadHistory = useCallback(async () => {
    try { setHistory(await fetchPortfolioHistory()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadWatchlist();
    loadPortfolio();
    loadTrades();
    loadHistory();
    const historyInterval = setInterval(loadHistory, 30000);
    const portfolioInterval = setInterval(loadPortfolio, 5000);
    return () => {
      clearInterval(historyInterval);
      clearInterval(portfolioInterval);
    };
  }, [loadWatchlist, loadPortfolio, loadTrades, loadHistory]);

  // Compute live total value from prices
  const liveTotal = (() => {
    if (!portfolio) return null;
    let total = portfolio.cash_balance;
    for (const pos of portfolio.positions) {
      const price = prices[pos.ticker]?.price ?? pos.current_price;
      total += pos.quantity * price;
    }
    return total;
  })();

  const handleAddTicker = async (ticker: string) => {
    await addToWatchlist(ticker);
    await loadWatchlist();
  };

  const handleRemoveTicker = async (ticker: string) => {
    await removeFromWatchlist(ticker);
    await loadWatchlist();
    if (selectedTicker === ticker) setSelectedTicker(null);
  };

  const handleTrade = async (ticker: string, qty: number, side: 'buy' | 'sell') => {
    await executeTrade(ticker, qty, side);
    await Promise.all([loadPortfolio(), loadTrades()]);
  };

  const handleChat = async (message: string) => {
    const response = await sendChatMessage(message);
    // Refresh state after potential trades/watchlist changes
    await Promise.all([loadPortfolio(), loadWatchlist(), loadTrades()]);
    return response;
  };

  const selectedSparkline = selectedTicker ? (sparklines[selectedTicker] || []) : [];
  const selectedPrice = selectedTicker ? (prices[selectedTicker]?.price ?? null) : null;

  return (
    <div className="h-screen flex flex-col bg-terminal-bg text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-terminal-surface border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-accent-yellow font-bold text-lg tracking-wider">FIN<span className="text-accent-blue">ALLY</span></h1>
          <span className="text-terminal-muted text-xs">AI Trading Workstation</span>
        </div>
        <div className="flex items-center gap-6">
          {liveTotal !== null && (
            <div className="text-center">
              <div className="text-xs text-terminal-muted">Portfolio</div>
              <div className={`font-mono font-bold text-sm ${liveTotal >= 10000 ? 'text-market-up' : 'text-market-down'}`}>
                ${liveTotal.toFixed(2)}
              </div>
            </div>
          )}
          {portfolio && (
            <div className="text-center">
              <div className="text-xs text-terminal-muted">Cash</div>
              <div className="font-mono text-sm text-white">${portfolio.cash_balance.toFixed(2)}</div>
            </div>
          )}
          <ConnectionStatus status={connectionStatus} />
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Watchlist */}
        <div className="w-52 flex-shrink-0 overflow-hidden">
          <WatchlistPanel
            watchlist={watchlist}
            prices={prices}
            flashMap={flashMap}
            sparklines={sparklines}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onAddTicker={handleAddTicker}
            onRemoveTicker={handleRemoveTicker}
          />
        </div>

        {/* Center: Charts + Portfolio */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-terminal-border">
          {/* Main chart */}
          <div className="h-48 flex-shrink-0 border-b border-terminal-border">
            <MainChart
              ticker={selectedTicker}
              data={selectedSparkline}
              currentPrice={selectedPrice}
            />
          </div>

          {/* Heatmap + P&L */}
          <div className="flex flex-1 overflow-hidden border-b border-terminal-border">
            <div className="flex-1 border-r border-terminal-border p-2">
              <div className="text-xs text-terminal-muted mb-1 uppercase tracking-wider">Portfolio Heatmap</div>
              <div className="h-[calc(100%-20px)]">
                <PortfolioHeatmap positions={portfolio?.positions || []} prices={prices} />
              </div>
            </div>
            <div className="flex-1 p-2">
              <div className="text-xs text-terminal-muted mb-1 uppercase tracking-wider">P&L Chart</div>
              <div className="h-[calc(100%-20px)]">
                <PnLChart data={history} />
              </div>
            </div>
          </div>

          {/* Positions + Trades */}
          <div className="flex flex-shrink-0 max-h-40 overflow-hidden border-b border-terminal-border">
            <div className="flex-1 border-r border-terminal-border overflow-auto">
              <div className="text-xs text-terminal-muted px-3 pt-2 pb-1 uppercase tracking-wider">Positions</div>
              <PositionsTable positions={portfolio?.positions || []} prices={prices} />
            </div>
            <div className="flex-1 overflow-auto">
              <div className="text-xs text-terminal-muted px-3 pt-2 pb-1 uppercase tracking-wider">Trade History</div>
              <TradeHistory trades={trades} />
            </div>
          </div>

          {/* Trade Bar */}
          <TradeBar onTrade={handleTrade} prices={prices} selectedTicker={selectedTicker} />
        </div>

        {/* Right: Chat */}
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <ChatPanel onSendMessage={handleChat} />
        </div>
      </div>
    </div>
  );
}
