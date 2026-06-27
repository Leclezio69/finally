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
    try {
      const wl = await fetchWatchlist();
      setWatchlist(wl);
      // Auto-select first ticker if none selected
      setSelectedTicker(prev => prev ?? (wl[0]?.ticker ?? null));
    } catch { /* ignore */ }
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
      <header className="flex items-center justify-between px-4 py-1.5 bg-terminal-surface border-b border-terminal-border flex-shrink-0" style={{borderBottomColor: '#ecad0a22'}}>
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-base tracking-[0.2em]" style={{fontFamily: "'IBM Plex Sans Condensed', sans-serif", letterSpacing: '0.15em'}}>
            <span className="text-accent-yellow">FIN</span><span className="text-accent-blue">ALLY</span>
          </h1>
          <span className="text-terminal-muted text-[10px] tracking-widest uppercase border-l border-terminal-border pl-4">AI Trading Workstation</span>
        </div>
        <div className="flex items-center gap-5">
          {liveTotal !== null && (() => {
            const pnl = liveTotal - 10000;
            const pnlPct = (pnl / 10000) * 100;
            return (
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-[9px] text-terminal-muted uppercase tracking-widest">Portfolio Value</div>
                  <div className={`font-mono font-bold text-sm ${liveTotal >= 10000 ? 'text-market-up' : 'text-market-down'}`}>
                    ${liveTotal.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-terminal-muted uppercase tracking-widest">P&L</div>
                  <div className={`font-mono text-sm ${pnl >= 0 ? 'text-market-up' : 'text-market-down'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} <span className="text-[10px]">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
                  </div>
                </div>
              </div>
            );
          })()}
          {portfolio && (
            <div>
              <div className="text-[9px] text-terminal-muted uppercase tracking-widest">Cash</div>
              <div className="font-mono text-sm text-white">${portfolio.cash_balance.toFixed(2)}</div>
            </div>
          )}
          <ConnectionStatus status={connectionStatus} />
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Watchlist */}
        <div className="w-56 flex-shrink-0 overflow-hidden">
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
            <div className="flex-1 border-r border-terminal-border flex flex-col">
              <div className="text-[9px] text-terminal-muted px-3 py-1.5 uppercase tracking-widest border-b border-terminal-border">Portfolio Heatmap</div>
              <div className="flex-1">
                <PortfolioHeatmap positions={portfolio?.positions || []} prices={prices} />
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="text-[9px] text-terminal-muted px-3 py-1.5 uppercase tracking-widest border-b border-terminal-border">P&L Chart</div>
              <div className="flex-1">
                <PnLChart data={history} />
              </div>
            </div>
          </div>

          {/* Positions + Trades */}
          <div className="flex flex-shrink-0 max-h-36 overflow-hidden border-b border-terminal-border">
            <div className="flex-1 border-r border-terminal-border overflow-auto flex flex-col">
              <div className="text-[9px] text-terminal-muted px-3 py-1 uppercase tracking-widest border-b border-terminal-border sticky top-0 bg-terminal-surface">Positions</div>
              <PositionsTable positions={portfolio?.positions || []} prices={prices} />
            </div>
            <div className="flex-1 overflow-auto flex flex-col">
              <div className="text-[9px] text-terminal-muted px-3 py-1 uppercase tracking-widest border-b border-terminal-border sticky top-0 bg-terminal-surface">Trade History</div>
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
