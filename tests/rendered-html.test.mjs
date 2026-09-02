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
  assert.match(html, /<title>Payday Index \| My risky paper experiment<\/title>/i);
  assert.match(html, /What if I/);
  assert.match(html, /My paper-money experiment/);
  assert.match(html, /sensible S&amp;P 500 option/);
  assert.match(html, /20 to 30 years/);
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
  assert.doesNotMatch(html, /YouTube|Robinhood|Coding Jesus/i);
});
