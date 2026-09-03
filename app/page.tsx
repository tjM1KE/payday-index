"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import backtestJson from "./data/backtest.json";
import forwardPaperJson from "./data/forward-paper.json";

type BenchmarkKey = "SPY"|"QQQ"|"VT";
type BenchmarkDefinition = { ticker:BenchmarkKey; label:string; description:string };
type BenchmarkResult = { valueGbp:number; returnPct:number; monthlyReturnPct:number };
type Trade = { ticker:string; name:string; beta:number; momentum:number; allocationGbp:number; units:number; leveraged:boolean };
type RankedFund = { rank:number; ticker:string; name:string; beta:number; momentum:number; leveraged:boolean };
type Holding = { ticker:string; name:string; valueGbp:number; contributedGbp:number; weight:number; beta:number|null; leveraged:boolean };
type Liquidation = { ticker:string; closedOn:string; valueGbp:number };
type MonthRecord = { month:string; label:string; contributionGbp:number; contributedGbp:number; strategyValueGbp:number; strategyMonthlyReturnPct:number; benchmarkValueGbp:number; alphaGbp:number; strategyReturnPct:number; benchmarkReturnPct:number; benchmarks:Record<BenchmarkKey,BenchmarkResult>; weightedBeta:number; universeCount:number; eligibleCount:number; liquidations:Liquidation[]; trades:Trade[]; ranking:RankedFund[]; holdings:Holding[] };
type UniverseCoverage = { activeListed:number; seededClosures:number; observedClosures:number; tickerCollisionsExcluded:number; reconstructedFunds:number; pricedFunds:number; pricedClosures:number; missingHistories:number };
type Backtest = { generatedAt:string; throughMonth:string; monthlyContributionGbp:number; startMonth:string; benchmark:string; benchmarks:BenchmarkDefinition[]; betaRange:number[]; universeSize:number; universeCoverage:UniverseCoverage; methodology:Record<string,string>; months:MonthRecord[]; current:MonthRecord };
type CashFlowPoint = { label:string; strategy:number; benchmark:number; contributed:number };
type ForwardTrade = Trade & { executionPriceUsd:number };
type ForwardHolding = { ticker:string; name:string; valueGbp:number; weight:number; beta:number|null; leveraged:boolean };
type ForwardRecord = { signalMonth:string; signalLabel:string; signalDate:string; executionDate:string; recordedAt:string; contributionGbp:number; contributedGbp:number; strategyValueGbp:number; strategyReturnPct:number; benchmarkValueGbp:number; benchmarkReturnPct:number; alphaGbp:number; weightedBeta:number; universeCount:number; eligibleCount:number; ranking:RankedFund[]; trades:ForwardTrade[]; holdings:ForwardHolding[]; liquidations:Liquidation[]; benchmarks:Record<BenchmarkKey,{ valueGbp:number; returnPct:number }>; locked:boolean };
type ForwardPaper = { version:number; startedAt:string|null; updatedAt:string|null; monthlyContributionGbp:number; status:string; methodology:Record<string,string>; records:ForwardRecord[]; historyHash:string|null; current:ForwardRecord|null };

