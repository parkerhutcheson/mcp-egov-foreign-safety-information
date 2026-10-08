/**
 * Converts parsed MOFA XML into compact, English-keyed JSON for LLM consumption.
 * Field meanings follow the official "オープンデータファイルフォーマット" definition.
 */
import { getArea, getCountry, getEmbassy, getInfoType, RISK_LEVELS, INFECTION_LEVELS } from "./codes.js";

type Raw = Record<string, any>;

const CONTENT_TAGS: Record<string, string> = {
  治安情勢: "security situation",
  治安: "security situation",
  一般犯罪: "general crime",
  誘拐: "kidnapping",
  テロ: "terrorism",
  暴動: "riots/unrest",
  戦争: "war/armed conflict",
  事故: "accidents",
  災害: "disasters",
  自然災害: "natural disasters",
  病気: "disease",
  "医療・衛生情報": "medical/sanitation",
  "医療･衛生": "medical/sanitation",
  一般情報: "general information",
  一般: "general information",
};

/** Text content of an element that may carry attributes. */
export function text(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v === "" ? undefined : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && "#text" in (v as Raw)) return text((v as Raw)["#text"]);
  return undefined;
}

function attr(v: unknown, name: string): string | undefined {
  if (v && typeof v === "object") {
    const a = (v as Raw)[`@_${name}`];
    return a === "" || a === undefined ? undefined : String(a);
  }
  return undefined;
}

function arr<T = Raw>(v: unknown): T[] {
  if (v === undefined || v === null || v === "") return [];
  return Array.isArray(v) ? v : [v as T];
}

/** "2026/10/08 05:31:07" (JST) -> "2026-10-08T05:31:07+09:00" */
export function jstToIso(v: unknown): string | undefined {
  const s = text(v);
  if (!s) return undefined;
  const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00` : s;
}

export function isoToMillis(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function flag(v: unknown): boolean {
  const s = text(v);
  return s === "1" || s === "Y" || s === "y";
}

export function truncate(s: string | undefined, max: number | undefined): string | undefined {
  if (!s || !max || s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated ${s.length - max} more chars; raise maxTextLength or open the official link for the full text]`;
}

export interface LevelSummary {
  highestLevel: number;
  levelsPresent: number[];
  label?: string;
}

function levels(raw: Raw, prefix: "riskLevel" | "infectionLevel"): LevelSummary | undefined {
  if (!(`${prefix}1` in raw) && !(`${prefix}4` in raw)) return undefined;
  const present = [1, 2, 3, 4].filter((n) => flag(raw[`${prefix}${n}`]));
  const highest = present.length ? Math.max(...present) : 0;
  const table = prefix === "riskLevel" ? RISK_LEVELS : INFECTION_LEVELS;
  return {
    highestLevel: highest,
    levelsPresent: present,
    label: highest ? table[highest - 1].nameEn : "No level-based advisory in effect",
  };
}

function areaRef(raw: Raw) {
  const code = text(raw.cd);
  const known = getArea(code);
  return { code, name: known?.nameEn ?? text(raw.name), nameJa: text(raw.name) ?? known?.nameJa };
}

function countryRef(raw: Raw) {
  const code = text(raw.cd);
  const known = getCountry(code);
  return {
    code,
    areaCode: attr(raw, "areaCd"),
    name: known?.nameEn ?? text(raw.name),
    nameJa: text(raw.name) ?? known?.nameJa,
  };
}

export interface NormalizeOptions {
  /** Truncate body/summary text to this many characters (undefined = no truncation). */
  maxTextLength?: number;
  /** Omit body text and verbose fields (list views). */
  omitBody?: boolean;
}

