"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

type Holding = { ticker: string; name: string; weight: number; beta: number };
const holdings: Holding[] = [
  { ticker: "VGT", name: "US technology", weight: 10, beta: 1.18 },
  { ticker: "SOXX", name: "Semiconductors", weight: 10, beta: 1.35 },
  { ticker: "QQQM", name: "Nasdaq 100", weight: 10, beta: 1.12 },
  { ticker: "VUG", name: "US growth", weight: 10, beta: 1.10 },
  { ticker: "VBK", name: "Small-cap growth", weight: 10, beta: 1.22 },
  { ticker: "VWO", name: "Emerging markets", weight: 10, beta: 0.95 },
  { ticker: "IHI", name: "Medical devices", weight: 10, beta: 1.05 },
  { ticker: "ITA", name: "Aerospace & defence", weight: 10, beta: 1.08 },
  { ticker: "CIBR", name: "Cybersecurity", weight: 10, beta: 1.06 },
  { ticker: "XLY", name: "Consumer discretionary", weight: 10, beta: 1.16 },
];
const MONTHLY_DEPOSIT = 491.25;
const ANNUAL_DEPOSIT = MONTHLY_DEPOSIT * 12;
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const subscribeToLocation = () => () => {};

export default function Home() {
  const [months, setMonths] = useState(12);
  const [marketReturn, setMarketReturn] = useState(8);
  const embed = useSyncExternalStore(
    subscribeToLocation,
    () => new URLSearchParams(window.location.search).get("embed") === "1",
    () => false,
  );
  const numbers = useMemo(() => {
    const beta = holdings.reduce((sum, item) => sum + item.beta * item.weight / 100, 0);
    const annualStrategyReturn = marketReturn * beta;
    const monthlyRate = Math.pow(1 + annualStrategyReturn / 100, 1 / 12) - 1;
    const marketMonthlyRate = Math.pow(1 + marketReturn / 100, 1 / 12) - 1;
    const fv = (rate: number) => rate === 0 ? MONTHLY_DEPOSIT * months : MONTHLY_DEPOSIT * ((Math.pow(1 + rate, months) - 1) / rate);
    return { beta, futureValue: fv(monthlyRate), benchmark: fv(marketMonthlyRate), contributed: MONTHLY_DEPOSIT * months };
  }, [months, marketReturn]);

  if (embed) return <main className="embed-shell">
    <div className="embed-top"><span>PAYDAY INDEX</span><span className="live-dot">PAPER</span></div>
    <p className="embed-kicker">15% of take-home, every payday</p>
    <div className="embed-value">{money.format(numbers.futureValue)}</div>
    <div className="mini-chart" aria-hidden="true">{[28,36,31,46,43,58,54,66,63,75,72,88].map((height, i) => <i key={i} style={{height:`${height}%`}} />)}</div>
    <div className="embed-stats"><span><small>MONTHLY</small>{money.format(MONTHLY_DEPOSIT)}</span><span><small>HORIZON</small>20-30 yrs</span></div>
    <Link className="embed-link" href="/" target="_top">Open the paper portfolio <span>↗</span></Link>
  </main>;

  return <main>
    <header className="site-header"><a href="#top" className="wordmark">MK / PAYDAY INDEX</a><div className="header-meta"><span className="status-dot" /> paper market open</div></header>
    <section className="hero" id="top"><div><p className="eyebrow">A long-horizon paper portfolio</p><h1>Buy on payday.<br />Leave it alone.</h1></div><div className="hero-copy"><p>A deliberately boring experiment: put 15% of a typical London take-home pay into higher-beta ETFs every month, hold for decades, and judge the result against the market.</p><div className="paper-note">Simulation only. No real money or live orders.</div></div></section>
    <section className="ledger" aria-label="Strategy summary"><div><span>monthly paper buy</span><strong>{money.format(MONTHLY_DEPOSIT)}</strong><small>15% of £3,275 take-home</small></div><div><span>first-year contributions</span><strong>{money.format(ANNUAL_DEPOSIT)}</strong><small>12 automatic deposits</small></div><div><span>portfolio beta</span><strong>{numbers.beta.toFixed(2)}</strong><small>higher volatility by design</small></div><div><span>largest position</span><strong>10%</strong><small>hard allocation cap</small></div></section>
    <section className="simulator"><div className="section-heading"><div><p className="eyebrow">01 / paper lab</p><h2>Compound the habit</h2></div><p>Change the horizon and assumed market return. The portfolio estimate applies its weighted beta. It is a toy model, not a forecast.</p></div><div className="sim-grid"><div className="controls"><label><span>Holding period <b>{months / 12} {months === 12 ? "year" : "years"}</b></span><input aria-label="Holding period" type="range" min="12" max="360" step="12" value={months} onChange={e=>setMonths(Number(e.target.value))}/></label><label><span>Market return <b>{marketReturn}% a year</b></span><input aria-label="Market return" type="range" min="-10" max="15" step="1" value={marketReturn} onChange={e=>setMarketReturn(Number(e.target.value))}/></label><button onClick={()=>{setMonths(12);setMarketReturn(8)}}>Reset assumptions</button></div><div className="result-card"><span>estimated paper value</span><strong>{money.format(numbers.futureValue)}</strong><div className="result-row"><span>Contributed <b>{money.format(numbers.contributed)}</b></span><span>Market benchmark <b>{money.format(numbers.benchmark)}</b></span></div><div className="alpha-line"><i style={{width:`${Math.min(100,Math.max(6,(numbers.futureValue/Math.max(numbers.benchmark,1))*72))}%`}}/><span>Paper alpha {money.format(numbers.futureValue-numbers.benchmark)}</span></div></div></div></section>
    <section className="portfolio"><div className="section-heading"><div><p className="eyebrow">02 / allocation</p><h2>Ten equal bets</h2></div><p>The mix leans toward growth and higher-beta themes without letting one ETF dominate. Each payday buy restores equal weights.</p></div><div className="holdings-table"><div className="table-head"><span>Fund</span><span>Exposure</span><span>Beta</span><span>Weight</span></div>{holdings.map(item=><div className="holding" key={item.ticker}><b>{item.ticker}</b><span>{item.name}</span><span>{item.beta.toFixed(2)}</span><strong>{item.weight}%</strong></div>)}</div></section>
    <section className="rules"><p className="eyebrow">03 / rules of the game</p><ol><li><span>01</span><p><b>Pay yourself first.</b> Add {money.format(MONTHLY_DEPOSIT)} after every monthly payday.</p></li><li><span>02</span><p><b>Buy regardless.</b> Up month, crash month, dull month. The schedule does not change.</p></li><li><span>03</span><p><b>Keep positions small.</b> No ETF may exceed 10% after a scheduled rebalance.</p></li><li><span>04</span><p><b>Measure alpha.</b> Profit alone is not enough. Compare the result with the broad market.</p></li><li><span>05</span><p><b>Think in decades.</b> The working horizon is 20 to 30 years, not the next earnings call.</p></li></ol></section>
    <footer><span>Payday Index / private paper experiment</span><span>Built in London · 2026</span></footer>
  </main>;
}