const backtest = backtestJson as Backtest;
const forwardSeed = forwardPaperJson as unknown as ForwardPaper;
const money = new Intl.NumberFormat("en-GB", { style:"currency", currency:"GBP" });
const subscribeToLocation = () => () => {};
const signedMoney = (value:number) => `${value >= 0 ? "+" : ""}${money.format(value)}`;
const signedPercent = (value:number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const compactMoney = new Intl.NumberFormat("en-GB", { style:"currency", currency:"GBP", notation:"compact", maximumFractionDigits:1 });
const calendarDate = new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", year:"numeric", timeZone:"UTC" });

function nextForwardRun(signalMonth:string) {
  const [year, month] = signalMonth.split("-").map(Number);
  return calendarDate.format(new Date(Date.UTC(year, month + 1, 2)));
}

function cashFlowPerformance(months:MonthRecord[], start:number, end:number, ticker:BenchmarkKey, contribution:number) {
  let strategy = 0;
  let benchmark = 0;
  let contributed = 0;
  return months.slice(start, end + 1).map((month, index) => {
    if (index > 0) {
      const previous = months[start + index - 1];
      const strategyGrowth = (month.strategyValueGbp - month.contributionGbp) / previous.strategyValueGbp;
      const benchmarkGrowth = (month.benchmarks[ticker].valueGbp - month.contributionGbp) / previous.benchmarks[ticker].valueGbp;
      strategy *= strategyGrowth;
      benchmark *= benchmarkGrowth;
    }
    strategy += contribution;
    benchmark += contribution;
    contributed += contribution;
    return { label:month.label, strategy, benchmark, contributed };
  });
}

function ComparisonChart({ points, benchmark, period }: { points:CashFlowPoint[]; benchmark:BenchmarkDefinition; period:string }) {
  const width = 1000;
  const height = 340;
  const plot = { left:55, right:865, top:26, bottom:298 };
  const values = points.flatMap((point) => [point.strategy, point.benchmark]);
  const roughStep = Math.max(...values) / 4;
  const stepPower = 10 ** Math.floor(Math.log10(roughStep));
  const stepFraction = roughStep / stepPower;
  const step = (stepFraction <= 1 ? 1 : stepFraction <= 2 ? 2 : stepFraction <= 5 ? 5 : 10) * stepPower;
  const maximum = step * 4;
  const x = (index:number) => plot.left + index / Math.max(1, points.length - 1) * (plot.right - plot.left);
  const y = (value:number) => plot.bottom - value / maximum * (plot.bottom - plot.top);
  const path = (key:"strategy"|"benchmark") => points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point[key]).toFixed(2)}`).join(" ");
  const yTicks = Array.from({ length:5 }, (_, index) => step * index);
  const xTicks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const last = points.at(-1) ?? { strategy:0, benchmark:0, contributed:0, label:"" };
  const labelsAreClose = Math.abs(y(last.strategy) - y(last.benchmark)) < 24;
  const strategyLabelY = y(last.strategy) + (labelsAreClose && last.strategy <= last.benchmark ? 18 : -8);
  const benchmarkLabelY = y(last.benchmark) + (labelsAreClose && last.benchmark < last.strategy ? 18 : -8);

  return <svg className="comparison-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Monthly paper pots for my strategy and ${benchmark.label} from ${period}`}>
    <title>{`My paper strategy compared with ${benchmark.label} from ${period}`}</title>
    <desc>{`After identical monthly contributions, the strategy finishes at ${money.format(last.strategy)} and ${benchmark.label} finishes at ${money.format(last.benchmark)}.`}</desc>
    {yTicks.map((tick) => <g key={tick}><line className="chart-gridline" x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} /><text className="chart-axis-label" x={plot.left - 10} y={y(tick) + 4} textAnchor="end">{compactMoney.format(tick)}</text></g>)}
    {xTicks.map((index) => <text className="chart-axis-label" key={index} x={x(index)} y={plot.bottom + 27} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{points[index].label}</text>)}
    <path className="comparison-line benchmark-line" d={path("benchmark")} />
    <path className="comparison-line strategy-line" d={path("strategy")} />
    <circle className="benchmark-end" cx={x(points.length - 1)} cy={y(last.benchmark)} r="4" />
    <circle className="strategy-end" cx={x(points.length - 1)} cy={y(last.strategy)} r="5" />
    <text className="chart-end-label benchmark-label" x={plot.right + 13} y={benchmarkLabelY}>{benchmark.ticker} {compactMoney.format(last.benchmark)}</text>
    <text className="chart-end-label strategy-label" x={plot.right + 13} y={strategyLabelY}>MINE {compactMoney.format(last.strategy)}</text>
  </svg>;
}

