import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", init = {}, bindings = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "text/html");
  return worker.fetch(new Request(`http://localhost${path}`, { ...init, headers }), { ASSETS:{ fetch:async () => new Response("Not found", { status:404 }) }, ...bindings }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the data-backed Payday Index app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Payday Index \| My risky paper experiment<\/title>/i);
  assert.match(html, /Michail Khasaev/);
  assert.match(html, /long-term portfolio/);
  assert.match(html, /data-tip="20 to 30 years"/);
  assert.match(html, /data-tip="funnily this is a risk-seeking strategy"/);
  assert.match(html, /Live forward paper account/i);
  assert.match(html, /Strategy sections/);
  assert.match(html, /20 to 30 years/);
  assert.match(html, /from <b>Apr 2022<\/b>/);
  assert.match(html, /Why £491\.25\?/);
  assert.match(html, /£49,692 gross/);
  assert.match(html, /£39,298 a year/);
  assert.match(html, /£3,275 a month/);
  assert.match(html, /£70,275 mean/);
  assert.match(html, /2026\/27 Income Tax/);
  assert.match(html, /Income Tax and National Insurance/);
  assert.match(html, /Performance start month/);
  assert.match(html, /Performance end month/);
  assert.match(html, /Nasdaq-100/);
  assert.match(html, /World stocks/);
  assert.match(html, /These are cash values/);
  assert.match(html, /cannot quietly rewrite later/);
  assert.match(html, /signal frozen/i);
  assert.match(html, /paper buy/i);
  assert.match(html, /53<!-- --> paydays/);
  assert.match(html, /£26,036\.25/);
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
  assert.match(backtest.methodology.comparisons, /identical GBP 491\.25 month-end contributions/);
  assert.match(backtest.methodology.caveat, /not CRSP-grade/);
});

test("full-range comparison reconciles with the headline pots", async () => {
  const backtest = JSON.parse(await readFile(new URL("../app/data/backtest.json", import.meta.url), "utf8"));
  let strategy = 0;
  let spy = 0;
  for (let index = 0; index < backtest.months.length; index += 1) {
    const month = backtest.months[index];
    if (index > 0) {
      const previous = backtest.months[index - 1];
      strategy *= (month.strategyValueGbp - month.contributionGbp) / previous.strategyValueGbp;
      spy *= (month.benchmarks.SPY.valueGbp - month.contributionGbp) / previous.benchmarks.SPY.valueGbp;
    }
    strategy += backtest.monthlyContributionGbp;
    spy += backtest.monthlyContributionGbp;
  }
  assert.ok(Math.abs(strategy - backtest.current.strategyValueGbp) < 0.005);
  assert.ok(Math.abs(spy - backtest.current.benchmarks.SPY.valueGbp) < 0.005);
  assert.ok(Math.abs(strategy - spy - backtest.current.alphaGbp) < 0.005);
});

test("keeps an append-only forward paper ledger", async () => {
  const ledger = JSON.parse(await readFile(new URL("../app/data/forward-paper.json", import.meta.url), "utf8"));
  assert.equal(ledger.version, 1);
  assert.equal(ledger.status, "forward");
  assert.ok(ledger.records.length >= 1);
  assert.equal(ledger.records[0].signalMonth, "2026-08");
  assert.deepEqual(ledger.current, ledger.records.at(-1));
  assert.equal(new Set(ledger.records.map((record) => record.signalMonth)).size, ledger.records.length);
  assert.ok(ledger.records.every((record) => record.locked && record.executionDate > record.signalDate));
  assert.ok(ledger.records.every((record) => record.trades.length === 3));
  assert.ok(ledger.records.every((record) => Math.abs(record.trades.reduce((sum, trade) => sum + trade.allocationGbp, 0) - 491.25) < 0.01));
  assert.deepEqual(Object.keys(ledger.current.benchmarks), ["SPY", "QQQ", "VT"]);
  const historyHash = createHash("sha256").update(JSON.stringify(ledger.records)).digest("hex");
  assert.equal(ledger.historyHash, historyHash);
});

test("serves the committed forward ledger when durable storage is empty", async () => {
  const response = await render("/api/forward-paper");
  assert.equal(response.status, 200);
  const ledger = await response.json();
  assert.equal(ledger.status, "forward");
  assert.equal(ledger.current.signalMonth, "2026-08");
});

test("syncs the forward ledger without allowing old records to change", async () => {
  const ledger = JSON.parse(await readFile(new URL("../app/data/forward-paper.json", import.meta.url), "utf8"));
  let storedPayload = null;
  const DB = {
    prepare(statement) {
      return {
        async first() {
          return statement.startsWith("SELECT") && storedPayload ? { payload:storedPayload } : null;
        },
        bind(payload) {
          return { async run() { storedPayload = payload; return { success:true }; } };
        },
      };
    },
  };
  const bindings = { DB, FORWARD_SYNC_TOKEN:"test-sync-token" };
  const request = (body) => render("/api/forward-paper", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ token:"test-sync-token", ledger:body }),
  }, bindings);

  const synced = await request(ledger);
  assert.equal(synced.status, 200);
  assert.equal(JSON.parse(storedPayload).historyHash, ledger.historyHash);

  const rewritten = structuredClone(ledger);
  rewritten.records[0].trades[0].allocationGbp += 1;
  const rejected = await request(rewritten);
  assert.equal(rejected.status, 409);
});
