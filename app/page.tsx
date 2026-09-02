"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import backtestJson from "./data/backtest.json";

type Trade = { ticker:string; name:string; beta:number; momentum:number; allocationGbp:number; units:number; leveraged:boolean };
type RankedFund = { rank:number; ticker:string; name:string; beta:number; momentum:number; leveraged:boolean };
type Holding = { ticker:string; name:string; valueGbp:number; contributedGbp:number; weight:number; beta:number|null; leveraged:boolean };
type Liquidation = { ticker:string; closedOn:string; valueGbp:number };
type MonthRecord = { month:string; label:string; contributionGbp:number; contributedGbp:number; strategyValueGbp:number; benchmarkValueGbp:number; alphaGbp:number; strategyReturnPct:number; benchmarkReturnPct:number; weightedBeta:number; universeCount:number; eligibleCount:number; liquidations:Liquidation[]; trades:Trade[]; ranking:RankedFund[]; holdings:Holding[] };
type UniverseCoverage = { activeListed:number; seededClosures:number; observedClosures:number; tickerCollisionsExcluded:number; reconstructedFunds:number; pricedFunds:number; pricedClosures:number; missingHistories:number };
type Backtest = { generatedAt:string; throughMonth:string; monthlyContributionGbp:number; startMonth:string; benchmark:string; betaRange:number[]; universeSize:number; universeCoverage:UniverseCoverage; methodology:Record<string,string>; months:MonthRecord[]; current:MonthRecord };

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
    <div className="embed-top"><span>MY PAYDAY INDEX</span><span className="paper-pill">PAPER ONLY</span></div>
    <p className="embed-kicker">My risky little experiment since Jan 2024</p>
    <div className="embed-value">{money.format(current.strategyValueGbp)}</div>
    <div className="mini-chart" aria-label="My portfolio value over the latest twelve months">{recent.map((month) => <i key={month.month} style={{height:`${Math.max(12, month.strategyValueGbp / recentMax * 100)}%`}} title={`${month.label}: ${money.format(month.strategyValueGbp)}`} />)}</div>
    <div className="embed-stats"><span><small>AHEAD OF SPY BY</small>{signedMoney(current.alphaGbp)}</span><span><small>I ADD</small>{money.format(backtest.monthlyContributionGbp)} / month</span></div>
    <Link className="embed-link" href="/" target="_top">See what I bought this month <span>&nearr;</span></Link>
  </main>;

  return <main>
    <header className="site-header"><a href="#top" className="wordmark">MK / MY PAYDAY INDEX</a><div className="header-meta"><span className="status-dot" /> caught up to {current.label}</div></header>

    <section className="hero" id="top">
      <div><p className="eyebrow">My paper-money experiment</p><h1>What if I<br />went for it?</h1></div>
      <div className="hero-copy"><p>I&apos;m careful with real money, so I built somewhere safe to test the opposite. Every payday, I pretend to put 15% of my take-home into three fast-moving ETFs and see if my rules can beat the sensible S&amp;P 500 option. The pretend horizon is 20 to 30 years.</p><div className="paper-note">Fake money. Real market data. No suits involved.</div></div>
    </section>

    <section className="ledger" aria-label="Where my paper portfolio stands now">
      <div><span>my pretend pot</span><strong>{money.format(current.strategyValueGbp)}</strong><small>{signedPercent(current.strategyReturnPct)} on what I put in</small></div>
      <div><span>the sensible SPY pot</span><strong>{money.format(current.benchmarkValueGbp)}</strong><small>{signedPercent(current.benchmarkReturnPct)} with the same cash</small></div>
      <div><span>extra vs SPY</span><strong>{signedMoney(current.alphaGbp)}</strong><small>same deposits, different picks</small></div>
      <div><span>portfolio beta</span><strong>{current.weightedBeta.toFixed(2)}</strong><small>high on purpose</small></div>
    </section>

    <section className="income-source">
      <div><p className="eyebrow">where the monthly number came from</p><h2>Why £491.25?</h2></div>
      <div className="income-copy">
        <p>I started with a typical full-time London salary. The £49,692 gross median works out to about £39,298 a year, or £3,275 a month, after Income Tax and National Insurance under the 2026/27 rates.</p>
        <div className="income-sum"><span>£3,275 post-tax each month</span><i>&times; 15%</i><strong>£491.25 into the paper pot</strong></div>
        <p className="income-footnote">I used the median instead of the £70,275 mean because London&apos;s very high earners pull the average upwards. Pension and student loan deductions are not included in this base number.</p>
      </div>
    </section>

    <section className="performance">
      <div className="section-heading"><div><p className="eyebrow">01 / me vs the sensible option</p><h2>Same payday.<br />More chaos.</h2></div><p>I give both paper accounts exactly {money.format(backtest.monthlyContributionGbp)} at each month-end. Terracotta is my experiment. Black is SPY, patiently minding its own business.</p></div>
      <div className="performance-chart" aria-label="My monthly portfolio value compared with SPY">{backtest.months.map((month) => <div className="chart-month" key={month.month} title={`${month.label}: my picks ${money.format(month.strategyValueGbp)}, SPY ${money.format(month.benchmarkValueGbp)}`}><i className="strategy-bar" style={{height:`${month.strategyValueGbp / maxChartValue * 100}%`}} /><i className="benchmark-bar" style={{height:`${month.benchmarkValueGbp / maxChartValue * 100}%`}} /></div>)}</div>
      <div className="chart-key"><span><i className="strategy-swatch" />My picks</span><span><i className="benchmark-swatch" />SPY being sensible</span><b>{backtest.months.length} paydays &middot; {money.format(current.contributedGbp)} put in</b></div>
    </section>

    <section className="month-lab">
      <div className="section-heading"><div><p className="eyebrow">02 / pick a month</p><h2>{selected.label}</h2></div><p>Drag the slider backwards to see what made my shortlist, what I bought and how the bag looked afterwards. This month checked {selected.universeCount.toLocaleString("en-GB")} funds that were alive and priced at the time.</p></div>
      <div className="month-picker"><button onClick={() => setMonthIndex(Math.max(0, monthIndex - 1))} disabled={monthIndex === 0} aria-label="Previous month">&larr;</button><input aria-label="Backtest month" type="range" min="0" max={backtest.months.length - 1} value={monthIndex} onChange={(event) => setMonthIndex(Number(event.target.value))} /><button onClick={() => setMonthIndex(Math.min(backtest.months.length - 1, monthIndex + 1))} disabled={monthIndex === backtest.months.length - 1} aria-label="Next month">&rarr;</button><span>{monthIndex + 1} / {backtest.months.length}</span></div>
      <div className="month-summary"><div><span>my pot</span><b>{money.format(selected.strategyValueGbp)}</b></div><div><span>SPY&apos;s pot</span><b>{money.format(selected.benchmarkValueGbp)}</b></div><div><span>ahead by</span><b>{signedMoney(selected.alphaGbp)}</b></div><div><span>eligible / alive</span><b>{selected.eligibleCount} / {selected.universeCount.toLocaleString("en-GB")}</b></div></div>
      {selected.liquidations.length > 0 && <div className="liquidation-note"><b>A fund disappeared.</b> {selected.liquidations.map((item) => `${item.ticker} closed, so ${money.format(item.valueGbp)} moved to cash`).join(". ")}.</div>}

      <div className="purchase-heading"><div><p className="eyebrow">This month&apos;s three</p><h3>{money.format(selected.contributionGbp)} causing trouble</h3></div><p>I split the money evenly. If one ETF already owns more than 10% of the pot, I try to give another top-ten pick a turn.</p></div>
      <div className="trade-grid">{selected.trades.map((trade, index) => <article className="trade-card" key={trade.ticker}><div><span>0{index + 1}</span>{trade.leveraged && <em>daily leveraged</em>}</div><h3>{trade.ticker}</h3><p>{trade.name}</p><dl><div><dt>Beta</dt><dd>{trade.beta.toFixed(2)}</dd></div><div><dt>Last 3 months</dt><dd>{signedPercent(trade.momentum)}</dd></div><div><dt>I bought</dt><dd>{money.format(trade.allocationGbp)}</dd></div></dl></article>)}</div>

      <div className="split-tables">
        <div><p className="table-title">The almost-list</p><div className="data-table ranking-table"><div className="data-head"><span>#</span><span>ETF</span><span>Beta</span><span>3-month</span></div>{selected.ranking.map((fund) => <div className="data-row" key={fund.ticker}><span>{fund.rank}</span><b>{fund.ticker}{fund.leveraged && <sup>L</sup>}</b><span>{fund.beta.toFixed(2)}</span><strong>{signedPercent(fund.momentum)}</strong></div>)}</div></div>
        <div><p className="table-title">What I owned by then</p><div className="data-table holding-table"><div className="data-head"><span>ETF</span><span>Value</span><span>Weight</span></div>{selected.holdings.map((holding) => <div className={`data-row ${holding.weight > 10 ? "over-cap" : ""}`} key={holding.ticker}><b>{holding.ticker}{holding.leveraged && <sup>L</sup>}</b><span>{money.format(holding.valueGbp)}</span><strong>{holding.weight.toFixed(1)}%</strong></div>)}</div></div>
      </div>
    </section>

    <section className="portfolio">
      <div className="section-heading"><div><p className="eyebrow">03 / today&apos;s bag</p><h2>So, what do I actually own?</h2></div><p>The 10% line is a nudge, not a bouncer. I stop adding to an oversized ETF when I have another good option, but I do not automatically sell a winner for crossing the line. An L marks a daily-leveraged fund.</p></div>
      <div className="current-holdings"><div className="current-head"><span>ETF</span><span>What it follows</span><span>Value</span><span>Beta now</span><span>Weight</span></div>{current.holdings.map((holding) => <div className={`current-row ${holding.weight > 10 ? "over-cap" : ""}`} key={holding.ticker}><b>{holding.ticker}{holding.leveraged && <sup>L</sup>}</b><span>{holding.name}</span><span>{money.format(holding.valueGbp)}</span><span>{holding.beta?.toFixed(2) ?? "n/a"}</span><strong>{holding.weight.toFixed(1)}%</strong></div>)}</div>
    </section>

    <section className="rules">
      <div><p className="eyebrow">04 / why I do it this way</p><h2>My payday ritual</h2></div>
      <ol>
        <li><span>01</span><p><b>Use the same amount.</b> I add {money.format(backtest.monthlyContributionGbp)}, which is 15% of the rounded London median take-home figure. It keeps the experiment tied to a normal monthly salary.</p></li>
        <li><span>02</span><p><b>Look for movement.</b> I keep ETFs with beta between {backtest.betaRange[0]} and {backtest.betaRange[1]}. This is my risky sandbox, so slow and steady is not the assignment.</p></li>
        <li><span>03</span><p><b>Back recent winners.</b> I take the 15 highest-beta ETFs, then keep the ten with the best previous three months. That stops me choosing whichever ticker looks coolest that day.</p></li>
        <li><span>04</span><p><b>Only buy three.</b> I split the whole month&apos;s money across three leaders and prefer picks below 10%. Focused enough to make a difference, still spread across more than one idea.</p></li>
        <li><span>05</span><p><b>Keep showing up.</b> I repeat it after every completed month and race the same deposits in SPY. I can leave this alone for years. Time is the one advantage I definitely have.</p></li>
      </ol>
      <div className="method-note"><b>Before I get carried away</b><p>{backtest.methodology.caveat}</p><p>This run priced {backtest.universeCoverage.pricedFunds.toLocaleString("en-GB")} funds, including {backtest.universeCoverage.pricedClosures.toLocaleString("en-GB")} closed histories. Beta does not promise a return. The leveraged funds reset every day and can behave very differently over a long stretch. This can go badly. That&apos;s why it stays a paper experiment on this public page.</p></div>
    </section>

    <footer><span>Made by MK, mostly out of curiosity</span><span>I refresh the market data monthly &middot; {new Date(backtest.generatedAt).toLocaleDateString("en-GB")}</span></footer>
  </main>;
}
