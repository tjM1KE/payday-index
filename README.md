# Payday Index

Payday Index is where I let my riskier ideas out without letting them near a real brokerage account.

I am fairly careful with actual money. This project lets me ask a much less careful question: what happens if I put 15% of my take-home into fast-moving ETFs every month and leave the rules alone for 20 to 30 years?

The paper contribution is GBP 491.25 a month. I started with the GBP 49,692 gross median for a full-time London salary. Under the 2026/27 Income Tax and National Insurance rates, that is about GBP 39,298 a year or GBP 3,275 a month after tax. Taking 15% of that rounded monthly figure gives GBP 491.25.

I use the median rather than the GBP 70,275 mean because London's very high earners pull the mean upwards. Pension contributions are outside the calculation. With a Plan 2 student loan, the estimated take-home would be about GBP 3,123 a month and 15% would be GBP 468.45 instead.

The experiment starts in April 2022. It compares the same monthly deposits with SPY for the S&P 500, QQQ for the Nasdaq-100 and VT for global stocks.

## Why I made these rules

I wanted something risky, but I did not want to choose funds on vibes alone.

1. I calculate each ETF's trailing beta against SPY.
2. I keep funds with beta between 1.5 and 3 because this is the bumpy portfolio.
3. I take the 15 highest-beta funds, then keep the ten with the best previous three months.
4. I buy only three. That gives the winners enough weight without betting the whole month on one idea.
5. I prefer funds below 10% of the pot so one holding does not swallow everything.
6. I do not force a sale just because a winner drifts over 10%. The limit is a nudge, not a wall.
7. I repeat the same process every completed month and compare it with SPY.

The simple motivation is that I have time. I would rather test a wild long-term idea on paper now than discover what it does with real money later.

## How the backtest works

- Adjusted daily prices and GBP/USD history come from Yahoo Finance chart data.
- Beta uses up to 252 trailing sessions and needs at least 126 matched observations against SPY.
- Three-month momentum uses completed month-end prices only.
- Purchases use fractional total-return units at the completed month-end price.
- SPY, QQQ and VT are the S&P 500, Nasdaq-100 and world-stock comparisons.
- The comparison graph starts a fresh paper pot in the first selected month, adds GBP 491.25 at every selected month-end and applies the observed monthly returns. Both sides receive identical deposits, so the full-range chart reconciles with the headline pots.
- Each month uses only funds that were alive on that date. The universe combines the full Nasdaq ETF list with a register of 659 US closures from 2024 onward. ETNs and known ticker collisions are excluded.
- If a holding closes, the backtest converts it to cash using its last available adjusted price and the closing-date exchange rate.

Some candidates are daily-reset leveraged ETFs. They are marked in the app because they can behave very differently from their headline multiple over a long period.

## How much bias remains

This is a much broader test than the original handpicked list. The current run priced more than 5,700 active and closed funds and excluded known ticker collisions.

It is still a public-data reconstruction, not a CRSP-quality dataset. Yahoo may lack a delisted fund's final distribution or full price history, and free listings do not always preserve ticker changes. The closure register begins in 2024, so the April 2022 through December 2023 section has more survivorship risk than the later results. The app says that plainly instead of calling the result bias-free.

## Monthly update

Run a refresh with:

```bash
npm run data:update
```

The GitHub Actions workflow runs on the second day of each month. It refreshes the Nasdaq universe, remembers funds that disappear, adds the latest completed month, runs the checks and commits the new backtest if anything changed.

## Run it locally

Use Node.js 22.13 or later.

```bash
npm install
npm run data:update
npm run dev
```

Open `http://localhost:3000` for the full app. Add `?embed=1` for the little card on my main website.

## Floating card

```html
<iframe class="payday-index-popover" src="https://invest.michailkhasaev.com/?embed=1" title="My Payday Index paper portfolio" loading="lazy"></iframe>
```

## One sensible line

The app places no orders and connects to no brokerage account. It is fake money following real market data.
