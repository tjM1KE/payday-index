import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import closedEtfsJson from "./data/closed-etfs.json" with { type: "json" };

const MONTHLY_CONTRIBUTION_GBP = 491.25;
const START_MONTH = "2024-01";
const MARKET = "SPY";
const FX = "GBPUSD=X";
const BETA_MIN = 1.5;
const BETA_MAX = 3;
const HISTORY_START = "2022-12-01";
const UNIVERSE_STATE_PATH = resolve("scripts/data/universe.json");
const OUTPUT_PATH = resolve("app/data/backtest.json");
const NASDAQ_ETF_URL = "https://api.nasdaq.com/api/screener/etf?download=true";

const period1 = Math.floor(new Date(`${HISTORY_START}T00:00:00Z`).getTime() / 1000);
const period2 = Math.floor((Date.now() + 86_400_000) / 1000);
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

function isLeveraged(name) {
  return /\b(?:1\.5x|2x|3x|double|triple|leveraged|ultra|daily target|daily bull)\b/i.test(name);
}

function isEtn(name) {
  return /\bETN(?:s)?\b|exchange.traded note/i.test(name);
}

function cleanTicker(ticker) {
  return ticker.trim().toUpperCase().replace(/\^/g, "-P").replace(/[./]/g, "-");
}

function fundId(fund) {
  return `${fund.ticker}@${fund.closedOn ?? "active"}`;
}

async function loadUniverseState() {
  try {
    return JSON.parse(await readFile(UNIVERSE_STATE_PATH, "utf8"));
  } catch {
    return { active: [], observedClosures: [] };
  }
}

async function fetchNasdaqFunds() {
  const response = await fetch(NASDAQ_ETF_URL, {
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Origin": "https://www.nasdaq.com",
      "Referer": "https://www.nasdaq.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Payday-Index/2.0",
    },
  });
  if (!response.ok) throw new Error(`Nasdaq ETF universe: ${response.status}`);
  const rows = (await response.json()).data?.data?.rows;
  if (!Array.isArray(rows) || rows.length < 1000) throw new Error("Nasdaq ETF universe was incomplete");
  return rows.map((row) => ({
    ticker: cleanTicker(row.symbol),
    name: row.companyName.trim(),
    leveraged: isLeveraged(row.companyName),
  })).filter((fund) => fund.ticker && fund.name && !isEtn(fund.name));
}

async function buildUniverse() {
  const previous = await loadUniverseState();
  let active;
  let nasdaqAvailable = true;
  try {
    active = await fetchNasdaqFunds();
  } catch (error) {
    nasdaqAvailable = false;
    active = previous.active ?? [];
    if (!active.length) throw error;
    console.warn(`${error.message}; using the last committed Nasdaq snapshot`);
  }

  const activeByTicker = new Map(active.map((fund) => [fund.ticker, fund]));
  const observedClosures = [...(previous.observedClosures ?? [])];
  const observedKeys = new Set(observedClosures.map((fund) => `${fund.ticker}:${fund.closedOn}`));
  const asOf = new Date().toISOString().slice(0, 10);
  const today = new Date();
  const observedClosedOn = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)).toISOString().slice(0, 10);

  if (nasdaqAvailable) {
    for (const oldFund of previous.active ?? []) {
      if (!activeByTicker.has(oldFund.ticker)) {
        const closure = { ...oldFund, closedOn: observedClosedOn, source: "monthly Nasdaq disappearance" };
        const key = `${closure.ticker}:${closure.closedOn}`;
        if (!observedKeys.has(key)) {
          observedClosures.push(closure);
          observedKeys.add(key);
        }
      }
    }
  }

  const seededClosures = closedEtfsJson.funds.map((fund) => ({
    ticker: cleanTicker(fund.ticker),
    name: fund.name,
    closedOn: fund.closedOn,
    leveraged: isLeveraged(fund.name),
    source: "ETF.com closure register",
  })).filter((fund) => !isEtn(fund.name));
  const closures = [...seededClosures, ...observedClosures];
  const closedByTicker = new Map();
  for (const fund of closures) {
    const list = closedByTicker.get(fund.ticker) ?? [];
    list.push(fund);
    closedByTicker.set(fund.ticker, list);
  }

  const collisionTickers = new Set(
    [...closedByTicker.entries()]
      .filter(([ticker, funds]) => activeByTicker.has(ticker) || funds.length > 1)
      .map(([ticker]) => ticker),
  );
  const funds = [
    ...active.filter((fund) => !collisionTickers.has(fund.ticker)).map((fund) => ({ ...fund, closedOn: null, source: "Nasdaq ETF screener" })),
    ...closures.filter((fund) => !collisionTickers.has(fund.ticker)),
  ].map((fund) => ({ ...fund, id: fundId(fund) }));

  const state = {
    asOf,
    source: NASDAQ_ETF_URL,
    active,
    observedClosures: observedClosures.sort((a, b) => a.closedOn.localeCompare(b.closedOn) || a.ticker.localeCompare(b.ticker)),
  };
  await mkdir(dirname(UNIVERSE_STATE_PATH), { recursive: true });
  await writeFile(UNIVERSE_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  return {
    funds,
    counts: {
      activeListed: active.length,
      seededClosures: seededClosures.length,
      observedClosures: observedClosures.length,
      tickerCollisionsExcluded: collisionTickers.size,
    },
  };
}

