export default function Home() {
  return (
    <>
      {/* Header — full-width top bar */}
      <header
        style={{
          gridArea: 'header',
          backgroundColor: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 24,
        }}
      >
        <span
          style={{
            color: '#ecad0a',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '0.05em',
          }}
        >
          FinAlly
        </span>
        <span style={{ color: '#8b949e', fontSize: 11 }}>
          AI Trading Workstation
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: '#30363d',
            letterSpacing: '0.1em',
          }}
        >
          LIVE
        </span>
      </header>

      {/* Watchlist placeholder */}
      <aside
        style={{
          gridArea: 'watch',
          backgroundColor: '#1a1a2e',
          borderRight: '1px solid #30363d',
          overflow: 'hidden',
        }}
      >
        <PlaceholderPanel label="WATCHLIST" phase="Phase 2" />
      </aside>

      {/* Main chart placeholder */}
      <main
        style={{
          gridArea: 'chart',
          backgroundColor: '#0d1117',
          overflow: 'hidden',
        }}
      >
        <PlaceholderPanel label="CHART" phase="Phase 2" />
      </main>

      {/* AI chat placeholder */}
      <aside
        style={{
          gridArea: 'chat',
          backgroundColor: '#1a1a2e',
          borderLeft: '1px solid #30363d',
          overflow: 'hidden',
        }}
      >
        <PlaceholderPanel label="AI CHAT" phase="Phase 4" />
      </aside>

      {/* Portfolio placeholder */}
      <section
        style={{
          gridArea: 'port',
          backgroundColor: '#1a1a2e',
          borderRight: '1px solid #30363d',
          borderTop: '1px solid #30363d',
          overflow: 'hidden',
        }}
      >
        <PlaceholderPanel label="PORTFOLIO" phase="Phase 3" />
      </section>
    </>
  )
}

function PlaceholderPanel({ label, phase }: { label: string; phase: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 4,
      }}
    >
      <span
        style={{
          color: '#30363d',
          fontSize: 11,
          letterSpacing: '0.2em',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span style={{ color: '#21262d', fontSize: 10 }}>— {phase} —</span>
    </div>
  )
}
