import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8001';

// ─── Chat Panel UI ────────────────────────────────────────────────────────────

// CHAT-01: Chat panel renders input and message area
test('Chat panel renders input and message area', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.waitForTimeout(1500);

  // Input field is present
  const inputCount = await page.locator('input[placeholder="Ask FinAlly..."]').count();
  expect(inputCount).toBeGreaterThan(0);

  // Empty state prompt is present
  const emptyStateCount = await page.locator('text=Ask FinAlly anything about your portfolio').count();
  expect(emptyStateCount).toBeGreaterThan(0);
});

// CHAT-02: Loading indicator appears while awaiting response
test('Loading indicator appears while awaiting response', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.waitForTimeout(1500);

  await page.locator('input[placeholder="Ask FinAlly..."]').fill('What is my portfolio worth?');
  await page.locator('button:has-text("Send")').click();

  // Loading spinner should appear before response arrives
  await page.locator('text=FinAlly is thinking...').waitFor({ timeout: 3000 });
});

// CHAT-03: Assistant message text is displayed after submit
test('Assistant message text is displayed after submit', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.waitForTimeout(1500);

  await page.locator('input[placeholder="Ask FinAlly..."]').fill('What is my portfolio worth?');
  await page.locator('button:has-text("Send")').click();

  // Wait for backend processing (LLM mock still requires some time)
  await page.waitForTimeout(8000);

  const assistantMsgCount = await page.locator('[data-role="assistant"]').count();
  expect(assistantMsgCount).toBeGreaterThan(0);
});

// CHAT-04: Trade chip appears for AI-executed trade (MOCK returns AAPL buy)
test('Trade chip appears for AI-executed trade', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.waitForTimeout(1500);

  await page.locator('input[placeholder="Ask FinAlly..."]').fill('What is my portfolio worth?');
  await page.locator('button:has-text("Send")').click();

  // Wait for response and chip rendering
  await page.waitForTimeout(8000);

  // BUY chip should appear — MOCK_RESPONSE includes AAPL buy trade
  await expect(page.locator('text=/BUY|SELL/')).toHaveCount(1);
});

// CHAT-05: Watchlist chip appears for AI watchlist change (MOCK adds COIN)
test('Watchlist chip appears for AI watchlist change', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.waitForTimeout(1500);

  // Remove COIN from watchlist beforehand so the mock add always triggers 'added'
  await page.request.delete(`${BASE}/api/watchlist/COIN`).catch(() => {});

  await page.locator('input[placeholder="Ask FinAlly..."]').fill('What is my portfolio worth?');
  await page.locator('button:has-text("Send")').click();

  // Wait for response and chip rendering
  await page.waitForTimeout(8000);

  // Watchlist chip should appear — MOCK_RESPONSE includes COIN add
  await expect(page.locator('text=/watchlist/i')).toHaveCount(1);
});

// CHAT-06: Collapse toggle hides and restores chat panel
test('Chat panel collapse toggle hides and restores panel', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.waitForTimeout(1500);

  // Input is initially visible
  expect(await page.locator('input[placeholder="Ask FinAlly..."]').isVisible()).toBe(true);

  // Click the collapse button
  await page.locator('button[title="Collapse chat"]').click();
  await page.waitForTimeout(300);

  // Input is hidden (panel collapsed to 40px, overflow hidden)
  expect(await page.locator('input[placeholder="Ask FinAlly..."]').isVisible()).toBe(false);

  // Click expand
  await page.locator('button[title="Expand chat"]').click();
  await page.waitForTimeout(300);

  // Input is visible again
  expect(await page.locator('input[placeholder="Ask FinAlly..."]').isVisible()).toBe(true);
});
