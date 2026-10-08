import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  ALL_AREAS_CODE,
  AREAS,
  COUNTRIES,
  EMBASSIES,
  INFECTION_LEVELS,
  INFO_TYPES,
  RISK_LEVELS,
  getArea,
  getCountry,
  resolveAreaCode,
  resolveCountryCode,
  searchCountries,
} from "./codes.js";
import { getOpenData, NotFoundError, urls } from "./client.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import {
  isoToMillis,
  itemAreaCodes,
  itemCountryCodes,
  normalizeCountry,
  normalizeItem,
  rawItems,
  text,
  jstToIso,
} from "./normalize.js";

export const SERVER_NAME = "mofa-overseas-safety";
export const SERVER_VERSION = "1.0.0";

const INFO_TYPE_CODES = ["T40", "T81", "T41", "C30", "C31", "C50", "C51", "R10", "R20"] as const;
const COUNTRY_SECTIONS = ["advisory", "alerts", "safety_basics", "terrorism", "notices"] as const;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

// ---------- helpers ----------

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function fail(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  const hint =
    err instanceof NotFoundError
      ? " Check the code with search_countries / search_notices, or see https://www.anzen.mofa.go.jp/ ."
      : "";
  return { isError: true, content: [{ type: "text", text: `Error: ${message}${hint}` }] };
}

async function run(fn: () => Promise<unknown> | unknown): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err);
  }
}

/** Parse "2026-01-31", "2026-01-31T10:00", ISO strings. Date-only values are treated as JST midnight. */
function parseDate(input: string | undefined, endOfDay = false): number | undefined {
  if (!input) return undefined;
  const s = input.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const t = Date.parse(dateOnly ? `${s}T${endOfDay ? "23:59:59" : "00:00:00"}+09:00` : s);
  if (Number.isNaN(t)) throw new Error(`Invalid date "${input}". Use YYYY-MM-DD or an ISO 8601 timestamp.`);
  return t;
}

interface ItemFilter {
  areaCode?: string;
  countryCode?: string;
  infoTypes?: string[];
  category?: "travel_advisory" | "embassy_notice";
  embassyCode?: string;
  keywords?: string[];
  since?: number;
  until?: number;
}

function matches(raw: any, f: ItemFilter): boolean {
  const type = text(raw.infoType) ?? "";
  if (f.infoTypes?.length && !f.infoTypes.includes(type)) return false;
  if (f.category) {
    const isEmbassy = type.startsWith("R");
    if ((f.category === "embassy_notice") !== isEmbassy) return false;
  }
  if (f.embassyCode && text(raw.koukanCd)?.toUpperCase() !== f.embassyCode.toUpperCase()) return false;
  if (f.areaCode && f.areaCode !== ALL_AREAS_CODE) {
    const areas = itemAreaCodes(raw);
    // Items with no area are worldwide wide-area alerts; they apply everywhere.
    if (areas.length && !areas.includes(f.areaCode)) return false;
  }
  if (f.countryCode) {
    const countries = itemCountryCodes(raw);
    if (countries.length && !countries.includes(f.countryCode)) return false;
  }
  if (f.since !== undefined || f.until !== undefined) {
    const t = isoToMillis(jstToIso(raw.leaveDate));
    if (f.since !== undefined && t < f.since) return false;
    if (f.until !== undefined && t > f.until) return false;
  }
  if (f.keywords?.length) {
    const hay = `${text(raw.title) ?? ""}\n${text(raw.lead) ?? ""}\n${text(raw.mainText) ?? ""}`.toLowerCase();
    if (!f.keywords.some((k) => hay.includes(k.toLowerCase()))) return false;
  }
  return true;
}

