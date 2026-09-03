"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import backtestJson from "./data/backtest.json";
import forwardPaperJson from "./data/forward-paper.json";

type BenchmarkKey = "SPY" | "QQQ" | "VT";
type WorkspaceTab = "backtest" | "monthly" | "method" | "limits";
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
const compactMoney = new Intl.NumberFormat("en-GB", { style:"currency", currency:"GBP", notation:"compact", maximumFractionDigits:1 });
const calendarDate = new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", year:"numeric", timeZone:"UTC" });
const subscribeToLocation = () => () => {};
const signedMoney = (value:number) => `${value >= 0 ? "+" : ""}${money.format(value)}`;
const signedPercent = (value:number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

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
      strategy *= (month.strategyValueGbp - month.contributionGbp) / previous.strategyValueGbp;
      benchmark *= (month.benchmarks[ticker].valueGbp - month.contributionGbp) / previous.benchmarks[ticker].valueGbp;
    }
    strategy += contribution;
    benchmark += contribution;
    contributed += contribution;
    return { label:month.label, strategy, benchmark, contributed };
  });
}

function ComparisonChart({ points, benchmark, period }: { points:CashFlowPoint[]; benchmark:BenchmarkDefinition; period:string }) {
  const width = 1000;
  const height = 330;
  const plot = { left:55, right:850, top:24, bottom:286 };
  const values = points.flatMap((point) => [point.strategy, point.benchmark]);
  const roughStep = Math.max(1, ...values) / 4;
  const stepPower = 10 ** Math.floor(Math.log10(roughStep));
  const stepFraction = roughStep / stepPower;
  const step = (stepFraction <= 1 ? 1 : stepFraction <= 2 ? 2 : stepFraction <= 5 ? 5 : 10) * stepPower;
  const maximum = step * 4;
  const x = (index:number) => plot.left + index / Math.max(1, points.length - 1) * (plot.right - plot.left);
  const y = (value:number) => plot.bottom - value / maximum * (plot.bottom - plot.top);
  const path = (key:"strategy" | "benchmark") => points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point[key]).toFixed(2)}`).join(" ");
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
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("backtest");
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
    <div className="embed-top"><span>PAYDAY INDEX</span><span className="paper-pill">LIVE / PAPER</span></div>
    <p className="embed-kicker">Forward account</p>
    <div className="embed-value">{money.format(live?.strategyValueGbp ?? 0)}</div>
    <div className="mini-chart" aria-label="Live forward paper account by monthly decision">{liveRecords.map((record) => <i key={record.signalMonth} style={{ height:`${Math.max(12, record.strategyValueGbp / liveMax * 100)}%` }} title={`${record.signalLabel}: ${money.format(record.strategyValueGbp)}`} />)}</div>
    <div className="embed-stats"><span><small>VERSUS SPY</small>{signedMoney(live?.alphaGbp ?? 0)}</span><span><small>MONTHLY</small>{money.format(forward.monthlyContributionGbp)}</span></div>
    <Link className="embed-link" href="/#live" target="_top">Open the account <span>&nearr;</span></Link>
  </main>;

  const selectTab = (tab:WorkspaceTab) => setWorkspaceTab(tab);

  return <main id="top">
    <header className="site-header">
      <a className="wordmark" href="#top">Michail Khasaev</a>
      <nav aria-label="Page sections">
        <a href="#live">Live</a>
        <a href="#workspace" onClick={() => selectTab("backtest")}>Backtest</a>
        <a href="#workspace" onClick={() => selectTab("monthly")}>Monthly tape</a>
        <a href="#workspace" onClick={() => selectTab("method")}>Method</a>
      </nav>
    </header>

    <section className="intro" aria-labelledby="page-title">
      <p className="eyebrow">Personal finance / paper investing</p>
      <h1 id="page-title">Payday Index</h1>
      <p className="intro-lede">I think building a <span className="annotated"><span>long-term portfolio</span><small>20 to 30 years</small></span> is an essential part of being <span className="annotated"><span>responsible</span><small>funnily, this one is risk-seeking</small></span> with money.</p>
      <p className="intro-copy">I am careful with real money. This page lets me test the opposite with fake cash, fixed rules and a monthly record I cannot quietly rewrite later.</p>
    </section>

    <section className="live-section" id="live" aria-label="Live forward paper account">
      <div className="section-title-row">
        <div><p className="eyebrow"><span className="status-dot" /> live forward paper account</p><h2>The current month</h2></div>
        <p>This is the bit that matters now. The historical replay sits in the workspace below.</p>
      </div>

      {live ? <>
        <div className="metric-strip">
          <div><span>paper pot</span><strong>{money.format(live.strategyValueGbp)}</strong><small>{signedPercent(live.strategyReturnPct)} on {money.format(live.contributedGbp)}</small></div>
          <div><span>same cash in SPY</span><strong>{money.format(live.benchmarkValueGbp)}</strong><small>{signedPercent(live.benchmarkReturnPct)}</small></div>
          <div><span>{live.alphaGbp >= 0 ? "ahead" : "behind"}</span><strong>{live.alphaGbp >= 0 ? signedMoney(live.alphaGbp) : `-${money.format(Math.abs(live.alphaGbp))}`}</strong><small>forward account only</small></div>
          <div><span>next lock</span><strong>{nextForwardRun(live.signalMonth)}</strong><small>{forward.records.length} permanent {forward.records.length === 1 ? "entry" : "entries"}</small></div>
        </div>

        <div className="timing-line" aria-label="Forward trading timing">
          <span><small>signal frozen</small>{calendarDate.format(new Date(`${live.signalDate}T00:00:00Z`))}</span><i>&rarr;</i>
          <span><small>paper buy</small>{calendarDate.format(new Date(`${live.executionDate}T00:00:00Z`))}</span><i>&rarr;</i>
          <span><small>record</small>locked</span>
        </div>

        <div className="subsection-heading"><div><p className="eyebrow">latest decision</p><h3>{live.signalLabel}&apos;s three ETFs</h3></div><p>The signal uses a completed month. The pretend purchase waits for the first later market session shared by all three.</p></div>
        <div className="pick-table">
          <div className="pick-head"><span>#</span><span>ETF</span><span>Name</span><span>Beta</span><span>3 months</span><span>Paper buy</span></div>
          {live.trades.map((trade, index) => <div className="pick-row" key={trade.ticker}><span>0{index + 1}</span><b>{trade.ticker}{trade.leveraged && <sup>L</sup>}</b><span>{trade.name}</span><span>{trade.beta.toFixed(2)}</span><strong>{signedPercent(trade.momentum)}</strong><span>{money.format(trade.allocationGbp)}</span></div>)}
        </div>

        <div className="details-grid">
          <details>
            <summary>Live holdings <span>{live.holdings.length} positions</span></summary>
            <div className="data-table holding-table"><div className="data-head"><span>ETF</span><span>Paper value</span><span>Weight</span></div>{live.holdings.map((holding) => <div className={`data-row ${holding.weight > 10 ? "over-cap" : ""}`} key={holding.ticker}><b>{holding.ticker}{holding.leveraged && <sup>L</sup>}</b><span>{money.format(holding.valueGbp)}</span><strong>{holding.weight.toFixed(1)}%</strong></div>)}</div>
          </details>
          <details>
            <summary>Locked monthly history <span>{forward.records.length} entries</span></summary>
            <div className="history-list">{forward.records.slice().reverse().map((record) => <div key={record.signalMonth}><span>{record.signalLabel}</span><b>{record.trades.map((trade) => trade.ticker).join(" / ")}</b><strong>{money.format(record.strategyValueGbp)}</strong></div>)}</div>
          </details>
        </div>
        <p className="fine-print">Monthly snapshots, not streaming prices. The append-only record is {forward.historyHash?.slice(0, 10)}.</p>
      </> : <p className="empty-state">The first forward paper trade will appear after the next completed month.</p>}
    </section>

    <section className="workspace" id="workspace" aria-label="Strategy explorer">
      <div className="workspace-nav" role="tablist" aria-label="Strategy sections">
        {([ ["backtest", "Backtest"], ["monthly", "Monthly tape"], ["method", "Why these rules"], ["limits", "Limits"] ] as [WorkspaceTab,string][]).map(([tab, label]) => <button key={tab} id={`workspace-tab-${tab}`} role="tab" aria-selected={workspaceTab === tab} aria-controls={`workspace-panel-${tab}`} onClick={() => selectTab(tab)}>{label}</button>)}
      </div>

      <div id="workspace-panel-backtest" role="tabpanel" aria-labelledby="workspace-tab-backtest" hidden={workspaceTab !== "backtest"}>
        <div className="panel-intro"><div><p className="eyebrow">historical replay / April 2022 onward</p><h2>Same deposits, different bag.</h2></div><p>Choose any interval. I restart both paper pots with {money.format(backtest.monthlyContributionGbp)} and add the same amount monthly, so the graph and the cash gap describe the exact same window.</p></div>

        <div className="metric-strip historical-strip">
          <div><span>full replay pot</span><strong>{money.format(current.strategyValueGbp)}</strong><small>{signedPercent(current.strategyReturnPct)} on deposits</small></div>
          <div><span>full replay SPY</span><strong>{money.format(current.benchmarkValueGbp)}</strong><small>{signedPercent(current.benchmarkReturnPct)}</small></div>
          <div><span>full replay gap</span><strong>{signedMoney(current.alphaGbp)}</strong><small>{backtest.months.length} paydays</small></div>
          <div><span>weighted beta</span><strong>{current.weightedBeta.toFixed(2)}</strong><small>historical portfolio</small></div>
        </div>

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
              <div className="comparison-summary"><div><span>my pot</span><strong>{money.format(last.strategy)}</strong><small>{signedPercent(strategyReturn)} on deposits</small></div><div><span>{benchmark.label}</span><strong>{money.format(last.benchmark)}</strong><small>{signedPercent(benchmarkReturn)} on the same cash</small></div><div><span>{gap >= 0 ? "ahead by" : "behind by"}</span><strong>{gap >= 0 ? signedMoney(gap) : `-${money.format(Math.abs(gap))}`}</strong><small>{money.format(last.contributed)} went into each</small></div></div>
              <ComparisonChart points={points} benchmark={benchmark} period={period} />
              <p className="chart-note">{points.length} identical monthly deposits from {backtest.months[rangeStart].label} through {backtest.months[rangeEnd].label}. These are cash values, not a misleading comparison of percentage returns.</p>
            </article>;
          })}</div>
        </div>

        <details className="wide-details">
          <summary>Historical portfolio at the end of the replay <span>{current.holdings.length} positions</span></summary>
          <div className="current-holdings"><div className="current-head"><span>ETF</span><span>What it follows</span><span>Value</span><span>Beta</span><span>Weight</span></div>{current.holdings.map((holding) => <div className={`current-row ${holding.weight > 10 ? "over-cap" : ""}`} key={holding.ticker}><b>{holding.ticker}{holding.leveraged && <sup>L</sup>}</b><span>{holding.name}</span><span>{money.format(holding.valueGbp)}</span><span>{holding.beta?.toFixed(2) ?? "n/a"}</span><strong>{holding.weight.toFixed(1)}%</strong></div>)}</div>
        </details>
      </div>

      <div id="workspace-panel-monthly" role="tabpanel" aria-labelledby="workspace-tab-monthly" hidden={workspaceTab !== "monthly"}>
        <div className="panel-intro"><div><p className="eyebrow">open any historical month</p><h2>{selected.label}</h2></div><p>This month checked {selected.universeCount.toLocaleString("en-GB")} ETFs that were alive and priced in the reconstructed universe. The tape shows the ranking, three buys and resulting portfolio.</p></div>
        <div className="month-picker"><button onClick={() => setMonthIndex(Math.max(0, monthIndex - 1))} disabled={monthIndex === 0} aria-label="Previous month">&larr;</button><input aria-label="Backtest month" type="range" min="0" max={backtest.months.length - 1} value={monthIndex} onChange={(event) => setMonthIndex(Number(event.target.value))} /><button onClick={() => setMonthIndex(Math.min(backtest.months.length - 1, monthIndex + 1))} disabled={monthIndex === backtest.months.length - 1} aria-label="Next month">&rarr;</button><span>{monthIndex + 1} / {backtest.months.length}</span></div>
        <div className="metric-strip month-strip"><div><span>my pot</span><strong>{money.format(selected.strategyValueGbp)}</strong></div><div><span>SPY pot</span><strong>{money.format(selected.benchmarkValueGbp)}</strong></div><div><span>cash gap</span><strong>{signedMoney(selected.alphaGbp)}</strong></div><div><span>eligible / alive</span><strong>{selected.eligibleCount} / {selected.universeCount.toLocaleString("en-GB")}</strong></div></div>
        {selected.liquidations.length > 0 && <div className="liquidation-note"><b>A fund disappeared.</b> {selected.liquidations.map((item) => `${item.ticker} closed, so ${money.format(item.valueGbp)} moved to cash`).join(". ")}.</div>}

        <div className="subsection-heading"><div><p className="eyebrow">that month&apos;s contribution</p><h3>{money.format(selected.contributionGbp)} split three ways</h3></div><p>The 10% line is soft. I skip an oversized holding if another top-ten candidate is available, but I do not sell winners just for crossing it.</p></div>
        <div className="pick-table">
          <div className="pick-head"><span>#</span><span>ETF</span><span>Name</span><span>Beta</span><span>3 months</span><span>Paper buy</span></div>
          {selected.trades.map((trade, index) => <div className="pick-row" key={trade.ticker}><span>0{index + 1}</span><b>{trade.ticker}{trade.leveraged && <sup>L</sup>}</b><span>{trade.name}</span><span>{trade.beta.toFixed(2)}</span><strong>{signedPercent(trade.momentum)}</strong><span>{money.format(trade.allocationGbp)}</span></div>)}
        </div>

        <div className="details-grid">
          <details><summary>Top ten ranking <span>after the beta shortlist</span></summary><div className="data-table ranking-table"><div className="data-head"><span>#</span><span>ETF</span><span>Beta</span><span>3 months</span></div>{selected.ranking.map((fund) => <div className="data-row" key={fund.ticker}><span>{fund.rank}</span><b>{fund.ticker}{fund.leveraged && <sup>L</sup>}</b><span>{fund.beta.toFixed(2)}</span><strong>{signedPercent(fund.momentum)}</strong></div>)}</div></details>
          <details><summary>Portfolio after that month <span>{selected.holdings.length} positions</span></summary><div className="data-table holding-table"><div className="data-head"><span>ETF</span><span>Value</span><span>Weight</span></div>{selected.holdings.map((holding) => <div className={`data-row ${holding.weight > 10 ? "over-cap" : ""}`} key={holding.ticker}><b>{holding.ticker}{holding.leveraged && <sup>L</sup>}</b><span>{money.format(holding.valueGbp)}</span><strong>{holding.weight.toFixed(1)}%</strong></div>)}</div></details>
        </div>
      </div>

      <div id="workspace-panel-method" role="tabpanel" aria-labelledby="workspace-tab-method" hidden={workspaceTab !== "method"}>
        <div className="panel-intro"><div><p className="eyebrow">the variables, without the theatre</p><h2>Why these rules?</h2></div><p>The point is consistency, not pretending the numbers are magical. Each boundary gives this deliberately risky experiment a repeatable decision.</p></div>
        <div className="method-list">
          <article><span>01 / cash</span><h3>Why £491.25?</h3><p>A typical full-time London salary is £49,692 gross. Using the 2026/27 Income Tax and National Insurance assumptions, that is about £39,298 a year or £3,275 a month after tax. Fifteen per cent of £3,275 is £491.25.</p><small>I use the median, not the £70,275 mean, because very high London salaries pull the mean upwards. Pension and student loan deductions are outside this base figure.</small></article>
          <article><span>02 / saving rate</span><h3>Why 15%?</h3><p>It is large enough to make regular investing meaningful while leaving most monthly take-home outside the experiment. Here it is only a way to size fake deposits, not a personal recommendation.</p></article>
          <article><span>03 / risk filter</span><h3>Why beta 1.5 to 3?</h3><p>Below 1.5 is too calm for the question I am testing. Above 3 is often so extreme that a noisy daily move can dominate the shortlist. The range deliberately seeks more market sensitivity without making beta unlimited.</p><small>Beta measures past co-movement, not future return. Daily-leveraged funds can still enter and bring reset risk.</small></article>
          <article><span>04 / ranking</span><h3>Why 15, then ten?</h3><p>I first take the 15 highest-beta ETFs inside the range, then choose the ten with the best previous three months. The first sort finds movement; the second asks whether that movement has recently been upward. It removes my mood from the choice, but momentum can reverse quickly.</p></article>
          <article><span>05 / purchases</span><h3>Why only three?</h3><p>Buying the three highest-ranked eligible names keeps the bet concentrated enough to test the idea without making it a single-fund gamble. The month&apos;s full £491.25 is divided evenly.</p></article>
          <article><span>06 / concentration</span><h3>Why a soft 10% line?</h3><p>I prefer picks below 10% of the existing portfolio so one ETF does not receive every new contribution. It is not a hard cap: I skip adding when I can, but I do not automatically sell a winner that grows beyond it.</p></article>
          <article><span>07 / timing</span><h3>Why monthly?</h3><p>The signal locks only after a month closes. The forward account then waits for the next shared market session before recording its paper buy. That makes the decision reproducible and keeps the live record honest. Time is the one advantage I definitely have.</p></article>
        </div>
      </div>

      <div id="workspace-panel-limits" role="tabpanel" aria-labelledby="workspace-tab-limits" hidden={workspaceTab !== "limits"}>
        <div className="panel-intro"><div><p className="eyebrow">the boring but important end</p><h2>What the backtest cannot prove</h2></div><p>A neat historical line can make a fragile strategy look inevitable. This one is useful as a question generator, not evidence that the future owes me the same result.</p></div>
        <div className="limits-list">
          <article><span>01</span><div><h3>Survivorship is reduced, not eliminated</h3><p>This public-data reconstruction includes {backtest.universeCoverage.pricedClosures.toLocaleString("en-GB")} priced closed-fund histories and rebuilds which funds were available each month. But the closure register begins in 2024, so April 2022 through December 2023 remains less complete and more vulnerable to missing failures.</p></div></article>
          <article><span>02</span><div><h3>The historical execution is too tidy</h3><p>The replay ranks and buys using month-end closes. In practice, I could not know the final close and fill at that exact price. The forward account fixes this from September 2026 onward by locking the signal first and buying on a later session.</p></div></article>
          <article><span>03</span><div><h3>The rule itself saw the past</h3><p>I chose beta, momentum windows and thresholds after markets had already produced this history. That creates data-snooping and overfitting risk even when the calculation is correct.</p></div></article>
          <article><span>04</span><div><h3>Public price histories are imperfect</h3><p>Providers can revise adjusted closes, omit final distributions, rename tickers or lose delisted histories. Missing data and ticker collisions are excluded, which can still tilt the result.</p></div></article>
          <article><span>05</span><div><h3>Trading is frictionless here</h3><p>There are no fees, bid-ask spreads, slippage, taxes or liquidity limits. Fractional units fill perfectly. A real account would keep less of every return.</p></div></article>
          <article><span>06</span><div><h3>Leveraged ETFs are path-dependent</h3><p>A daily-leveraged fund resets every day. Volatility drag means its long-run result is not simply two or three times its index, and a severe fall can permanently damage the position.</p></div></article>
          <article><span>07</span><div><h3>The signals can stop working</h3><p>Beta changes, momentum reverses and correlations rise in stressed markets. A 20 to 30 year horizon does not make a weak selection rule safe.</p></div></article>
          <article><span>08</span><div><h3>Currency and behaviour are missing</h3><p>The account is measured in pounds while many funds trade in dollars, so GBP/USD matters. Paper losses also feel nothing like real losses, and the model cannot test whether I would actually keep buying through a drawdown.</p></div></article>
        </div>
        <div className="disclaimer"><strong>This is not financial advice.</strong><p>It is a deliberately aggressive model using pretend money, incomplete historical data and assumptions that favour clean execution. It can underperform or lose heavily. That&apos;s why it stays a paper experiment on this public page.</p></div>
      </div>
    </section>

    <footer><span>Made by Michail, mostly out of curiosity</span><span>Market data refreshed monthly &middot; {new Date(backtest.generatedAt).toLocaleDateString("en-GB")}</span></footer>
  </main>;
}
