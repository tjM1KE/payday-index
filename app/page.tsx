"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import backtestJson from "./data/backtest.json";

type Trade = { ticker:string; name:string; beta:number; momentum:number; allocationGbp:number; units:number; leveraged:boolean };
type RankedFund = { rank:number; ticker:string; name:string; beta:number; momentum:number; leveraged:boolean };
type Holding = { ticker:string; name:string; valueGbp:number; contributedGbp:number; weight:number; beta:number|null; leveraged:boolean };
type MonthRecord = { month:string; label:string; contributionGbp:number; contributedGbp:number; strategyValueGbp:number; benchmarkValueGbp:number; alphaGbp:number; strategyReturnPct:number; benchmarkReturnPct:number; weightedBeta:number; eligibleCount:number; trades:Trade[]; ranking:RankedFund[]; holdings:Holding[] };
type Backtest = { generatedAt:string; throughMonth:string; monthlyContributionGbp:number; startMonth:string; benchmark:string; betaRange:number[]; universeSize:number; methodology:Record<string,string>; months:MonthRecord[]; current:MonthRecord };

const backtest = backtestJson as Backtest;
const money = new Intl.NumberFormat("en-GB", { style:"currency", currency:"GBP" });
const subscribeToLocation = () => () => {};
const signedMoney = (value:number) => `${value >= 0 ? "+" : ""}${money.format(value)}`;
const signedPercent = (value:number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export default function Home() {
  const [monthIndex, setMonthIndex] = useState(backtest.months.length - 1);
  const selected = backtest.months[monthIndex];
  const current = backtest.current;
  const maxChartValue = Math.max(...backtest.months.flatMap((month) => [month.strategyValueGbp, month.benchmarkValueGbp]));
  const recent = backtest.months.slice(-12);
  const recentMax = Math.max(...recent.map((month) => month.strategyValueGbp));
  const embed = useSyncExternalStore(subscribeToLocation, () => new URLSearchParams(window.location.search).get("embed") === "1", () => false);

  if (embed) return <main className="embed-shell">
    <div className="embed-top"><span>PAYDAY INDEX</span><span className="paper-pill">PAPER</span></div>
    <p className="embed-kicker">Since Jan 2024 · through {current.label}</p>
    <div className="embed-value">{money.format(current.strategyValueGbp)}</div>
    <div className="mini-chart" aria-label="Portfolio value over the latest twelve months">{recent.map((month) => <i key={month.month} style={{height:`${Math.max(12, month.strategyValueGbp / recentMax * 100)}%`}} title={`${month.label}: ${money.format(month.strategyValueGbp)}`} />)}</div>
    <div className="embed-stats"><span><small>VS S&amp;P 500</small>{signedMoney(current.alphaGbp)}</span><span><small>MONTHLY</small>{money.format(backtest.monthlyContributionGbp)}</span></div>
    <Link className="embed-link" href="/" target="_top">Open the monthly breakdown <span>↗</span></Link>
  </main>;

  return <main>
    <header className="site-header"><a href="#top" className="wordmark">MK / PAYDAY INDEX</a><div className="header-meta"><span className="status-dot" /> updated through {current.label}</div></header>
    <section className="hero" id="top"><div><p className="eyebrow">A risk-seeking paper portfolio</p><h1>Screen. Rank.<br />Buy three.</h1></div><div className="hero-copy"><p>Every month, 15% of take-home pay follows the same rules. Find high-beta ETFs, rank recent momentum, buy three, then hold for 20 to 30 years.</p><div className="paper-note">Historical simulation only. No real orders.</div></div></section>
    <section className="ledger" aria-label="Current backtest summary"><div><span>paper portfolio</span><strong>{money.format(current.strategyValueGbp)}</strong><small>{signedPercent(current.strategyReturnPct)} on contributions</small></div><div><span>S&amp;P 500 proxy</span><strong>{money.format(current.benchmarkValueGbp)}</strong><small>{signedPercent(current.benchmarkReturnPct)} on the same deposits</small></div><div><span>paper alpha</span><strong>{signedMoney(current.alphaGbp)}</strong><small>portfolio minus SPY</small></div><div><span>weighted beta</span><strong>{current.weightedBeta.toFixed(2)}</strong><small>changes as holdings move</small></div></section>

    <section className="performance"><div className="section-heading"><div><p className="eyebrow">01 / since January 2024</p><h2>Same money.<br />Different route.</h2></div><p>{money.format(backtest.monthlyContributionGbp)} enters both paper accounts at each completed month-end. The terracotta bars show the strategy. Black bars show the same deposits into SPY.</p></div><div className="performance-chart" aria-label="Monthly portfolio value compared with SPY">{backtest.months.map((month) => <div className="chart-month" key={month.month} title={`${month.label}: strategy ${money.format(month.strategyValueGbp)}, SPY ${money.format(month.benchmarkValueGbp)}`}><i className="strategy-bar" style={{height:`${month.strategyValueGbp / maxChartValue * 100}%`}} /><i className="benchmark-bar" style={{height:`${month.benchmarkValueGbp / maxChartValue * 100}%`}} /></div>)}</div><div className="chart-key"><span><i className="strategy-swatch" />Payday Index</span><span><i className="benchmark-swatch" />SPY</span><b>{backtest.months.length} monthly deposits · {money.format(current.contributedGbp)} contributed</b></div></section>

    <section className="month-lab"><div className="section-heading"><div><p className="eyebrow">02 / monthly ledger</p><h2>{selected.label}</h2></div><p>Move through the backtest to see that month&apos;s ranking, purchases and full portfolio after the contribution.</p></div><div className="month-picker"><button onClick={() => setMonthIndex(Math.max(0, monthIndex - 1))} disabled={monthIndex === 0} aria-label="Previous month">←</button><input aria-label="Backtest month" type="range" min="0" max={backtest.months.length - 1} value={monthIndex} onChange={(event) => setMonthIndex(Number(event.target.value))} /><button onClick={() => setMonthIndex(Math.min(backtest.months.length - 1, monthIndex + 1))} disabled={monthIndex === backtest.months.length - 1} aria-label="Next month">→</button><span>{monthIndex + 1} / {backtest.months.length}</span></div><div className="month-summary"><div><span>Portfolio</span><b>{money.format(selected.strategyValueGbp)}</b></div><div><span>SPY</span><b>{money.format(selected.benchmarkValueGbp)}</b></div><div><span>Alpha</span><b>{signedMoney(selected.alphaGbp)}</b></div><div><span>Eligible ETFs</span><b>{selected.eligibleCount}</b></div></div>
      <div className="purchase-heading"><div><p className="eyebrow">This month&apos;s three</p><h3>{money.format(selected.contributionGbp)} invested</h3></div><p>The contribution is split evenly. Candidates already above 10% are passed over when another top-ten ETF is available.</p></div>
      <div className="trade-grid">{selected.trades.map((trade, index) => <article className="trade-card" key={trade.ticker}><div><span>0{index + 1}</span>{trade.leveraged && <em>daily leveraged</em>}</div><h3>{trade.ticker}</h3><p>{trade.name}</p><dl><div><dt>Beta</dt><dd>{trade.beta.toFixed(2)}</dd></div><div><dt>3-month</dt><dd>{signedPercent(trade.momentum)}</dd></div><div><dt>Buy</dt><dd>{money.format(trade.allocationGbp)}</dd></div></dl></article>)}</div>
      <div className="split-tables"><div><p className="table-title">Momentum shortlist</p><div className="data-table ranking-table"><div className="data-head"><span>#</span><span>ETF</span><span>Beta</span><span>3-month</span></div>{selected.ranking.map((fund) => <div className="data-row" key={fund.ticker}><span>{fund.rank}</span><b>{fund.ticker}{fund.leveraged && <sup>L</sup>}</b><span>{fund.beta.toFixed(2)}</span><strong>{signedPercent(fund.momentum)}</strong></div>)}</div></div><div><p className="table-title">Portfolio at month-end</p><div className="data-table holding-table"><div className="data-head"><span>ETF</span><span>Value</span><span>Weight</span></div>{selected.holdings.map((holding) => <div className={`data-row ${holding.weight > 10 ? "over-cap" : ""}`} key={holding.ticker}><b>{holding.ticker}{holding.leveraged && <sup>L</sup>}</b><span>{money.format(holding.valueGbp)}</span><strong>{holding.weight.toFixed(1)}%</strong></div>)}</div></div></div>
    </section>

    <section className="portfolio"><div className="section-heading"><div><p className="eyebrow">03 / total breakdown</p><h2>What we hold now</h2></div><p>The 10% guideline controls new purchases, not forced selling. A winner may drift above it. Daily-leveraged products are marked with an L.</p></div><div className="current-holdings"><div className="current-head"><span>ETF</span><span>Exposure</span><span>Value</span><span>Beta now</span><span>Weight</span></div>{current.holdings.map((holding) => <div className={`current-row ${holding.weight > 10 ? "over-cap" : ""}`} key={holding.ticker}><b>{holding.ticker}{holding.leveraged && <sup>L</sup>}</b><span>{holding.name}</span><span>{money.format(holding.valueGbp)}</span><span>{holding.beta?.toFixed(2) ?? "n/a"}</span><strong>{holding.weight.toFixed(1)}%</strong></div>)}</div></section>

    <section className="rules"><div><p className="eyebrow">04 / exact monthly process</p><h2>The rules</h2></div><ol><li><span>01</span><p><b>Fund it.</b> Add {money.format(backtest.monthlyContributionGbp)}, equal to 15% of the stated monthly take-home.</p></li><li><span>02</span><p><b>Screen beta.</b> Calculate trailing beta against SPY and retain ETFs between {backtest.betaRange[0]} and {backtest.betaRange[1]}.</p></li><li><span>03</span><p><b>Rank twice.</b> Keep the 15 highest-beta candidates, then rank the best ten by trailing three-month return.</p></li><li><span>04</span><p><b>Buy three.</b> Split the full contribution across three leaders, preferring candidates below the soft 10% position limit.</p></li><li><span>05</span><p><b>Do not time it.</b> Repeat at every completed month-end and compare the result with the same deposits into SPY.</p></li></ol><div className="method-note"><b>Backtest limits</b><p>{backtest.methodology.caveat} Beta is not a promise of future returns. Leveraged ETFs reset daily and may diverge sharply from their stated daily multiple over long periods.</p></div></section>
    <footer><span>Payday Index / paper experiment</span><span>Market data refreshed monthly · {new Date(backtest.generatedAt).toLocaleDateString("en-GB")}</span></footer>
  </main>;
}