function dedupe(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter((m) => {
    const k = text(m.keyCd) ?? "";
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function sortNewestFirst(items: any[]): any[] {
  return items.sort((a, b) => isoToMillis(jstToIso(b.leaveDate)) - isoToMillis(jstToIso(a.leaveDate)));
}

function resolveArea(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const code = resolveAreaCode(input);
  if (!code) {
    throw new Error(
      `Unknown area "${input}". Valid areas: ${AREAS.map((a) => `${a.code} ${a.nameEn}`).join(", ")}.`,
    );
  }
  return code;
}

function countrySummary(code: string) {
  const c = getCountry(code);
  return c ? { code: c.code, name: c.nameEn, nameJa: c.nameJa, areaCode: c.areaCode } : { code };
}

// ---------- shared zod fragments ----------

const zCountry = z
  .string()
  .min(1)
  .describe('Country/territory: 4-digit MOFA code (e.g. "0066") or name in English/Japanese (e.g. "Thailand", "タイ").');
const zArea = z
  .string()
  .describe(
    'Area: code or name. 10 Asia, 20 Oceania, 30 North America, 33 Central & South America, 42 Europe (incl. Russia/Central Asia), 50 Middle East, 60 Africa. "00" or "all" = worldwide.',
  );
const zInfoTypes = z
  .array(z.enum(INFO_TYPE_CODES))
  .describe(
    "Filter by info type: T40 risk info, T81 infectious-disease risk info, C30/C31 spot info, C50/C51 wide-area info, R10/R20 embassy notices (general/emergency).",
  );
const zCategory = z
  .enum(["travel_advisory", "embassy_notice"])
  .describe("travel_advisory = MOFA Overseas Safety HP items (T*/C*); embassy_notice = embassy/consulate emails (R10/R20).");

// ---------- server ----------

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: "Japan MOFA Overseas Safety Information" },
    { instructions: SERVER_INSTRUCTIONS, capabilities: { logging: {} } },
  );

  // ----- get_country_safety -----
  server.registerTool(
    "get_country_safety",
    {
      title: "Country safety overview",
      description:
        "Complete MOFA safety profile for one country: current Risk Information level (1–4) and affected regions, infectious-disease advisory, recent Spot/Wide-area alerts, and optionally the Basic Safety Data (crime, entry/visa, precautions, customs/health, emergency contacts), terrorism/kidnapping background, and a list of recent embassy notices. Content is Japanese — translate for the user.",
      inputSchema: {
        country: zCountry,
        sections: z
          .array(z.enum(COUNTRY_SECTIONS))
          .optional()
          .describe(
            'Sections to include. advisory = risk & infectious-disease levels; alerts = spot & wide-area alerts; safety_basics = 安全対策基礎データ (long); terrorism = テロ・誘拐情勢 (long); notices = recent items list. Default: ["advisory","alerts","notices"].',
          ),
        alertLimit: z.number().int().min(0).max(50).optional().describe("Max spot/wide-area alerts to return (newest first). Default 8."),
        noticeLimit: z.number().int().min(0).max(100).optional().describe("Max recent notices to list. Default 10."),
        maxTextLength: z
          .number()
          .int()
          .min(200)
          .max(50000)
          .optional()
          .describe("Truncate each long text field to this many characters. Default 4000."),
      },
      annotations: { title: "Country safety overview", ...READ_ONLY },
    },
    async ({ country, sections, alertLimit, noticeLimit, maxTextLength }) =>
      run(async () => {
        const code = resolveCountryCode(country);
        const root = await getOpenData(urls.country(code, "full"));
        const result: any = normalizeCountry(root, {
          sections: new Set(sections?.length ? sections : ["advisory", "alerts", "notices"]),
          noticeLimit: noticeLimit ?? 10,
          maxTextLength: maxTextLength ?? 4000,
        });
        if (Array.isArray(result.spotAndWideAreaAlerts)) {
          const all = result.spotAndWideAreaAlerts;
          const limit = alertLimit ?? 8;
          result.spotAndWideAreaAlerts = { total: all.length, showing: Math.min(limit, all.length), items: all.slice(0, limit) };
        }
        result.country ??= countrySummary(code);
        return result;
      }),
  );

  // ----- get_latest_alerts -----
  server.registerTool(
    "get_latest_alerts",
    {
      title: "Latest alerts (last 48 hours)",
      description:
        "Everything MOFA and Japanese embassies/consulates published in roughly the last 48 hours worldwide (新着情報): new/updated advisories, spot and wide-area alerts, and embassy notices. Optionally filter by area, country, type or category.",
      inputSchema: {
        area: zArea.optional(),
        country: zCountry.optional(),
        infoTypes: zInfoTypes.optional(),
        category: zCategory.optional(),
        includeBody: z.boolean().optional().describe("Include the (Japanese) body text of each item. Default false."),
        maxTextLength: z.number().int().min(200).max(20000).optional().describe("Truncate body text when includeBody is true. Default 1500."),
        limit: z.number().int().min(1).max(100).optional().describe("Max items. Default 30."),
      },
      annotations: { title: "Latest alerts (last 48 hours)", ...READ_ONLY },
    },
    async ({ area, country, infoTypes, category, includeBody, maxTextLength, limit }) =>
      run(async () => {
        const filter: ItemFilter = {
          areaCode: resolveArea(area),
          countryCode: country ? resolveCountryCode(country) : undefined,
          infoTypes,
          category,
        };
        const root = await getOpenData(urls.newArrivals("full"));
        const all = sortNewestFirst(dedupe(rawItems(root)));
        const hits = all.filter((m) => matches(m, filter));
        const max = limit ?? 30;
        return {
          dataLastModified: jstToIso(root["@_lastModified"]),
          window: "approximately the last 48 hours",
          totalPublished: all.length,
          totalMatches: hits.length,
          returned: Math.min(max, hits.length),
          items: hits
            .slice(0, max)
            .map((m) => normalizeItem(m, { omitBody: !includeBody, maxTextLength: maxTextLength ?? 1500 })),
        };
      }),
  );

  // ----- search_notices -----
  server.registerTool(
    "search_notices",
    {
      title: "Search notices and advisories (past year)",
      description:
        "Search MOFA advisories/alerts and embassy notices issued within about the last year (plus all currently valid advisories). Filter by country, area, type, category, embassy, date range and keywords. Returns titles and lead paragraphs, newest first; use get_notice_detail for full text. Keywords match Japanese text, so include Japanese terms (e.g. デモ, 地震, テロ, 強盗).",
      inputSchema: {
        country: zCountry.optional().describe("Restrict to one country (uses the country feed, which also includes wide-area items covering it)."),
        area: zArea.optional(),
        infoTypes: zInfoTypes.optional(),
        category: zCategory.optional(),
        embassyCode: z.string().optional().describe('Embassy/consulate code (公館コード), e.g. "301T". Find codes with list_embassies.'),
        keywords: z
          .array(z.string().min(1))
          .optional()
          .describe("Match items whose title or lead contains ANY of these strings (case-insensitive). Prefer Japanese terms."),
        since: z.string().optional().describe("Earliest issue date, YYYY-MM-DD (JST) or ISO 8601."),
        until: z.string().optional().describe("Latest issue date, YYYY-MM-DD (JST, inclusive) or ISO 8601."),
        limit: z.number().int().min(1).max(100).optional().describe("Max items to return. Default 20."),
        offset: z.number().int().min(0).optional().describe("Pagination offset. Default 0."),
      },
      annotations: { title: "Search notices and advisories", ...READ_ONLY },
    },
    async ({ country, area, infoTypes, category, embassyCode, keywords, since, until, limit, offset }) =>
      run(async () => {
        const countryCode = country ? resolveCountryCode(country) : undefined;
        const filter: ItemFilter = {
          areaCode: resolveArea(area),
          countryCode,
          infoTypes,
          category,
          embassyCode,
          keywords,
          since: parseDate(since),
          until: parseDate(until, true),
        };
        // The light all-areas feed (~7 MB) is the smallest complete list; per-area files repeat items.
        // A country feed is authoritative for that country.
        const url = countryCode ? urls.country(countryCode, "light") : urls.area(ALL_AREAS_CODE, "light");
        const root = await getOpenData(url);
        const hits = sortNewestFirst(dedupe(rawItems(root))).filter((m) => matches(m, filter));
        const start = offset ?? 0;
        const max = limit ?? 20;
        return {
          source: url,
          dataLastModified: jstToIso(root["@_lastModified"]),
          country: countryCode ? countrySummary(countryCode) : undefined,
          totalMatches: hits.length,
          offset: start,
          returned: Math.max(0, Math.min(max, hits.length - start)),
          hasMore: start + max < hits.length,
          items: hits.slice(start, start + max).map((m) => normalizeItem(m, { omitBody: true })),
        };
      }),
  );

  // ----- get_notice_detail -----
  server.registerTool(
    "get_notice_detail",
    {
      title: "Get full notice/advisory",
      description:
        "Fetch the full text of a single advisory, alert or embassy notice by its keyCd (from any list result). Includes summary, full body (Japanese), affected countries, embassy, advisory levels, maps and official link.",
      inputSchema: {
        keyCd: z
          .string()
          .regex(/^[0-9A-Za-z]+$/, "keyCd is alphanumeric, e.g. 168190 or 2026T082")
          .describe('Key code of the item, e.g. "168190" (embassy notice) or "2026T082" (advisory).'),
        maxTextLength: z.number().int().min(500).max(100000).optional().describe("Truncate long text fields. Default 30000."),
      },
      annotations: { title: "Get full notice/advisory", ...READ_ONLY },
    },
    async ({ keyCd, maxTextLength }) =>
      run(async () => {
        const root = await getOpenData(urls.item(keyCd, "full"));
        const item = rawItems(root)[0];
        if (!item) throw new NotFoundError(`No item found for keyCd ${keyCd}`);
        return normalizeItem(item, { maxTextLength: maxTextLength ?? 30000 });
      }),
  );

  // ----- list_travel_advisory_levels -----
  server.registerTool(
    "list_travel_advisory_levels",
    {
      title: "Travel advisory levels by country",
      description:
        "List countries that currently have a MOFA Risk Information (危険情報) and/or Infectious Disease Risk Information advisory, with the highest level in effect in any part of each country. Use to answer questions like 'which countries are Level 3 or higher' or to compare a region. Countries not listed have no level-based advisory.",
      inputSchema: {
        area: zArea.optional(),
        minLevel: z.number().int().min(1).max(4).optional().describe("Only include countries whose highest level is at least this. Default 1."),
        kind: z
          .enum(["risk", "infection", "both"])
          .optional()
          .describe("risk = security Risk Information (T40); infection = infectious disease (T81); both. Default risk."),
      },
      annotations: { title: "Travel advisory levels by country", ...READ_ONLY },
    },
    async ({ area, minLevel, kind }) =>
      run(async () => {
        const areaCode = resolveArea(area);
        const mode = kind ?? "risk";
        const types = mode === "risk" ? ["T40"] : mode === "infection" ? ["T81", "T41"] : ["T40", "T81", "T41"];
        const root = await getOpenData(urls.area(ALL_AREAS_CODE, "light"));
        const items = sortNewestFirst(dedupe(rawItems(root))).filter((m) => types.includes(text(m.infoType) ?? ""));

        // Keep the newest advisory of each kind per country.
        const byCountry = new Map<string, any>();
        for (const m of items) {
          const n: any = normalizeItem(m, { omitBody: true });
          const isRisk = n.infoType === "T40";
          const key = isRisk ? "risk" : "infection";
          const lv = isRisk ? n.riskLevels : n.infectionLevels;
          for (const cc of itemCountryCodes(m)) {
            const c = getCountry(cc);
            if (areaCode && areaCode !== ALL_AREAS_CODE && c?.areaCode !== areaCode) continue;
            const entry = byCountry.get(cc) ?? { code: cc, country: c?.nameEn ?? cc, areaCode: c?.areaCode, highestLevel: 0 };
            if (entry[key]) continue;
            entry[key] = {
              highestLevel: lv?.highestLevel ?? 0,
              levelsPresent: lv?.levelsPresent ?? [],
              keyCd: n.keyCd,
              issuedAt: n.issuedAt?.slice(0, 10),
              title: n.title,
              url: n.links?.web,
            };
            entry.highestLevel = Math.max(entry.highestLevel, entry[key].highestLevel);
            byCountry.set(cc, entry);
          }
        }
        const all = [...byCountry.values()];
        const counts: Record<string, number> = { level4: 0, level3: 0, level2: 0, level1: 0, none: 0 };
        for (const r of all) counts[r.highestLevel ? `level${r.highestLevel}` : "none"]++;
        const min = minLevel ?? 1;
        const rows = all
          .filter((e) => e.highestLevel >= min)
          .sort((a, b) => b.highestLevel - a.highestLevel || String(a.country).localeCompare(String(b.country)));
        return {
          dataLastModified: jstToIso(root["@_lastModified"]),
          area: areaCode && areaCode !== ALL_AREAS_CODE ? getArea(areaCode) : "worldwide",
          kind: mode,
          levelLegend: Object.fromEntries(RISK_LEVELS.map((l) => [l.level, l.nameEn])),
          note: "highestLevel is the most severe level for ANY region of the country; most countries have different levels by region. levelsPresent lists every level in effect somewhere in the country. Use get_notice_detail(keyCd) to see which regions are affected.",
          countsByHighestLevel: counts,
          returned: rows.length,
          countries: rows,
        };
      }),
  );

  // ----- search_countries -----
  server.registerTool(
    "search_countries",
    {
      title: "Find country codes",
      description:
        "Look up MOFA 4-digit country/territory codes by English or Japanese name (partial matches allowed), or list all countries in an area. Codes are needed by other tools only if a name is ambiguous.",
      inputSchema: {
        query: z.string().optional().describe('Name or code, e.g. "korea", "UAE", "ブラジル", "0055". Omit to list all.'),
        area: zArea.optional(),
      },
      annotations: { title: "Find country codes", ...READ_ONLY, openWorldHint: false },
    },
    async ({ query, area }) =>
      run(() => {
        const areaCode = resolveArea(area);
        let list = query ? searchCountries(query) : COUNTRIES;
        if (areaCode && areaCode !== ALL_AREAS_CODE) list = list.filter((c) => c.areaCode === areaCode);
        return {
          count: list.length,
          countries: list.map((c) => ({
            code: c.code,
            name: c.nameEn,
            nameJa: c.nameJa,
            areaCode: c.areaCode,
            area: getArea(c.areaCode)?.nameEn,
          })),
        };
      }),
  );

  // ----- list_embassies -----
  server.registerTool(
    "list_embassies",
    {
      title: "Japanese embassies and consulates",
      description:
        "List Japanese embassies, consulates-general and consular offices (在外公館) with their codes, optionally for one country or matching a Japanese/English name fragment. Use embassy codes with search_notices.embassyCode. Names are Japanese (e.g. 在ヒューストン日本国総領事館 = Consulate-General of Japan in Houston).",
      inputSchema: {
        country: zCountry.optional(),
        query: z.string().optional().describe('Substring of the Japanese name or the code, e.g. "ヒューストン", "301T".'),
      },
      annotations: { title: "Japanese embassies and consulates", ...READ_ONLY, openWorldHint: false },
    },
    async ({ country, query }) =>
      run(() => {
        const countryCode = country ? resolveCountryCode(country) : undefined;
        let list = EMBASSIES;
        if (countryCode) list = list.filter((e) => e.countryCode === countryCode);
        if (query) {
          const q = query.trim().toLowerCase();
          list = list.filter((e) => e.nameJa.includes(query.trim()) || e.code.toLowerCase() === q);
        }
        return {
          count: list.length,
          embassies: list.map((e) => ({
            code: e.code,
            nameJa: e.nameJa,
            kind: e.kind,
            countryCode: e.countryCode,
            country: getCountry(e.countryCode)?.nameEn,
          })),
        };
      }),
  );

  // ----- get_reference_codes -----
  server.registerTool(
    "get_reference_codes",
    {
      title: "Reference code tables",
      description:
        "Return MOFA reference tables: areas, info types, risk-level definitions, infectious-disease level definitions, or the open-data URL patterns.",
      inputSchema: {
        table: z.enum(["areas", "info_types", "risk_levels", "infection_levels", "endpoints"]),
      },
      annotations: { title: "Reference code tables", ...READ_ONLY, openWorldHint: false },
    },
    async ({ table }) =>
      run(() => {
        switch (table) {
          case "areas":
            return { allAreasCode: ALL_AREAS_CODE, areas: AREAS };
          case "info_types":
            return { infoTypes: INFO_TYPES };
          case "risk_levels":
            return { riskLevels: RISK_LEVELS };
          case "infection_levels":
            return { infectionLevels: INFECTION_LEVELS };
          case "endpoints":
            return {
              note: "Suffix A = full (全量), none = normal (通常), L = light (軽量). Updated ~every 5 minutes.",
              newArrivals: urls.newArrivals("normal"),
              allAreas: urls.area(ALL_AREAS_CODE, "normal"),
              byArea: urls.area("{areaCode}", "normal"),
              byCountry: urls.country("{countryCode}", "normal"),
              item: urls.item("KEY", "normal").replace("KEY", "{keyCd}"),
            };
        }
      }),
  );

  // ----- resources -----
  const jsonResource = (name: string, uri: string, description: string, data: () => unknown) =>
    server.registerResource(name, uri, { description, mimeType: "application/json" }, async (u) => ({
      contents: [{ uri: u.href, mimeType: "application/json", text: JSON.stringify(data(), null, 1) }],
    }));

  jsonResource("areas", "mofa://codes/areas", "MOFA area codes", () => AREAS);
  jsonResource("countries", "mofa://codes/countries", "MOFA country/territory codes with English and Japanese names", () => COUNTRIES);
  jsonResource("info-types", "mofa://codes/info-types", "Information type codes (T40, C30, R10, …)", () => INFO_TYPES);
  jsonResource("risk-levels", "mofa://codes/risk-levels", "Risk and infectious-disease level definitions", () => ({
    riskLevels: RISK_LEVELS,
    infectionLevels: INFECTION_LEVELS,
  }));
  jsonResource("embassies", "mofa://codes/embassies", "Japanese embassy/consulate codes (公館コード)", () => EMBASSIES);

  // ----- prompts -----
  server.registerPrompt(
    "travel_safety_briefing",
    {
      title: "Travel safety briefing",
      description: "Prepare a safety briefing for a trip using MOFA data.",
      argsSchema: {
        destination: z.string().describe("Country (and optionally city/region) being visited"),
        dates: z.string().optional().describe("Travel dates"),
        purpose: z.string().optional().describe("Purpose of travel, e.g. tourism, business"),
      },
    },
    ({ destination, dates, purpose }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Prepare a travel safety briefing for ${destination}${dates ? ` (${dates})` : ""}${purpose ? ` — purpose: ${purpose}` : ""}.`,
              "Use get_country_safety with sections advisory, alerts, safety_basics and notices.",
              "Cover: 1) current MOFA advisory level(s) and exactly which regions they apply to, and whether my destination falls in one;",
              "2) recent spot/wide-area alerts and embassy notices relevant to my plans; 3) main crime risks and how to avoid them;",
              "4) entry/visa and local-law points worth knowing; 5) health notes; 6) emergency contacts.",
              "Translate everything into English, cite dates and include the official MOFA links.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "recent_alerts_digest",
    {
      title: "Recent alerts digest",
      description: "Summarize the last 48 hours of MOFA alerts and embassy notices.",
      argsSchema: {
        area: z.string().optional().describe("Optional area (Asia, Europe, Middle East, …) or country to focus on"),
      },
    },
    ({ area }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Give me a digest of MOFA safety alerts and Japanese embassy notices from the last 48 hours${area ? ` for ${area}` : " worldwide"}.`,
              "Use get_latest_alerts (with includeBody where needed). Group by country, put emergency (R20) items and new/raised advisory levels first,",
              "translate into English, and give one line per item with date and link.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}
