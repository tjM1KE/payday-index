import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MONTHLY_CONTRIBUTION_GBP = 491.25;
const START_MONTH = "2024-01";
const MARKET = "SPY";
const FX = "GBPUSD=X";
const BETA_MIN = 1.5;
const BETA_MAX = 3;

const universe = [
  ["ARKK", "ARK Innovation", false], ["ARKW", "Next Generation Internet", false],
  ["ARKG", "Genomic Revolution", false], ["ARKQ", "Autonomous Technology", false],
  ["ARKF", "Fintech Innovation", false], ["PRNT", "3D Printing", false],
  ["ARKX", "Space Exploration", false], ["BLOK", "Blockchain equities", false],
  ["BKCH", "Blockchain companies", false], ["BITQ", "Crypto industry", false],
  ["WGMI", "Bitcoin miners", false], ["DAPP", "Digital assets equities", false],
  ["FDIG", "Crypto industry and digital payments", false], ["CRPT", "Crypto industry innovators", false],
  ["TAN", "Solar energy", false], ["PBW", "Clean energy", false],
  ["QCLN", "Clean energy and technology", false], ["ICLN", "Global clean energy", false],
  ["LIT", "Lithium and batteries", false], ["REMX", "Rare earth and strategic metals", false],
  ["URA", "Uranium", false], ["URNM", "Uranium miners", false],
  ["COPX", "Copper miners", false], ["GDXJ", "Junior gold miners", false],
  ["SILJ", "Junior silver miners", false], ["XBI", "Biotechnology", false],
  ["PSIL", "Psychedelics", false], ["MSOS", "US cannabis", false],
  ["MJ", "Cannabis", false], ["KWEB", "China internet", false],
  ["CQQQ", "China technology", false], ["EMQQ", "Emerging markets internet", false],
  ["SOXX", "Semiconductors", false], ["SMH", "Semiconductors", false],
  ["XSD", "Semiconductors equal weight", false], ["PSI", "Dynamic semiconductors", false],
  ["IGV", "Expanded technology software", false], ["FDN", "Internet companies", false],
  ["CLOU", "Cloud computing", false], ["WCLD", "Cloud computing", false],
  ["SKYY", "Cloud computing", false], ["HACK", "Cybersecurity", false],
  ["CIBR", "Cybersecurity", false], ["BOTZ", "Robotics and AI", false],
  ["ROBO", "Robotics and automation", false], ["DRIV", "Autonomous and electric vehicles", false],
  ["IPO", "Recent IPOs", false], ["SPHB", "S&P 500 high beta", false],
  ["IWO", "Russell 2000 growth", false], ["VBK", "Small-cap growth", false],
  ["XOP", "Oil and gas exploration", false], ["OIH", "Oil services", false],
  ["XME", "Metals and mining", false], ["JETS", "Airlines", false],
  ["PEJ", "Leisure and entertainment", false], ["XRT", "Retail", false],
  ["ITB", "US home construction", false], ["KRE", "Regional banks", false],
  ["ONLN", "Online retail", false], ["FINX", "Fintech", false],
  ["IPAY", "Digital payments", false], ["QLD", "Nasdaq 100 2x daily", true],
  ["SSO", "S&P 500 2x daily", true], ["UWM", "Russell 2000 2x daily", true],
  ["ROM", "Technology 2x daily", true], ["USD", "Semiconductors 2x daily", true],
  ["UYG", "Financials 2x daily", true], ["UCC", "Consumer discretionary 2x daily", true],
  ["DIG", "Oil and gas 2x daily", true], ["AGQ", "Silver 2x daily", true],
  ["TQQQ", "Nasdaq 100 3x daily", true], ["UPRO", "S&P 500 3x daily", true],
  ["SPXL", "S&P 500 3x daily", true], ["SOXL", "Semiconductors 3x daily", true],
  ["TECL", "Technology 3x daily", true], ["TNA", "Russell 2000 3x daily", true],
  ["FAS", "Financials 3x daily", true], ["LABU", "Biotechnology 3x daily", true],
  ["NAIL", "Homebuilders 3x daily", true], ["WEBL", "Internet 3x daily", true],
].map(([ticker, name, leveraged]) => ({ ticker, name, leveraged }));

const period1 = Math.floor(Date.UTC(2022, 11, 1) / 1000);
const period2 = Math.floor((Date.now() + 86_400_000) / 1000);

async function fetchSeries(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Payday-Index/1.0" } });
  if (!response.ok) throw new Error(`${ticker}: ${response.status}`);
  const chart = (await response.json()).chart?.result?.[0];
  if (!chart) throw new Error(`${ticker}: no chart data`);
  const adjusted = chart.indicators?.adjclose?.[0]?.adjclose ?? chart.indicators?.quote?.[0]?.close;
  return chart.timestamp.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    price: adjusted[index],
  })).filter((point) => Number.isFinite(point.price));
}

