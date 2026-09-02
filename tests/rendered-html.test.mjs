import assert from "node:assert/strict";
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
  assert.match(html, /<title>Payday Index \| Paper portfolio<\/title>/i);
  assert.match(html, /Screen\. Rank\./);
  assert.match(html, /January 2024/);
  assert.match(html, /S&amp;P 500 proxy/);
  assert.match(html, /20 to 30 years/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("states the strategy without source attribution", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /15 highest-beta candidates/);
  assert.match(html, /trailing three-month return/);
  assert.match(html, /soft 10% position limit/);
  assert.match(html, /Daily-leveraged products/);
  assert.doesNotMatch(html, /YouTube|Robinhood|Coding Jesus/i);
});
