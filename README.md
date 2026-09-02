# Payday Index

Payday Index is my high-risk paper portfolio. It invests 15% of a typical London monthly take-home pay and tracks every completed month against the same contributions into the S&P 500.

The current paper contribution is £491.25 per month, based on 15% of £3,275. The backtest begins in January 2024 and includes GBP/USD conversion because the contribution is in pounds while the ETFs trade in dollars.

## Monthly strategy

1. Calculate each candidate ETF's trailing beta against SPY.
2. Keep ETFs with beta between 1.5 and 3.
3. Take the 15 highest-beta eligible ETFs.
4. Rank those ETFs by adjusted-price performance over the previous three completed month ends.
5. Keep the leading ten and invest the full monthly contribution in three of them.
6. Prefer candidates below 10% of the existing portfolio. This is a soft limit, so the model does not force sales when a winner moves above it.
7. Repeat at every completed month-end and compare the result with the same monthly contribution into SPY.

The intended holding period is 20 to 30 years. This is deliberately aggressive. The candidate universe includes daily-reset leveraged ETFs, which the interface labels clearly.

## Backtest details

- Adjusted daily prices and GBP/USD history come from Yahoo Finance's chart data.
- Beta uses up to 252 trailing sessions and requires at least 126 matched observations against SPY.
- Three-month momentum uses completed month-end prices only.
- Purchases use fractional total-return units at the completed month-end price.
- SPY is the investable S&P 500 proxy.
- The fixed candidate list creates survivorship and universe-selection bias. The result is an experiment, not a claim about future performance.

## Monthly update

Run the data refresh manually with:

```bash
npm run data:update
```

The GitHub Actions workflow runs on the second day of each month. It adds the latest completed month, runs the build and tests, then commits the refreshed backtest when the data changed.

## Run locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run data:update
npm run dev
```

Open `http://localhost:3000` for the full app. Add `?embed=1` for the compact card used by the main website.

## Floating card

The main site can embed the compact view with:

```html
<iframe class="payday-index-popover" src="https://invest.michailkhasaev.com/?embed=1" title="Payday Index paper portfolio" loading="lazy"></iframe>
```

## Scope

The app places no orders and connects to no brokerage account. Daily-reset leveraged ETFs can produce long-term results that differ sharply from their stated daily multiple. The project is for paper testing only.
