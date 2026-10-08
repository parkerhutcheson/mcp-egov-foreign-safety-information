#!/usr/bin/env node
/**
 * Entry point.
 *   HTTP (default, for Render / remote connectors):  node dist/index.js
 *   stdio (for Claude Desktop / Claude Code local):   node dist/index.js --stdio
 */
import { timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
import { BASE_URL, cacheStats } from "./client.js";

const useStdio = process.argv.includes("--stdio") || process.env.MCP_TRANSPORT === "stdio";

if (useStdio) {
  await startStdio();
} else {
  startHttp();
}

async function startStdio() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  // stdout is the protocol channel; log to stderr only.
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

function startHttp() {
  const port = Number(process.env.PORT ?? 3000);
  const authToken = process.env.MCP_AUTH_TOKEN?.trim() || undefined;
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "1mb" }));

  // Permissive CORS so browser-based MCP clients (e.g. MCP Inspector) can connect. The data is public.
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, Mcp-Protocol-Version");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  /**
   * Optional shared-secret auth. When MCP_AUTH_TOKEN is set, requests must send
   * `Authorization: Bearer <token>` or `?token=<token>` (the query form is for clients,
   * such as claude.ai custom connectors, that cannot set custom headers).
   */
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!authToken) return next();
    const header = req.get("authorization");
    const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : undefined;
    const query = typeof req.query.token === "string" ? req.query.token : undefined;
    const supplied = bearer ?? query ?? "";
    const a = Buffer.from(supplied);
    const b = Buffer.from(authToken);
    if (a.length === b.length && timingSafeEqual(a, b)) return next();
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
  };

  // Stateless Streamable HTTP: a fresh server + transport per request. Scales horizontally with no sticky sessions.
  const handleMcp = async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  };

  const methodNotAllowed = (_req: Request, res: Response) => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. This server is stateless; use POST." }, id: null });
  };

  app.post("/mcp", requireAuth, handleMcp);
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name: SERVER_NAME, version: SERVER_VERSION, uptimeSeconds: Math.round(process.uptime()), cache: cacheStats(), memoryMb: Math.round(process.memoryUsage().rss / 1e6) });
  });

  app.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}`;
    res.json({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      description: "MCP server for Japan MOFA Overseas Safety Information open data (海外安全情報オープンデータ).",
      mcpEndpoint: `${base}/mcp`,
      transport: "streamable-http (stateless)",
      authRequired: Boolean(authToken),
      upstream: BASE_URL,
      docs: "https://github.com/parkerhutcheson/mcp-egov-foreign-safety-information",
    });
  });

  const httpServer = app.listen(port, "0.0.0.0", () => {
    console.log(`${SERVER_NAME} v${SERVER_VERSION} listening on :${port} (MCP endpoint: /mcp${authToken ? ", auth enabled" : ""})`);
  });

  const shutdown = () => {
    console.log("Shutting down…");
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
