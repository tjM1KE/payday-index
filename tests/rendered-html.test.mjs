import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Payday Index app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Payday Index \| Paper portfolio<\/title>/i);
  assert.match(html, /Buy on payday/);
  assert.match(html, /£491\.25/);
  assert.match(html, /Simulation only/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("describes the strategy without source attribution", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /higher-beta ETFs/);
  assert.match(html, /20 to 30 years/);
  assert.match(html, /10%/);
  assert.doesNotMatch(html, /YouTube|Robinhood|Coding Jesus/i);
});
