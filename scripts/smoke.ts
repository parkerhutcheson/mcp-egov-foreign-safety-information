/**
 * Smoke test: calls every tool against the live MOFA data.
 *   npm run smoke                                   # in-process
 *   MCP_URL=http://localhost:3000/mcp npm run smoke  # against a running HTTP server
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "../src/server.js";

const client = new Client({ name: "smoke-test", version: "1.0.0" });

if (process.env.MCP_URL) {
  await client.connect(new StreamableHTTPClientTransport(new URL(process.env.MCP_URL)));
} else {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  await client.connect(b);
}

console.log("instructions:", client.getInstructions()?.slice(0, 80), "…");
const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));

const calls: Array<[string, Record<string, unknown>]> = [
  ["search_countries", { query: "korea" }],
  ["list_embassies", { country: "United States" , query: "ヒューストン"}],
  ["get_reference_codes", { table: "areas" }],
  ["get_latest_alerts", { limit: 3 }],
  ["get_latest_alerts", { area: "Asia", category: "embassy_notice", limit: 2, includeBody: true, maxTextLength: 300 }],
  ["list_travel_advisory_levels", { minLevel: 3 }],
  ["list_travel_advisory_levels", { area: "Africa", kind: "both" }],
  ["get_country_safety", { country: "Egypt", noticeLimit: 3, alertLimit: 2, maxTextLength: 400 }],
  ["get_country_safety", { country: "タイ", sections: ["safety_basics"], maxTextLength: 300 }],
  ["search_notices", { country: "Thailand", keywords: ["デモ", "protest"], limit: 3 }],
  ["search_notices", { area: "Europe", infoTypes: ["R20"], since: "2026-01-01", limit: 3 }],
  ["get_notice_detail", { keyCd: "__FROM_LATEST__", maxTextLength: 600 }],
  ["get_country_safety", { country: "Congo" }], // ambiguous -> error
  ["get_notice_detail", { keyCd: "doesnotexist" }], // not found -> error
];

let latestKey: string | undefined;
for (const [name, args] of calls) {
  if (args.keyCd === "__FROM_LATEST__") args.keyCd = latestKey;
  const t0 = Date.now();
  const res: any = await client.callTool({ name, arguments: args });
  const body = res.content?.[0]?.text ?? "";
  if (name === "get_latest_alerts" && !latestKey) latestKey = JSON.parse(body).items?.[0]?.keyCd;
  console.log(`\n=== ${name} ${JSON.stringify(args)} (${Date.now() - t0} ms)${res.isError ? " [isError]" : ""}`);
  console.log(body.length > 1500 ? `${body.slice(0, 1500)}\n… (${body.length} chars)` : body);
}

const prompts = await client.listPrompts();
const resources = await client.listResources();
console.log("\nprompts:", prompts.prompts.map((p) => p.name).join(", "));
console.log("resources:", resources.resources.map((r) => r.uri).join(", "));
await client.close();