/** Normalize a <mail> element: an embassy notice or an Overseas Safety HP item. */
export function normalizeItem(raw: Raw, opts: NormalizeOptions = {}) {
  const infoType = text(raw.infoType);
  const it = getInfoType(infoType);
  const embassyCode = text(raw.koukanCd);
  const embassy = getEmbassy(embassyCode);
  const tags = text(raw.contentInfo)
    ?.split(/[\s　]+/)
    .filter(Boolean)
    .map((t) => CONTENT_TAGS[t] ?? t);
  const countries = arr<Raw>(raw.country).map(countryRef);
  const areas = arr<Raw>(raw.area).map(areaRef);
  // The all-areas feed omits area/country on some embassy notices; infer them from the embassy code.
  if (!countries.length && embassy) {
    const known = getCountry(embassy.countryCode);
    countries.push({ code: embassy.countryCode, areaCode: embassy.areaCode, name: known?.nameEn, nameJa: known?.nameJa });
    if (!areas.length) areas.push({ code: embassy.areaCode, name: getArea(embassy.areaCode)?.nameEn, nameJa: getArea(embassy.areaCode)?.nameJa });
  }
  const compact = !!opts.omitBody;
  const out: Raw = {
    keyCd: text(raw.keyCd),
    infoType,
    infoTypeName: it?.nameEn ?? text(raw.infoName),
    infoTypeNameJa: compact ? undefined : (it?.nameJa ?? text(raw.infoName)),
    issuedAt: jstToIso(raw.leaveDate),
    title: text(raw.title),
    lead: text(raw.lead),
    areas: compact ? areas.map((a) => a.name ?? a.code) : areas,
    // Wide-area items can list 200+ countries; collapse those to a count.
    countries:
      countries.length > 25
        ? undefined
        : compact
          ? countries.map((c) => ({ code: c.code, name: c.name }))
          : countries,
    countryCount: countries.length > 25 ? countries.length : undefined,
    topics: tags?.length ? tags : undefined,
    embassy: embassyCode
      ? { code: embassyCode, nameJa: text(raw.koukanName) ?? embassy?.nameJa, kind: compact ? undefined : embassy?.kind }
      : undefined,
    riskLevels: levels(raw, "riskLevel"),
    infectionLevels: levels(raw, "infectionLevel"),
  };
  if (!opts.omitBody) {
    out.summary = truncate(text(raw.subText), opts.maxTextLength);
    out.body = truncate(text(raw.mainText), opts.maxTextLength);
  }
  const maps = arr(raw.mapImageUrl).map(text).filter(Boolean);
  const attachments = arr(raw.attachedImageUrl).map(text).filter(Boolean);
  out.links = {
    web: text(raw.infoUrl),
    maps: maps.length ? maps : undefined,
    attachments: attachments.length ? attachments : undefined,
  };
  return prune(out);
}

