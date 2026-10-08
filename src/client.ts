/**
 * Fetches and parses MOFA Overseas Safety open data XML files.
 *
 * Endpoints (spec §2.4):
 *   New arrivals (48h):  /opendata/area/newarrival{A|""|L}.xml
 *   All areas (1 year):  /opendata/area/00{A|""|L}.xml
 *   By area:             /opendata/area/{areaCode}{A|""|L}.xml
 *   By country:          /opendata/country/{countryCode}{A|""|L}.xml
 *   Single item detail:  /opendata/mail/{keyCd}{A|""|L}.xml
 *
 * Data is refreshed upstream roughly every 5 minutes, so parsed responses are kept
 * in an in-memory LRU cache for CACHE_TTL_SECONDS (default 300). Parsed country files
 * take ~10 MB of heap each, so CACHE_MAX_ENTRIES (default 20) bounds memory use.
 */
import { XMLParser } from "fast-xml-parser";

export const BASE_URL = (process.env.MOFA_BASE_URL ?? "https://www.ezairyu.mofa.go.jp/opendata").replace(/\/$/, "");

/** Volume variant: full (全量, "A"), normal (通常, ""), light (軽量, "L"). */
export type Detail = "full" | "normal" | "light";

const SUFFIX: Record<Detail, string> = { full: "A", normal: "", light: "L" };

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_SECONDS ?? 300) * 1000;
const CACHE_MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES ?? 20);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 30000);
const USER_AGENT = process.env.MOFA_USER_AGENT ?? "mcp-mofa-overseas-safety/1.0 (+https://modelcontextprotocol.io)";

export class NotFoundError extends Error {}

export const urls = {
  newArrivals: (d: Detail) => `${BASE_URL}/area/newarrival${SUFFIX[d]}.xml`,
  area: (areaCode: string, d: Detail) => `${BASE_URL}/area/${areaCode}${SUFFIX[d]}.xml`,
  country: (countryCode: string, d: Detail) => `${BASE_URL}/country/${countryCode}${SUFFIX[d]}.xml`,
  item: (keyCd: string, d: Detail) => `${BASE_URL}/mail/${encodeURIComponent(keyCd)}${SUFFIX[d]}.xml`,
};

// Elements that may repeat and must always be parsed as arrays.
const ARRAY_PATHS = new Set([
  "opendata.mail",
  "opendata.mail.area",
  "opendata.mail.country",
  "opendata.mail.mapImageUrl",
  "opendata.mail.attachedImageUrl",
  "opendata.wideareaSpot",
  "opendata.infection",
  "opendata.riskMapUrl",
  "opendata.infectionMapUrl",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false, // keep codes like "0060" as strings
  parseAttributeValue: false,
  trimValues: true,
  isArray: (_name, jpath) => ARRAY_PATHS.has(String(jpath)),
});

interface CacheEntry {
  expires: number;
  value: Promise<any>;
}

const cache = new Map<string, CacheEntry>();

function setCache(url: string, value: Promise<any>) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(url, { expires: Date.now() + CACHE_TTL_MS, value });
}

async function fetchAndParse(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status === 404) throw new NotFoundError(`Not found: ${url}`);
  if (!res.ok) throw new Error(`MOFA open data request failed (${res.status} ${res.statusText}): ${url}`);
  const text = await res.text();
  // Unknown codes return an HTML "sorry/maintenance" page with HTTP 200 instead of a 404.
  if (!text.trimStart().startsWith("<?xml") || !text.includes("<opendata")) {
    throw new NotFoundError(
      `No open data found at ${url}. The code may be invalid, the item may have expired, or the site may be under maintenance.`,
    );
  }
  const parsed = parser.parse(text);
  if (!parsed?.opendata) throw new Error(`Unexpected XML structure at ${url}`);
  return parsed.opendata;
}

/** Fetch an XML document and return its parsed <opendata> root, using the in-memory cache. */
export async function getOpenData(url: string): Promise<any> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    // Move to the end of the Map so eviction is least-recently-used.
    cache.delete(url);
    cache.set(url, hit);
    return hit.value;
  }
  cache.delete(url);
  const value = fetchAndParse(url);
  setCache(url, value);
  // Don't keep failures in the cache.
  value.catch(() => cache.delete(url));
  return value;
}

export function cacheStats() {
  return { entries: cache.size, maxEntries: CACHE_MAX_ENTRIES, ttlSeconds: CACHE_TTL_MS / 1000 };
}
