import { test, expect } from "@playwright/test";
const candles = Array.from({ length: 100 }, (_, i) => ({
  time: 1750000000 + i * 86400,
  open: 100 + i,
  high: 104 + i,
  low: 99 + i,
  close: 102 + i,
  volume: 1000,
}));
test.beforeEach(async ({ page }) => {
  await page.route("**/api/market/**/candles*", async (route) =>
    route.fulfill({
      json: {
        symbol: decodeURIComponent(
          route.request().url().split("/market/")[1].split("/candles")[0],
        ),
        interval: new URL(route.request().url()).searchParams.get("interval") || "1d",
        market: "stock",
        price: 201,
        change: 1,
        timestamp: new Date().toISOString(),
        market_timestamp: new Date().toISOString(),
        source: "automated test boundary",
        stale: false,
        candles,
        indicators: {
          latest: {
            rsi14: 60,
            macd_histogram: 0.5,
            atr14: 4,
            volume_ratio: 1,
            trend: "bullish",
          },
          series: {
            ema21: candles.map((c) => ({ time: c.time, value: c.close - 3 })),
            ema50: candles.map((c) => ({ time: c.time, value: c.close - 6 })),
          },
        },
      },
    }),
  );
});
test("landing and terminal navigation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The market, decoded in real time." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Launch Terminal", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("chart")).toBeVisible();
  await expect(page.getByTestId("agent-panel")).toBeVisible();
  await page.getByRole("button", { name: /AAPL.*Apple/ }).click();
  await expect(
    page.getByRole("heading", { name: "AAPL", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crypto", exact: true }).click();
  await page.getByRole("button", { name: /BTC.*Bitcoin/ }).click();
  await expect(
    page.getByRole("heading", { name: "BTC", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Research Council/ }).click();
  await expect(
    page.getByTestId("agent-panel").getByText("Bull Researcher", { exact: true }).first(),
  ).toBeVisible();
});
for (const [route, heading] of [
  ["portfolio", "Portfolio intelligence."],
  ["decisions", "Every decision. Every reason."],
  ["source", "Inspect the system."],
  ["council", "Independent views. One accountable decision."],
])
  test(route + " loads", async ({ page }) => {
    await page.goto("/" + route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    expect(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
    ).toBeTruthy();
  });
for (const width of [1440, 1280, 1024, 768, 390])
  test("responsive " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/terminal");
    await expect(page.getByTestId("chart")).toBeVisible();
    expect(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
    ).toBeTruthy();
    if (width === 390) {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await page.getByRole("link", { name: "Portfolio", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Portfolio intelligence." }),
      ).toBeVisible();
    }
  });
test("decision detail renders explicit records", async ({ page }) => {
  await page.route("**/api/decisions/test-record", (r) =>
    r.fulfill({
      json: {
        id: "test-record",
        run_id: "test",
        symbol: "AAPL",
        market: "stock",
        timestamp: new Date().toISOString(),
        action: "BUY",
        confidence: 0.8,
        summary: "Explicit test conclusion",
        requested_allocation: 0.1,
        approved_allocation: 0.1,
        reference_price: 100,
        risk_flags: [],
        execution: "filled",
        execution_reason: null,
        sources: [],
        market_view: "**Verified price structure**\n\n- First evidence\n- Second evidence\n\n| Metric | Value |\n| --- | --- |\n| RSI | 60 |",
        fundamental_view: "Financial evidence",
        news_view: "News unavailable",
        sentiment_view: "Social data unavailable",
        bull_case: "Bull report",
        bear_case: "Bear report",
        research_conclusion: "Synthesis",
        risk_conclusion: "Risk checks",
        portfolio_conclusion: "Modest paper allocation",
      },
    }),
  );
  await page.goto("/decisions/test-record");
  await expect(page.getByRole("heading", { name: "AAPL / BUY" })).toBeVisible();
  await expect(
    page.getByText("Verified price structure", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".report-markdown strong", { hasText: "Verified price structure" })).toBeVisible();
  await expect(page.locator(".report-markdown li", { hasText: "First evidence" })).toBeVisible();
  await expect(page.locator(".report-markdown table")).toBeVisible();
  await expect(
    page.getByText("Modest paper allocation", { exact: true }),
  ).toBeVisible();
});

test("landing respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".ticker-track")).toHaveCSS("animation-name", "none");
});

test("event socket connects to the actual backend", async ({ page }) => {
  await page.goto("/terminal");
  await expect(page.getByText("EVENT STREAM", { exact: true })).toBeVisible();
});

test('300 unique assets are searchable without eagerly loading 300 charts',async({page})=>{
  const requested=new Set<string>();
  page.on('request',request=>{if(request.url().includes('/candles'))requested.add(request.url())});
  await page.goto('/terminal');
  await expect(page.locator('.watch-row')).toHaveCount(300);
  const symbols=await page.locator('.watch-row b').allTextContents();
  expect(new Set(symbols).size).toBe(300);
  await page.waitForTimeout(500);
  expect(requested.size).toBeLessThan(30);
  expect([...requested].some(url => url.includes("interval=1d"))).toBe(false);
  await page.getByRole('textbox',{name:'Search watchlist'}).fill('ADBE');
  await page.getByRole('button',{name:/ADBE.*Adobe/}).click();
  await expect(page.getByRole('heading',{name:'ADBE',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Search watchlist'}).fill('XRP');
  await page.getByRole('button',{name:/XRP/}).click();
  await expect(page.getByRole('heading',{name:'XRP',exact:true})).toBeVisible();
});

test("intraday intervals, chart styles and unbranded live candle updates", async ({ page }) => {
  let socket: import("@playwright/test").WebSocketRoute | undefined;
  await page.routeWebSocket("**/ws", ws => { socket = ws; });
  await page.goto("/terminal");
  const chart = page.getByTestId("chart");
  await expect(chart).toHaveAttribute("data-interval", "1m");
  await page.getByRole("button", { name: "15m", exact: true }).click();
  await expect(chart).toHaveAttribute("data-interval", "15m");
  await page.getByRole("button", { name: "1h", exact: true }).click();
  await expect(chart).toHaveAttribute("data-interval", "1h");
  const select = page.getByRole("combobox", { name: "Chart style" });
  for (const style of ["heikin", "bars", "line", "area", "candles"]) {
    await select.selectOption(style);
    await expect(chart).toHaveAttribute("data-style", style);
  }
  await page.getByRole("button", { name: "1m", exact: true }).click();
  await expect(chart).toHaveAttribute("data-interval", "1m");
  const svg = await chart.locator("svg").elementHandle();
  socket!.send(JSON.stringify({ id: "test-candle", type: "market.candle", asset: "BTC/USD", interval: "1m", candle: { ...candles.at(-1), close: 222, high: 223 }, price: 222, timestamp: new Date().toISOString(), market_timestamp: new Date().toISOString(), source: "bitstamp-stream" }));
  await expect(chart).toHaveAttribute("data-last-close", "222");
  expect(await svg!.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('a[href*="tradingview"]')).toHaveCount(0);
  await page.goto("/source");
  await expect(page.locator('a[href*="tradingview"]')).toHaveCount(0);
});

test("provider failures show an error instead of indefinite connecting", async ({ page }) => {
  await page.route("**/api/market/**/candles*", route => route.fulfill({ status: 504, json: { detail: "Candle provider timed out. Retry the chart or choose another asset." } }));
  await page.goto("/terminal?symbol=LTC%2FUSD");
  await expect(page.getByRole("heading", { name: "Market data unavailable" })).toBeVisible();
  await expect(page.getByText("Candle provider timed out. Retry the chart or choose another asset.")).toBeVisible();
});