async function fetchAll() {
  const tickers = [MARKET, FX, ...universe.map((fund) => fund.ticker)];
  const result = {};
  const failures = [];
  for (let index = 0; index < tickers.length; index += 8) {
    const batch = tickers.slice(index, index + 8);
    const settled = await Promise.allSettled(batch.map(fetchSeries));
    settled.forEach((item, batchIndex) => {
      const ticker = batch[batchIndex];
      if (item.status === "fulfilled") result[ticker] = item.value;
      else failures.push({ ticker, reason: item.reason.message });
    });
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

function priceAt(series, cutoff) {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (series[index].date <= cutoff) return series[index].price;
  }
  return null;
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

function buildBacktest(series, failures) {
  const funds = universe.filter((fund) => series[fund.ticker]);
  const holdings = new Map();
  let benchmarkUnits = 0;
  let contributedGbp = 0;
  const records = [];

  for (const month of completedMonths()) {
    const cutoff = monthEnd(month);
    const fx = priceAt(series[FX], cutoff);
    const spyPrice = priceAt(series[MARKET], cutoff);
    if (!fx || !spyPrice) continue;

    const candidates = funds.map((fund) => {
      const price = priceAt(series[fund.ticker], cutoff);
      const threeMonthsAgo = priceAt(series[fund.ticker], monthEnd(previousMonth(month, 3)));
      const beta = betaAt(series[fund.ticker], series[MARKET], cutoff);
      const momentum = price && threeMonthsAgo ? price / threeMonthsAgo - 1 : null;
      return { ...fund, price, beta, momentum };
    }).filter((fund) => fund.price && fund.beta >= BETA_MIN && fund.beta <= BETA_MAX && Number.isFinite(fund.momentum));

    const betaLeaders = candidates.sort((a, b) => b.beta - a.beta).slice(0, 15);
    const momentumLeaders = betaLeaders.sort((a, b) => b.momentum - a.momentum).slice(0, 10);
    const valueBeforeGbp = [...holdings.entries()].reduce((sum, [ticker, position]) => {
      const price = priceAt(series[ticker], cutoff);
      return sum + (price ? position.units * price / fx : 0);
    }, 0);
    const underCap = momentumLeaders.filter((fund) => {
      if (!valueBeforeGbp) return true;
      const position = holdings.get(fund.ticker);
      const value = position ? position.units * fund.price / fx : 0;
      return value / valueBeforeGbp < 0.10;
    });
    const selected = [...underCap, ...momentumLeaders.filter((fund) => !underCap.includes(fund))].slice(0, 3);
    if (!selected.length) continue;

    const allocationGbp = MONTHLY_CONTRIBUTION_GBP / selected.length;
    const trades = selected.map((fund) => {
      const allocationUsd = allocationGbp * fx;
      const units = allocationUsd / fund.price;
      const existing = holdings.get(fund.ticker) ?? { units: 0, contributedGbp: 0, name: fund.name, leveraged: fund.leveraged };
      holdings.set(fund.ticker, { ...existing, units: existing.units + units, contributedGbp: existing.contributedGbp + allocationGbp });
      return { ticker: fund.ticker, name: fund.name, beta: round(fund.beta), momentum: round(fund.momentum * 100), allocationGbp: round(allocationGbp), units: round(units, 6), leveraged: fund.leveraged };
    });

    contributedGbp += MONTHLY_CONTRIBUTION_GBP;
    benchmarkUnits += MONTHLY_CONTRIBUTION_GBP * fx / spyPrice;
    const portfolioHoldings = [...holdings.entries()].map(([ticker, position]) => {
      const price = priceAt(series[ticker], cutoff);
      const valueGbp = position.units * price / fx;
      const beta = betaAt(series[ticker], series[MARKET], cutoff);
      return { ticker, name: position.name, valueGbp, contributedGbp: position.contributedGbp, beta, leveraged: position.leveraged };
    }).sort((a, b) => b.valueGbp - a.valueGbp);
    const strategyValueGbp = portfolioHoldings.reduce((sum, holding) => sum + holding.valueGbp, 0);
    const benchmarkValueGbp = benchmarkUnits * spyPrice / fx;
    const weightedBeta = portfolioHoldings.reduce((sum, holding) => sum + (holding.beta ?? 0) * holding.valueGbp, 0) / strategyValueGbp;

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
      eligibleCount: candidates.length,
      trades,
      ranking: momentumLeaders.map((fund, index) => ({ rank: index + 1, ticker: fund.ticker, name: fund.name, beta: round(fund.beta), momentum: round(fund.momentum * 100), leveraged: fund.leveraged })),
      holdings: portfolioHoldings.map((holding) => ({
        ticker: holding.ticker,
        name: holding.name,
        valueGbp: round(holding.valueGbp),
        contributedGbp: round(holding.contributedGbp),
        weight: round(holding.valueGbp / strategyValueGbp * 100),
        beta: holding.beta ? round(holding.beta) : null,
        leveraged: holding.leveraged,
      })),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    throughMonth: records.at(-1)?.month ?? null,
    monthlyContributionGbp: MONTHLY_CONTRIBUTION_GBP,
    startMonth: START_MONTH,
    benchmark: "SPY, an investable S&P 500 proxy",
    betaRange: [BETA_MIN, BETA_MAX],
    universeSize: funds.length,
    missingTickers: failures,
    methodology: {
      beta: "Trailing 252-session beta of adjusted daily returns against SPY, with at least 126 observations.",
      momentum: "Adjusted-price return over the previous three completed month ends.",
      selection: "Take the 15 highest-beta eligible ETFs, rank those by three-month momentum, then buy the best three from the top ten. Prefer candidates below 10% of the portfolio; never force a sale.",
      timing: "Contribute and buy at each completed month-end. Fractional total-return units are used.",
      currency: "Convert each GBP contribution into USD at that month-end GBP/USD rate, then translate portfolio values back into GBP.",
      caveat: "The candidate universe is fixed today, so results include survivorship and universe-selection bias. Daily-reset leveraged ETFs are included and labelled.",
    },
    months: records,
    current: records.at(-1) ?? null,
  };
}

const { result, failures } = await fetchAll();
const backtest = buildBacktest(result, failures);
const output = resolve("app/data/backtest.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(backtest, null, 2)}\n`, "utf8");
console.log(`Wrote ${backtest.months.length} months through ${backtest.throughMonth} to ${output}`);