async function fetchSeries(ticker, attempt = 1) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Payday-Index/2.0" } });
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await sleep(700 * attempt);
    return fetchSeries(ticker, attempt + 1);
  }
  if (!response.ok) throw new Error(`${ticker}: ${response.status}`);
  const chart = (await response.json()).chart?.result?.[0];
  if (!chart?.timestamp) throw new Error(`${ticker}: no chart data`);
  const adjusted = chart.indicators?.adjclose?.[0]?.adjclose ?? chart.indicators?.quote?.[0]?.close;
  return chart.timestamp.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    price: adjusted[index],
  })).filter((point) => Number.isFinite(point.price));
}

async function fetchAll(funds) {
  const tickers = [...new Set([MARKET, FX, ...funds.map((fund) => fund.ticker)])];
  const result = {};
  const failures = [];
  const batchSize = 24;
  for (let index = 0; index < tickers.length; index += batchSize) {
    const batch = tickers.slice(index, index + batchSize);
    const settled = await Promise.allSettled(batch.map((ticker) => fetchSeries(ticker)));
    settled.forEach((item, batchIndex) => {
      const ticker = batch[batchIndex];
      if (item.status === "fulfilled" && item.value.length) result[ticker] = item.value;
      else failures.push({ ticker, reason: item.status === "rejected" ? item.reason.message : "empty series" });
    });
    if (index && index % 480 === 0) {
      console.log(`Fetched ${Math.min(index + batchSize, tickers.length)} of ${tickers.length} histories`);
      await sleep(150);
    }
  }
  if (!result[MARKET] || !result[FX]) throw new Error("Benchmark or GBP/USD data unavailable");
  return { result, failures };
}

function monthEnd(month) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

function previousMonth(month, count = 1) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 - count, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function completedMonths() {
  const now = new Date();
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const cursor = new Date(`${START_MONTH}-01T00:00:00Z`);
  const months = [];
  while (cursor <= last) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function pointAt(series, cutoff) {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (series[index].date <= cutoff) return series[index];
  }
  return null;
}

function priceAt(series, cutoff) {
  return pointAt(series, cutoff)?.price ?? null;
}

function hasFreshPrice(series, cutoff, maxAgeDays = 10) {
  const point = pointAt(series, cutoff);
  if (!point) return false;
  const age = (new Date(`${cutoff}T00:00:00Z`) - new Date(`${point.date}T00:00:00Z`)) / 86_400_000;
  return age <= maxAgeDays;
}

function isAliveAt(fund, series, cutoff) {
  if (!series?.length || series[0].date > cutoff) return false;
  if (fund.closedOn && fund.closedOn <= cutoff) return false;
  return hasFreshPrice(series, cutoff);
}