export default function Home() {
  const [monthIndex, setMonthIndex] = useState(backtest.months.length - 1);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(backtest.months.length - 1);
  const [comparisonIndex, setComparisonIndex] = useState(0);
  const [forward, setForward] = useState(forwardSeed);
  const selected = backtest.months[monthIndex];
  const current = backtest.current;
  const period = `${backtest.months[rangeStart].label} to ${backtest.months[rangeEnd].label}`;
  const rangeStartPercent = rangeStart / (backtest.months.length - 1) * 100;
  const rangeEndPercent = rangeEnd / (backtest.months.length - 1) * 100;
  const rangeStyle = { "--range-start":`${rangeStartPercent}%`, "--range-end":`${rangeEndPercent}%` } as CSSProperties;
  const embed = useSyncExternalStore(subscribeToLocation, () => new URLSearchParams(window.location.search).get("embed") === "1", () => false);
  const live = forward.current;
  const liveRecords = forward.records.slice(-12);
  const liveMax = Math.max(1, ...liveRecords.map((record) => record.strategyValueGbp));

  useEffect(() => {
    let active = true;
    fetch("/api/forward-paper", { cache:"no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload?.status === "forward" && payload.current) setForward(payload as ForwardPaper); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (embed) return <main className="embed-shell">
    <div className="embed-top"><span>MY PAYDAY INDEX</span><span className="paper-pill">LIVE / PAPER</span></div>
    <p className="embed-kicker">Forward account, no historical rewrites</p>
    <div className="embed-value">{money.format(live?.strategyValueGbp ?? 0)}</div>
    <div className="mini-chart" aria-label="My live forward paper account by monthly decision">{liveRecords.map((record) => <i key={record.signalMonth} style={{height:`${Math.max(12, record.strategyValueGbp / liveMax * 100)}%`}} title={`${record.signalLabel}: ${money.format(record.strategyValueGbp)}`} />)}</div>
    <div className="embed-stats"><span><small>VERSUS SPY</small>{signedMoney(live?.alphaGbp ?? 0)}</span><span><small>I ADD</small>{money.format(forward.monthlyContributionGbp)} / month</span></div>
    <Link className="embed-link" href="/#forward" target="_top">See the locked monthly picks <span>&nearr;</span></Link>
  </main>;

  return <main>
    <header className="site-header"><a href="#top" className="wordmark">MK / MY PAYDAY INDEX</a><div className="header-meta"><span className="status-dot" /> live since {live?.executionDate ? calendarDate.format(new Date(`${live.executionDate}T00:00:00Z`)) : "the next payday"}</div></header>

    <section className="hero" id="top">
      <div><p className="eyebrow">My paper-money experiment</p><h1>What if I<br />went for it?</h1></div>
      <div className="hero-copy"><p>I&apos;m careful with real money, so I built somewhere safe to test the opposite. Every payday, I pretend to put 15% of my take-home into three fast-moving ETFs and see if my rules can beat the usual index options. The pretend horizon is 20 to 30 years.</p><div className="paper-note">Fake money. Real market data. No suits involved.</div></div>
    </section>

    <section className="ledger" aria-label="Where the historical backtest finishes">
      <div><span>backtest pot</span><strong>{money.format(current.strategyValueGbp)}</strong><small>{signedPercent(current.strategyReturnPct)} on what I put in</small></div>
      <div><span>backtest SPY pot</span><strong>{money.format(current.benchmarkValueGbp)}</strong><small>{signedPercent(current.benchmarkReturnPct)} with the same cash</small></div>
      <div><span>backtest lead</span><strong>{signedMoney(current.alphaGbp)}</strong><small>April 2022 to {current.label}</small></div>
      <div><span>portfolio beta</span><strong>{current.weightedBeta.toFixed(2)}</strong><small>historical result</small></div>
    </section>

    {live && <section className="forward-panel" id="forward" aria-label="Live forward paper account">
      <div className="forward-heading">
        <div><p className="eyebrow">live now / forward paper account</p><h2>No rewrites<br />from here.</h2></div>
        <div className="forward-copy"><p>The backtest stays above as the old experiment. This account started fresh with real decisions made after each month closes. Once a pick lands here, it stays here.</p><span><i className="status-dot" /> {forward.records.length} locked monthly {forward.records.length === 1 ? "entry" : "entries"}</span></div>
      </div>

      <div className="forward-ledger">
        <div><span>live paper pot</span><strong>{money.format(live.strategyValueGbp)}</strong><small>{signedPercent(live.strategyReturnPct)} on {money.format(live.contributedGbp)} added</small></div>
        <div><span>SPY with the same cash</span><strong>{money.format(live.benchmarkValueGbp)}</strong><small>{signedPercent(live.benchmarkReturnPct)} on the same dates</small></div>
        <div><span>{live.alphaGbp >= 0 ? "ahead by" : "behind by"}</span><strong>{live.alphaGbp >= 0 ? signedMoney(live.alphaGbp) : money.format(Math.abs(live.alphaGbp))}</strong><small>forward result only</small></div>
        <div><span>next lock</span><strong>{nextForwardRun(live.signalMonth)}</strong><small>after the next month closes</small></div>
      </div>

      <div className="forward-timing">
        <span><small>signal frozen</small>{calendarDate.format(new Date(`${live.signalDate}T00:00:00Z`))}</span>
        <i>&rarr;</i>
        <span><small>bought later</small>{calendarDate.format(new Date(`${live.executionDate}T00:00:00Z`))}</span>
        <i>&rarr;</i>
        <span><small>history</small>locked</span>
      </div>

      <div className="forward-picks">
        <div className="forward-picks-title"><div><p className="eyebrow">latest three</p><h3>{live.signalLabel}&apos;s picks</h3></div><p>I waited for the month to finish, then used the first later market session shared by all three. That removes the same-close shortcut from the backtest.</p></div>
        <div className="forward-trades">{live.trades.map((trade, index) => <article key={trade.ticker}><div><span>0{index + 1}</span>{trade.leveraged && <em>daily leveraged</em>}</div><h3>{trade.ticker}</h3><p>{trade.name}</p><dl><div><dt>Signal beta</dt><dd>{trade.beta.toFixed(2)}</dd></div><div><dt>3-month</dt><dd>{signedPercent(trade.momentum)}</dd></div><div><dt>Paper buy</dt><dd>{money.format(trade.allocationGbp)}</dd></div></dl></article>)}</div>
      </div>

      <div className="forward-holdings">
        <div className="forward-holdings-head"><span>Live holding</span><span>Paper value</span><span>Weight</span></div>
        {live.holdings.map((holding) => <div className="forward-holding" key={holding.ticker}><b>{holding.ticker}{holding.leveraged && <sup>L</sup>}</b><span>{money.format(holding.valueGbp)}</span><strong>{holding.weight.toFixed(1)}%</strong></div>)}
      </div>
      <p className="forward-footnote">Monthly snapshots, not streaming prices. Fees, spreads, slippage and tax are still left out. The locked record is {forward.historyHash?.slice(0, 10)}.</p>
    </section>}

    <section className="income-source">
      <div><p className="eyebrow">where the monthly number came from</p><h2>Why £491.25?</h2></div>
      <div className="income-copy">
        <p>I started with a typical full-time London salary. The £49,692 gross median works out to about £39,298 a year, or £3,275 a month, after Income Tax and National Insurance under the 2026/27 rates.</p>
        <div className="income-sum"><span>£3,275 post-tax each month</span><i>&times; 15%</i><strong>£491.25 into the paper pot</strong></div>
        <p className="income-footnote">I used the median instead of the £70,275 mean because London&apos;s very high earners pull the average upwards. Pension and student loan deductions are not included in this base number.</p>
      </div>
    </section>

    <section className="performance">
      <div className="section-heading"><div><p className="eyebrow">01 / pick the dates, then pick the rival</p><h2>Same payday.<br />Fair fight.</h2></div><p>I start two fresh paper pots in the first month I choose, then put {money.format(backtest.monthlyContributionGbp)} into each one every month. Same cash, same dates. The only difference is what it buys.</p></div>

      <div className="period-control">
        <div className="period-readout"><span>from <b>{backtest.months[rangeStart].label}</b></span><i>&rarr;</i><span>to <b>{backtest.months[rangeEnd].label}</b></span></div>
        <div className="dual-range" style={rangeStyle}>
          <div className="range-rail"><i /></div>
          <input aria-label="Performance start month" aria-valuetext={backtest.months[rangeStart].label} type="range" min="0" max={backtest.months.length - 1} value={rangeStart} onChange={(event) => setRangeStart(Math.min(Number(event.target.value), rangeEnd - 1))} />
          <input aria-label="Performance end month" aria-valuetext={backtest.months[rangeEnd].label} type="range" min="0" max={backtest.months.length - 1} value={rangeEnd} onChange={(event) => setRangeEnd(Math.max(Number(event.target.value), rangeStart + 1))} />
        </div>
        <div className="range-bounds"><span>{backtest.months[0].label}</span><span>{backtest.months.at(-1)?.label}</span></div>
      </div>

      <div className="comparison-controls">
        <div className="comparison-tabs" role="tablist" aria-label="Comparison benchmark">{backtest.benchmarks.map((benchmark, index) => <button id={`comparison-tab-${benchmark.ticker}`} aria-controls={`comparison-panel-${benchmark.ticker}`} key={benchmark.ticker} role="tab" aria-selected={comparisonIndex === index} onClick={() => setComparisonIndex(index)}><span>{benchmark.ticker}</span>{benchmark.label}</button>)}</div>
        <div className="comparison-arrows"><button aria-label="Previous comparison" onClick={() => setComparisonIndex((comparisonIndex + backtest.benchmarks.length - 1) % backtest.benchmarks.length)}>&larr;</button><span>{comparisonIndex + 1} / {backtest.benchmarks.length}</span><button aria-label="Next comparison" onClick={() => setComparisonIndex((comparisonIndex + 1) % backtest.benchmarks.length)}>&rarr;</button></div>
      </div>

      <div className="comparison-window">
        <div className="comparison-track" style={{ transform:`translateX(-${comparisonIndex * 100}%)` }}>{backtest.benchmarks.map((benchmark, index) => {
          const points = cashFlowPerformance(backtest.months, rangeStart, rangeEnd, benchmark.ticker, backtest.monthlyContributionGbp);
          const last = points.at(-1) ?? { strategy:backtest.monthlyContributionGbp, benchmark:backtest.monthlyContributionGbp, contributed:backtest.monthlyContributionGbp };
          const strategyReturn = (last.strategy / last.contributed - 1) * 100;
          const benchmarkReturn = (last.benchmark / last.contributed - 1) * 100;
          const gap = last.strategy - last.benchmark;
          return <article className="comparison-slide" id={`comparison-panel-${benchmark.ticker}`} role="tabpanel" aria-labelledby={`comparison-tab-${benchmark.ticker}`} aria-hidden={comparisonIndex !== index} key={benchmark.ticker}>
            <div className="comparison-summary"><div><span>my pot</span><strong>{money.format(last.strategy)}</strong><small>{signedPercent(strategyReturn)} on what I put in</small></div><div><span>{benchmark.label}</span><strong>{money.format(last.benchmark)}</strong><small>{signedPercent(benchmarkReturn)} on the same cash</small></div><div><span>{gap >= 0 ? "ahead by" : "behind by"}</span><strong>{gap >= 0 ? signedMoney(gap) : money.format(Math.abs(gap))}</strong><small>{money.format(last.contributed)} went into each pot</small></div></div>
            <ComparisonChart points={points} benchmark={benchmark} period={period} />
            <p className="chart-note">This window contains {points.length} paydays. Each line starts with {money.format(backtest.monthlyContributionGbp)} in {backtest.months[rangeStart].label} and receives the same amount through {backtest.months[rangeEnd].label}.</p>
          </article>;
        })}</div>
      </div>
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
      <div className="method-note"><b>Before I get carried away</b><p>{backtest.methodology.caveat}</p><p>The closure register starts in 2024, so the April 2022 through December 2023 results have more survivorship risk. This run priced {backtest.universeCoverage.pricedFunds.toLocaleString("en-GB")} funds, including {backtest.universeCoverage.pricedClosures.toLocaleString("en-GB")} closed histories. Beta does not promise a return. The leveraged funds reset every day and can behave very differently over a long stretch. This can go badly. That&apos;s why it stays a paper experiment on this public page.</p></div>
    </section>

    <footer><span>Made by MK, mostly out of curiosity</span><span>I refresh the market data monthly &middot; {new Date(backtest.generatedAt).toLocaleDateString("en-GB")}</span></footer>
  </main>;
}
