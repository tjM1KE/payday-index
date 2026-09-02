# Payday Index

Payday Index is my paper-trading experiment for a simple question: what happens if I invest 15% of a typical London take-home salary every month and refuse to time the market?

The model deposits £491.25 after each monthly payday. That is 15% of £3,275, with £5,895 contributed in the first year. It spreads each buy evenly across ten ETFs and caps every position at 10%.

## Rules

- Buy after every payday, whatever the market is doing.
- Hold for 20 to 30 years.
- Favour higher-beta ETF exposure that matches the experiment's risk appetite.
- Restore equal 10% weights with each scheduled buy.
- Compare returns with the broad market. Profit without market outperformance is not alpha.
- Never treat the simulator as a forecast or use it to place real orders.

## Run locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the full app. Add `?embed=1` for the compact card intended for the main site.

## Floating card

The embed route is responsive and works inside a fixed iframe. On `michailkhasaev.com`, add:

```html
<iframe class="payday-index-popover" src="https://invest.michailkhasaev.com/?embed=1" title="Payday Index paper portfolio" loading="lazy"></iframe>
```

```css
.payday-index-popover {
  position: fixed;
  left: 28px;
  bottom: 28px;
  width: min(410px, calc(100vw - 32px));
  height: 455px;
  border: 4px solid #f4f3ef;
  border-radius: 58px;
  box-shadow: 0 18px 50px rgb(21 23 20 / 18%);
  z-index: 30;
}
@media (max-width: 680px) {
  .payday-index-popover { left:16px; bottom:16px; height:390px; border-radius:36px; }
}
```

## Scope

All values are fictional and calculated in the browser. The app has no brokerage connection, no live market feed, and no ability to place trades.
