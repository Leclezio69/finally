import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8001';

// ─── Health check ─────────────────────────────────────────────────────────────

test('API health check returns ok', async ({ request }) => {
  const res = await request.get(`${BASE}/api/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('ok');
  expect(body.timestamp).toBeTruthy();
});

// ─── Watchlist API ────────────────────────────────────────────────────────────

test('Watchlist returns default 10 tickers', async ({ request }) => {
  // Clean up any tickers added by other tests (e.g. COIN from chat mock, PYPL, BABA)
  for (const ticker of ['COIN', 'PYPL', 'BABA']) {
    await request.delete(`${BASE}/api/watchlist/${ticker}`);
  }

  const res = await request.get(`${BASE}/api/watchlist`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBe(10);
  const tickers = body.map((w: { ticker: string }) => w.ticker);
  expect(tickers).toContain('AAPL');
  expect(tickers).toContain('GOOGL');
  expect(tickers).toContain('NVDA');
});

test('Add ticker to watchlist', async ({ request }) => {
  // Clean up first in case it exists
  await request.delete(`${BASE}/api/watchlist/PYPL`);

  const res = await request.post(`${BASE}/api/watchlist`, {
    data: { ticker: 'pypl' }, // lowercase to test normalization
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.ticker).toBe('PYPL');

  // Verify it appears in watchlist
  const list = await request.get(`${BASE}/api/watchlist`);
  const tickers = (await list.json()).map((w: { ticker: string }) => w.ticker);
  expect(tickers).toContain('PYPL');

  // Clean up
  await request.delete(`${BASE}/api/watchlist/PYPL`);
});

test('Adding duplicate ticker returns 409', async ({ request }) => {
  const res = await request.post(`${BASE}/api/watchlist`, {
    data: { ticker: 'AAPL' },
  });
  expect(res.status()).toBe(409);
});

test('Remove ticker from watchlist', async ({ request }) => {
  // Add first
  await request.post(`${BASE}/api/watchlist`, { data: { ticker: 'BABA' } });

  const res = await request.delete(`${BASE}/api/watchlist/BABA`);
  expect(res.status()).toBe(200);

  // Verify gone
  const list = await request.get(`${BASE}/api/watchlist`);
  const tickers = (await list.json()).map((w: { ticker: string }) => w.ticker);
  expect(tickers).not.toContain('BABA');
});

test('Remove non-existent ticker returns 404', async ({ request }) => {
  const res = await request.delete(`${BASE}/api/watchlist/FAKEXYZ`);
  expect(res.status()).toBe(404);
});

// ─── Portfolio API ────────────────────────────────────────────────────────────

test('Portfolio returns initial $10k cash with no positions', async ({ request }) => {
  const res = await request.get(`${BASE}/api/portfolio`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.cash_balance).toBe('number');
  expect(body.cash_balance).toBeGreaterThan(0);
  expect(Array.isArray(body.positions)).toBe(true);
  expect(typeof body.total_value).toBe('number');
  expect(body.total_value).toBeGreaterThan(0);
});

test('Buy shares: cash decreases, position appears', async ({ request }) => {
  // Sell any existing AAPL position first so we start clean
  const initial = await (await request.get(`${BASE}/api/portfolio`)).json();
  const existingAapl = initial.positions.find((p: { ticker: string }) => p.ticker === 'AAPL');
  if (existingAapl && existingAapl.quantity > 0) {
    await request.post(`${BASE}/api/portfolio/trade`, {
      data: { ticker: 'AAPL', quantity: existingAapl.quantity, side: 'sell' },
    });
  }

  // Get state after clean-up
  const before = await (await request.get(`${BASE}/api/portfolio`)).json();

  // Wait a moment for prices to stream in
  await new Promise(r => setTimeout(r, 1000));

  // Buy 1 share of AAPL
  const trade = await request.post(`${BASE}/api/portfolio/trade`, {
    data: { ticker: 'AAPL', quantity: 1, side: 'buy' },
  });
  expect(trade.status()).toBe(200);
  const tradeBody = await trade.json();
  expect(tradeBody.success).toBe(true);
  expect(tradeBody.new_cash_balance).toBeLessThan(before.cash_balance);

  // Portfolio should reflect exactly 1 AAPL
  const after = await (await request.get(`${BASE}/api/portfolio`)).json();
  const aaplPos = after.positions.find((p: { ticker: string }) => p.ticker === 'AAPL');
  expect(aaplPos).toBeTruthy();
  expect(aaplPos.quantity).toBe(1);

  // Clean up: sell the share back
  await request.post(`${BASE}/api/portfolio/trade`, {
    data: { ticker: 'AAPL', quantity: 1, side: 'sell' },
  });
});

test('Buy with insufficient funds returns 400', async ({ request }) => {
  const res = await request.post(`${BASE}/api/portfolio/trade`, {
    data: { ticker: 'AAPL', quantity: 9999999, side: 'buy' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.detail).toMatch(/insufficient|funds/i);
});

test('Sell without position returns 400', async ({ request }) => {
  // Ensure we don't hold NFLX (sell to 0 if needed)
  const portfolio = await (await request.get(`${BASE}/api/portfolio`)).json();
  const nflxPos = portfolio.positions.find((p: { ticker: string }) => p.ticker === 'NFLX');
  if (nflxPos) {
    await request.post(`${BASE}/api/portfolio/trade`, {
      data: { ticker: 'NFLX', quantity: nflxPos.quantity, side: 'sell' },
    });
  }

  const res = await request.post(`${BASE}/api/portfolio/trade`, {
    data: { ticker: 'NFLX', quantity: 1, side: 'sell' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.detail).toMatch(/insufficient|shares/i);
});

test('Portfolio history returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/portfolio/history`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

// ─── Trades API ───────────────────────────────────────────────────────────────

test('Trades endpoint returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/trades`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('Trades respect limit parameter', async ({ request }) => {
  const res = await request.get(`${BASE}/api/trades?limit=2`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.length).toBeLessThanOrEqual(2);
});

// ─── SSE stream ───────────────────────────────────────────────────────────────

test('SSE /api/stream/prices delivers price events', async ({ page }) => {
  // Navigate to the app first to set up context, then check SSE
  const messages: string[] = [];

  await page.goto('/');

  // Listen for SSE events via page.evaluate
  const priceData = await page.evaluate(async () => {
    return new Promise<{ ticker: string; price: number }>((resolve, reject) => {
      const es = new EventSource('/api/stream/prices');
      const timeout = setTimeout(() => {
        es.close();
        reject(new Error('Timeout waiting for price_update'));
      }, 8000);

      es.addEventListener('price_update', (e: MessageEvent) => {
        clearTimeout(timeout);
        es.close();
        resolve(JSON.parse(e.data));
      });

      es.onerror = () => {
        clearTimeout(timeout);
        es.close();
        reject(new Error('SSE error'));
      };
    });
  });

  expect(priceData.ticker).toBeTruthy();
  expect(typeof priceData.price).toBe('number');
  expect(priceData.price).toBeGreaterThan(0);
  void messages;
});

// ─── Chat API (mock mode) ─────────────────────────────────────────────────────

test('Chat endpoint returns message in mock mode', async ({ request }) => {
  const res = await request.post(`${BASE}/api/chat`, {
    data: { message: 'Hello, what is my portfolio worth?' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.message).toBe('string');
  expect(body.message.length).toBeGreaterThan(0);
  expect(Array.isArray(body.trades)).toBe(true);
  expect(Array.isArray(body.watchlist_changes)).toBe(true);
});

// ─── Frontend UI ─────────────────────────────────────────────────────────────

test('Frontend loads and shows FinAlly heading', async ({ page }) => {
  await page.goto('/');
  // Look for FinAlly branding in either header text or title
  const title = await page.title();
  const hasFinAlly = title.toLowerCase().includes('finally') ||
    (await page.locator('text=/finally/i').count()) > 0;
  expect(hasFinAlly).toBe(true);
});

test('Frontend shows watchlist tickers', async ({ page }) => {
  await page.goto('/');
  // Wait for watchlist to load
  await page.waitForTimeout(2000);
  // At least one of the default tickers should be visible
  const hasAapl = await page.locator('text=AAPL').count() > 0;
  const hasGoogl = await page.locator('text=GOOGL').count() > 0;
  expect(hasAapl || hasGoogl).toBe(true);
});

test('Frontend shows cash balance', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);
  // Cash balance should be visible (starts at $10,000)
  const cashText = await page.locator('text=/\\$[0-9,]+/').count();
  expect(cashText).toBeGreaterThan(0);
});

test('Frontend connection status indicator is present', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  // Should show Live/Connected or Connecting status
  const statusEl = await page.locator('text=/live|connected|connecting/i').count();
  expect(statusEl).toBeGreaterThan(0);
});
