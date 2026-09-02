import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers:{ accept:"text/html" } }), { ASSETS:{ fetch:async () => new Response("Not found", { status:404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the data-backed Payday Index app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Payday Index \| My risky paper experiment<\/title>/i);
  assert.match(html, /What if I/);
  assert.match(html, /My paper-money experiment/);
  assert.match(html, /usual index options/);
  assert.match(html, /20 to 30 years/);
  assert.match(html, /from <b>Apr 2022<\/b>/);
  assert.match(html, /Why £491\.25\?/);
  assert.match(html, /£49,692 gross median/);
  assert.match(html, /£39,298 a year/);
  assert.match(html, /£3,275 a month/);
  assert.match(html, /£70,275 mean/);
  assert.match(html, /2026\/27 rates/);
  assert.match(html, /Income Tax and National Insurance/);
  assert.match(html, /Performance start month/);
  assert.match(html, /Performance end month/);
  assert.match(html, /Nasdaq-100/);
  assert.match(html, /World stocks/);
  assert.match(html, /Both lines equal 100/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("states the strategy without source attribution", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /15 highest-beta ETFs/);
  assert.match(html, /best previous three months/);
  assert.match(html, /prefer picks below 10%/);
  assert.match(html, /daily-leveraged fund/);
  assert.match(html, /Time is the one advantage I definitely have/);
  assert.match(html, /paper experiment on this public page/);
  assert.match(html, /public-data reconstruction/);
  assert.doesNotMatch(html, /candidate universe is fixed today/i);
  assert.doesNotMatch(html, /YouTube|Robinhood|Coding Jesus/i);
});

test("uses a broad point-in-time universe with closed funds", async () => {
  const backtest = JSON.parse(await readFile(new URL("../app/data/backtest.json", import.meta.url), "utf8"));
  assert.equal(backtest.startMonth, "2022-04");
  assert.equal(backtest.months[0].month, "2022-04");
  assert.deepEqual(backtest.benchmarks.map((benchmark) => benchmark.ticker), ["SPY", "QQQ", "VT"]);
  assert.ok(backtest.universeCoverage.activeListed > 5000);
  assert.ok(backtest.universeCoverage.pricedClosures > 500);
  assert.ok(backtest.months.every((month) => month.universeCount > 2000));
  assert.ok(backtest.months.every((month) => Number.isFinite(month.strategyMonthlyReturnPct)));
  assert.ok(backtest.months.every((month) => ["SPY", "QQQ", "VT"].every((ticker) => Number.isFinite(month.benchmarks[ticker].monthlyReturnPct))));
  assert.ok(backtest.months.some((month) => month.liquidations.length > 0));
  assert.ok(backtest.current.holdings.some((holding) => holding.ticker === "CASH"));
  assert.match(backtest.methodology.universe, /alive on that date/);
  assert.match(backtest.methodology.universe, /April 2022 to December 2023/);
  assert.match(backtest.methodology.comparisons, /time-weighted monthly performance/);
  assert.match(backtest.methodology.caveat, /not CRSP-grade/);
});
