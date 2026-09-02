# Payday Index

Payday Index is where I let my riskier ideas out without letting them near a real brokerage account.

I am 20 and fairly careful with actual money. This project lets me ask a much less careful question: what happens if I put 15% of my take-home into fast-moving ETFs every month and leave the rules alone for 20 to 30 years?

The paper contribution is GBP 491.25 a month, based on 15% of GBP 3,275. The experiment starts in January 2024 and races the same monthly deposits in SPY.

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
- SPY is the S&P 500 stand-in.
- The fixed ETF list creates survivorship and universe-selection bias. This is an experiment, not a forecast.

Some candidates are daily-reset leveraged ETFs. They are marked in the app because they can behave very differently from their headline multiple over a long period.

## Monthly update

Run a refresh with:

```bash
npm run data:update
```

The GitHub Actions workflow runs on the second day of each month. It adds the latest completed month, runs the checks and commits the new backtest if anything changed.

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
