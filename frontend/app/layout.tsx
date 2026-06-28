import type { Metadata } from 'next'
import './globals.css'
import { PriceProvider } from './providers/PriceContext'
import { WatchlistProvider } from './providers/WatchlistContext'
import { PortfolioProvider } from './providers/PortfolioContext'

export const metadata: Metadata = {
  title: 'FinAlly — AI Trading Workstation',
  description: 'Live market data, portfolio management, and AI-powered trading',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="overflow-hidden" style={{ margin: 0, padding: 0, height: '100vh', backgroundColor: '#0d1117', color: '#e6edf3' }}>
        <PriceProvider>
          <WatchlistProvider>
            <PortfolioProvider>
            <div
              style={{
                display: 'grid',
                gridTemplateAreas: `
                  "header header header"
                  "watch  chart  chat"
                  "port   chart  chat"
                `,
                gridTemplateColumns: '280px 1fr 320px',
                gridTemplateRows: '48px 1fr 1fr',
                height: '100vh',
                overflow: 'hidden',
              }}
            >
              {children}
            </div>
            </PortfolioProvider>
          </WatchlistProvider>
        </PriceProvider>
      </body>
    </html>
  )
}