/** Normalize a country document (odType 04). */
export function normalizeCountry(root: Raw, opts: NormalizeOptions & { sections: Set<string>; noticeLimit: number }) {
  const area = root.area ? areaRef(root.area) : undefined;
  const country = root.country ? countryRef(root.country) : undefined;
  const max = opts.maxTextLength;
  const want = (s: string) => opts.sections.has(s);

  const out: Raw = {
    country,
    area,
    lastModified: jstToIso(root["@_lastModified"]),
    dataType: root["@_dataType"],
  };

  if (want("advisory")) {
    const riskLevels = levels(root, "riskLevel");
    const infectionLevels = levels(root, "infectionLevel");
    out.travelAdvisory = prune({
      riskLevels,
      keyCd: attr(root.riskLeaveDate, "keyCd"),
      issuedAt: jstToIso(root.riskLeaveDate),
      title: text(root.riskTitle),
      lead: text(root.riskLead),
      summary: truncate(text(root.riskSubText), max),
      url: text(root.riskUrl),
      mapUrls: arr(root.riskMapUrl).map(text).filter(Boolean),
    });
    out.infectiousDiseaseAdvisory = prune({
      infectionLevels,
      items: arr<Raw>(root.infection).map((i) =>
        prune({
          keyCd: attr(i.leaveDate, "keyCd"),
          issuedAt: jstToIso(i.leaveDate),
          title: text(i.title),
          lead: text(i.lead),
          summary: truncate(text(i.subText), max),
          url: text(i.url),
        }),
      ),
      mapUrls: arr(root.infectionMapUrl).map(text).filter(Boolean),
    });
  }

  if (want("alerts")) {
    out.spotAndWideAreaAlerts = arr<Raw>(root.wideareaSpot).map((w) =>
      prune({
        keyCd: attr(w.leaveDate, "keyCd"),
        type: text(w.typeCd),
        typeName: getInfoType(text(w.typeCd))?.nameEn,
        issuedAt: jstToIso(w.leaveDate),
        title: text(w.title),
        lead: text(w.lead),
        body: truncate(text(w.mainText), max),
        url: text(w.url),
      }),
    );
  }

  if (want("safety_basics")) {
    out.safetyBasics = prune({
      description:
        "安全対策基礎データ — Basic safety data: crime, entry/exit, precautions, customs/health, emergency contacts.",
      lastModified: jstToIso(root.safetyMeasureLastModified),
      lead: text(root.safetyMeasureLead),
      summary: truncate(text(root.safetyMeasureSubText), max),
      crimeAndPrevention: truncate(text(root.safetyMeasureMainText1), max),
      visaAndImmigration: truncate(text(root.safetyMeasureMainText2), max),
      precautionsDuringStay: truncate(text(root.safetyMeasureMainText3), max),
      customsHabitsAndHealth: truncate(text(root.safetyMeasureMainText4), max),
      emergencyContacts: truncate(text(root.safetyMeasureMainText5), max),
      inquiries: truncate(text(root.safetyMeasureMainText6), max),
      url: text(root.safetyMeasureUrl),
    });
  }

  if (want("terrorism")) {
    out.terrorismAndKidnapping = prune({
      lastModified: jstToIso(root.terroKidnapLastModified),
      lead: text(root.terroKidnapLead),
      summary: truncate(text(root.terroKidnapSubText), max),
      body: truncate(text(root.terroKidnapMainText), max),
      url: text(root.terroKidnapUrl),
    });
  }

  if (want("notices")) {
    const mails = arr<Raw>(root.mail);
    out.recentNotices = {
      totalInLastYear: mails.length,
      showing: Math.min(mails.length, opts.noticeLimit),
      items: mails.slice(0, opts.noticeLimit).map((m) => normalizeItem(m, { omitBody: true })),
    };
  }

  out.links = prune({
    web: text(root.infoUrl),
    allAlertsPage: text(root.infectionspothazardUrl),
    safetyGuidePdf: text(root.safetyGuideUrl),
    medicalSituation: text(root.medicalSituationUrl),
    blankMap: text(root.blankMapUrl),
  });

  return prune(out);
}

/** Recursively drop undefined values, empty strings, empty arrays and empty objects. */
export function prune<T>(v: T): T {
  if (Array.isArray(v)) return v.map(prune).filter((x) => !isEmpty(x)) as unknown as T;
  if (v && typeof v === "object") {
    const o: Raw = {};
    for (const [k, val] of Object.entries(v as Raw)) {
      const p = prune(val);
      if (!isEmpty(p)) o[k] = p;
    }
    return o as T;
  }
  return v;
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** Area codes an item applies to (with embassy-based fallback). Empty = worldwide/unspecified. */
export function itemAreaCodes(raw: Raw): string[] {
  const codes = arr<Raw>(raw.area).map((a) => text(a.cd)).filter((x): x is string => !!x);
  if (codes.length) return codes;
  const e = getEmbassy(text(raw.koukanCd));
  return e ? [e.areaCode] : [];
}

/** Country codes an item applies to (with embassy-based fallback). */
export function itemCountryCodes(raw: Raw): string[] {
  const codes = arr<Raw>(raw.country).map((c) => text(c.cd)).filter((x): x is string => !!x);
  if (codes.length) return codes;
  const e = getEmbassy(text(raw.koukanCd));
  return e ? [e.countryCode] : [];
}

export function rawItems(root: Raw): Raw[] {
  return arr<Raw>(root.mail);
}