function betaAt(series, market, cutoff) {
  const fund = new Map(series.filter((point) => point.date <= cutoff).map((point) => [point.date, point.price]));
  const aligned = market.filter((point) => point.date <= cutoff && fund.has(point.date));
  const fundReturns = [];
  const marketReturns = [];
  for (let index = 1; index < aligned.length; index += 1) {
    const previous = aligned[index - 1];
    const current = aligned[index];
    const fundReturn = fund.get(current.date) / fund.get(previous.date) - 1;
    const marketReturn = current.price / previous.price - 1;
    if (Number.isFinite(fundReturn) && Number.isFinite(marketReturn)) {
      fundReturns.push(fundReturn);
      marketReturns.push(marketReturn);
    }
  }
  const sampleFund = fundReturns.slice(-252);
  const sampleMarket = marketReturns.slice(-252);
  if (sampleFund.length < 126) return null;
  const marketMean = sampleMarket.reduce((sum, value) => sum + value, 0) / sampleMarket.length;
  const fundMean = sampleFund.reduce((sum, value) => sum + value, 0) / sampleFund.length;
  let covariance = 0;
  let variance = 0;
  for (let index = 0; index < sampleFund.length; index += 1) {
    covariance += (sampleFund[index] - fundMean) * (sampleMarket[index] - marketMean);
    variance += (sampleMarket[index] - marketMean) ** 2;
  }
  return variance ? covariance / variance : null;
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function labelFor(month) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

function buildBacktest(universe, series, failures) {
  const pricedFunds = universe.funds.filter((fund) => series[fund.ticker]);
  const fundsById = new Map(pricedFunds.map((fund) => [fund.id, fund]));
  const holdings = new Map();
  let cashGbp = 0;
  let benchmarkUnits = 0;
  let contributedGbp = 0;
  const records = [];

  for (const month of completedMonths()) {
    const cutoff = monthEnd(month);
    const fx = priceAt(series[FX], cutoff);
    const spyPrice = priceAt(series[MARKET], cutoff);
    if (!fx || !spyPrice) continue;

    const liquidations = [];
    for (const [id, position] of holdings) {
      const fund = fundsById.get(id);
      if (!fund?.closedOn || fund.closedOn > cutoff) continue;
      const terminalPrice = priceAt(series[fund.ticker], fund.closedOn);
      const terminalFx = priceAt(series[FX], fund.closedOn);
      if (!terminalPrice || !terminalFx) continue;
      const valueGbp = position.units * terminalPrice / terminalFx;
      cashGbp += valueGbp;
      holdings.delete(id);
      liquidations.push({ ticker: fund.ticker, closedOn: fund.closedOn, valueGbp: round(valueGbp) });
    }

    const candidates = pricedFunds.map((fund) => {
      const fundSeries = series[fund.ticker];
      if (!isAliveAt(fund, fundSeries, cutoff)) return null;
      const price = priceAt(fundSeries, cutoff);
      const threeMonthsAgo = priceAt(fundSeries, monthEnd(previousMonth(month, 3)));
      const beta = betaAt(fundSeries, series[MARKET], cutoff);
      const momentum = price && threeMonthsAgo ? price / threeMonthsAgo - 1 : null;
      return { ...fund, price, beta, momentum };
    }).filter((fund) => fund && fund.beta >= BETA_MIN && fund.beta <= BETA_MAX && Number.isFinite(fund.momentum));

    const betaLeaders = candidates.sort((a, b) => b.beta - a.beta).slice(0, 15);
    const momentumLeaders = betaLeaders.sort((a, b) => b.momentum - a.momentum).slice(0, 10);
    const investedBeforeGbp = [...holdings.entries()].reduce((sum, [id, position]) => {
      const fund = fundsById.get(id);
      const price = fund ? priceAt(series[fund.ticker], cutoff) : null;
      return sum + (price ? position.units * price / fx : 0);
    }, 0);
    const valueBeforeGbp = investedBeforeGbp + cashGbp;
    const underCap = momentumLeaders.filter((fund) => {
      if (!valueBeforeGbp) return true;
      const position = holdings.get(fund.id);
      const value = position ? position.units * fund.price / fx : 0;
      return value / valueBeforeGbp < 0.10;
    });
    const selected = [...underCap, ...momentumLeaders.filter((fund) => !underCap.includes(fund))].slice(0, 3);
    if (!selected.length) continue;

    const allocationGbp = MONTHLY_CONTRIBUTION_GBP / selected.length;
    const trades = selected.map((fund) => {
      const allocationUsd = allocationGbp * fx;
      const units = allocationUsd / fund.price;
      const existing = holdings.get(fund.id) ?? { units: 0, contributedGbp: 0 };
      holdings.set(fund.id, { units: existing.units + units, contributedGbp: existing.contributedGbp + allocationGbp });
      return { ticker: fund.ticker, name: fund.name, beta: round(fund.beta), momentum: round(fund.momentum * 100), allocationGbp: round(allocationGbp), units: round(units, 6), leveraged: fund.leveraged };
    });

    contributedGbp += MONTHLY_CONTRIBUTION_GBP;
    benchmarkUnits += MONTHLY_CONTRIBUTION_GBP * fx / spyPrice;
    const portfolioHoldings = [...holdings.entries()].map(([id, position]) => {
      const fund = fundsById.get(id);
      const price = priceAt(series[fund.ticker], cutoff);
      const valueGbp = position.units * price / fx;
      const beta = betaAt(series[fund.ticker], series[MARKET], cutoff);
      return { ticker: fund.ticker, name: fund.name, valueGbp, contributedGbp: position.contributedGbp, beta, leveraged: fund.leveraged };
    }).sort((a, b) => b.valueGbp - a.valueGbp);
    if (cashGbp > 0.005) {
      portfolioHoldings.push({ ticker: "CASH", name: "Cash from closed ETFs", valueGbp: cashGbp, contributedGbp: 0, beta: 0, leveraged: false });
    }
    const strategyValueGbp = portfolioHoldings.reduce((sum, holding) => sum + holding.valueGbp, 0);
    const benchmarkValueGbp = benchmarkUnits * spyPrice / fx;
    const weightedBeta = portfolioHoldings.reduce((sum, holding) => sum + (holding.beta ?? 0) * holding.valueGbp, 0) / strategyValueGbp;
    const aliveUniverseCount = pricedFunds.filter((fund) => isAliveAt(fund, series[fund.ticker], cutoff)).length;

    records.push({
      month,
      label: labelFor(month),
      contributionGbp: MONTHLY_CONTRIBUTION_GBP,
      contributedGbp: round(contributedGbp),
      strategyValueGbp: round(strategyValueGbp),
      benchmarkValueGbp: round(benchmarkValueGbp),
      alphaGbp: round(strategyValueGbp - benchmarkValueGbp),
      strategyReturnPct: round((strategyValueGbp / contributedGbp - 1) * 100),
      benchmarkReturnPct: round((benchmarkValueGbp / contributedGbp - 1) * 100),
      weightedBeta: round(weightedBeta),
      universeCount: aliveUniverseCount,
      eligibleCount: candidates.length,
      liquidations,
      trades,
      ranking: momentumLeaders.map((fund, index) => ({ rank: index + 1, ticker: fund.ticker, name: fund.name, beta: round(fund.beta), momentum: round(fund.momentum * 100), leveraged: fund.leveraged })),
      holdings: portfolioHoldings.map((holding) => ({
        ticker: holding.ticker,
        name: holding.name,
        valueGbp: round(holding.valueGbp),
        contributedGbp: round(holding.contributedGbp),
        weight: round(holding.valueGbp / strategyValueGbp * 100),
        beta: holding.beta === null ? null : round(holding.beta),
        leveraged: holding.leveraged,
      })),
    });
  }

  const pricedClosures = pricedFunds.filter((fund) => fund.closedOn).length;
  return {
    generatedAt: new Date().toISOString(),
    throughMonth: records.at(-1)?.month ?? null,
    monthlyContributionGbp: MONTHLY_CONTRIBUTION_GBP,
    startMonth: START_MONTH,
    benchmark: "SPY, an investable S&P 500 proxy",
    betaRange: [BETA_MIN, BETA_MAX],
    universeSize: pricedFunds.length,
    universeCoverage: {
      ...universe.counts,
      reconstructedFunds: universe.funds.length,
      pricedFunds: pricedFunds.length,
      pricedClosures,
      missingHistories: failures.length,
    },
    missingTickers: failures,
    methodology: {
      beta: "Trailing 252-session beta of adjusted daily returns against SPY, with at least 126 observations.",
      momentum: "Adjusted-price return over the previous three completed month ends.",
      selection: "Take the 15 highest-beta eligible ETFs, rank those by three-month momentum, then buy the best three from the top ten. Prefer candidates below 10% of the portfolio; never force a sale.",
      timing: "Contribute and buy at each completed month-end. Fractional total-return units are used.",
      currency: "Convert each GBP contribution into USD at that month-end GBP/USD rate, then translate portfolio values back into GBP.",
      universe: "For each month, use funds that were alive on that date from a reconstruction of the full Nasdaq ETF list and recorded US ETF closures since 2024. Funds need 126 matched trading sessions before they can qualify.",
      liquidation: "When a held ETF closes, convert its units to GBP at the last available adjusted price and closing-date FX rate, then keep the proceeds as cash.",
      caveat: "This public-data reconstruction reduces survivorship and hand-selection bias, but it is not CRSP-grade. Some delisted price histories, final liquidation distributions and ticker changes may be missing.",
    },
    months: records,
    current: records.at(-1) ?? null,
  };
}

const universe = await buildUniverse();
console.log(`Universe: ${universe.counts.activeListed} active, ${universe.counts.seededClosures} recorded closures, ${universe.counts.tickerCollisionsExcluded} ticker collisions excluded`);
const { result, failures } = await fetchAll(universe.funds);
const backtest = buildBacktest(universe, result, failures);
await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(backtest, null, 2)}\n`, "utf8");
console.log(`Wrote ${backtest.months.length} months through ${backtest.throughMonth} to ${OUTPUT_PATH}`);
console.log(`Coverage: ${backtest.universeCoverage.pricedFunds} priced funds, ${backtest.universeCoverage.pricedClosures} closed histories, ${backtest.universeCoverage.missingHistories} missing histories`);
