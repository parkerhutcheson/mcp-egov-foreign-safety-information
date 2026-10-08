/**
 * Code lists for the MOFA Overseas Safety open data.
 *
 * Source: the official code lists published at
 * https://www.ezairyu.mofa.go.jp/html/opendata/ (area.xlsx, country.xlsx,
 * infotype.xlsx, koukan.xlsx). The official lists are Japanese only; English
 * names and aliases were added here so an LLM can resolve user queries.
 */
import embassiesJson from "./data/embassies.json" with { type: "json" };

export interface Area {
  code: string;
  nameEn: string;
  nameJa: string;
}

export interface Country {
  code: string;
  areaCode: string;
  nameEn: string;
  nameJa: string;
  aliases?: string[];
}

export interface InfoType {
  code: string;
  nameEn: string;
  nameJa: string;
  category: "travel_advisory" | "embassy_notice";
  description: string;
}

export interface Embassy {
  code: string;
  areaCode: string;
  countryCode: string;
  nameJa: string;
  kind: string;
}

/** The pseudo area code "00" means "all areas" in the area-list endpoints. */
export const ALL_AREAS_CODE = "00";

export const AREAS: Area[] = [
  { code: "10", nameEn: "Asia", nameJa: "アジア" },
  { code: "20", nameEn: "Oceania", nameJa: "大洋州" },
  { code: "30", nameEn: "North America", nameJa: "北米" },
  { code: "33", nameEn: "Central and South America (Latin America & Caribbean)", nameJa: "中南米" },
  { code: "42", nameEn: "Europe (incl. Russia, Caucasus and Central Asia)", nameJa: "ヨーロッパ" },
  { code: "50", nameEn: "Middle East", nameJa: "中東" },
  { code: "60", nameEn: "Africa", nameJa: "アフリカ" },
];

const c = (code: string, areaCode: string, nameEn: string, nameJa: string, aliases?: string[]): Country => ({
  code,
  areaCode,
  nameEn,
  nameJa,
  ...(aliases ? { aliases } : {}),
});

export const COUNTRIES: Country[] = [
  // Asia (10)
  c("0060", "10", "Malaysia", "マレーシア"),
  c("0062", "10", "Indonesia", "インドネシア", ["Bali"]),
  c("0063", "10", "Philippines", "フィリピン"),
  c("0065", "10", "Singapore", "シンガポール"),
  c("0066", "10", "Thailand", "タイ"),
  c("0082", "10", "South Korea", "大韓民国／韓国", ["Korea", "Republic of Korea", "ROK"]),
  c("0084", "10", "Vietnam", "ベトナム", ["Viet Nam"]),
  c("0086", "10", "China", "中華人民共和国／中国", ["People's Republic of China", "PRC", "Mainland China"]),
  c("0091", "10", "India", "インド"),
  c("0092", "10", "Pakistan", "パキスタン"),
  c("0094", "10", "Sri Lanka", "スリランカ"),
  c("0095", "10", "Myanmar", "ミャンマー", ["Burma"]),
  c("0670", "10", "Timor-Leste", "東ティモール", ["East Timor"]),
  c("0673", "10", "Brunei", "ブルネイ", ["Brunei Darussalam"]),
  c("0850", "10", "North Korea", "北朝鮮", ["DPRK", "Democratic People's Republic of Korea"]),
  c("0852", "10", "Hong Kong", "香港"),
  c("0853", "10", "Macau", "マカオ", ["Macao"]),
  c("0855", "10", "Cambodia", "カンボジア"),
  c("0856", "10", "Laos", "ラオス", ["Lao PDR"]),
  c("0880", "10", "Bangladesh", "バングラデシュ"),
  c("0886", "10", "Taiwan", "台湾"),
  c("0960", "10", "Maldives", "モルディブ"),
  c("0975", "10", "Bhutan", "ブータン"),
  c("0976", "10", "Mongolia", "モンゴル"),
  c("0977", "10", "Nepal", "ネパール"),
  // Oceania (20)
  c("0061", "20", "Australia", "オーストラリア／豪州"),
  c("0064", "20", "New Zealand", "ニュージーランド"),
  c("0674", "20", "Nauru", "ナウル"),
  c("0675", "20", "Papua New Guinea", "パプアニューギニア", ["PNG"]),
  c("0676", "20", "Tonga", "トンガ"),
  c("0677", "20", "Solomon Islands", "ソロモン諸島"),
  c("0678", "20", "Vanuatu", "バヌアツ"),
  c("0679", "20", "Fiji", "フィジー"),
  c("0680", "20", "Palau", "パラオ"),
  c("0682", "20", "Cook Islands", "クック諸島"),
  c("0683", "20", "Niue", "ニウエ"),
  c("0685", "20", "Samoa", "サモア独立国", ["Independent State of Samoa"]),
  c("0686", "20", "Kiribati", "キリバス"),
  c("0687", "20", "New Caledonia (France)", "ニューカレドニア（仏領）", ["New Caledonia"]),
  c("0688", "20", "Tuvalu", "ツバル"),
  c("0691", "20", "Micronesia", "ミクロネシア", ["Federated States of Micronesia", "FSM"]),
  c("0692", "20", "Marshall Islands", "マーシャル諸島"),
  c("1001", "20", "United States (Northern Mariana Islands)", "アメリカ合衆国／米国（北マリアナ諸島）", ["Northern Mariana Islands", "Saipan", "CNMI"]),
  c("1002", "20", "United States (Guam)", "アメリカ合衆国／米国（グアム）", ["Guam"]),
  c("1684", "20", "American Samoa", "サモア（米領）"),
  c("9689", "20", "Tahiti (French Polynesia)", "タヒチ（仏領ポリネシア）", ["French Polynesia", "Tahiti"]),
  // North America (30)
  c("1000", "30", "United States (Mainland)", "アメリカ合衆国／米国（本土）", ["United States", "USA", "US", "America", "United States of America"]),
  c("1808", "30", "United States (Hawaii)", "アメリカ合衆国／米国（ハワイ）", ["Hawaii"]),
  c("9001", "30", "Canada", "カナダ"),
  // Central and South America (33)
  c("0051", "33", "Peru", "ペルー"),
  c("0052", "33", "Mexico", "メキシコ"),
  c("0053", "33", "Cuba", "キューバ"),
  c("0054", "33", "Argentina", "アルゼンチン"),
  c("0055", "33", "Brazil", "ブラジル"),
  c("0056", "33", "Chile", "チリ"),
  c("0057", "33", "Colombia", "コロンビア"),
  c("0058", "33", "Venezuela", "ベネズエラ"),
  c("0473", "33", "Grenada", "グレナダ"),
  c("0501", "33", "Belize", "ベリーズ"),
  c("0502", "33", "Guatemala", "グアテマラ"),
  c("0503", "33", "El Salvador", "エルサルバドル"),
  c("0504", "33", "Honduras", "ホンジュラス"),
  c("0505", "33", "Nicaragua", "ニカラグア"),
  c("0506", "33", "Costa Rica", "コスタリカ"),
  c("0507", "33", "Panama", "パナマ"),
  c("0509", "33", "Haiti", "ハイチ"),
  c("0591", "33", "Bolivia", "ボリビア"),
  c("0592", "33", "Guyana", "ガイアナ"),
  c("0593", "33", "Ecuador", "エクアドル"),
  c("0595", "33", "Paraguay", "パラグアイ"),
  c("0597", "33", "Suriname", "スリナム"),
  c("0598", "33", "Uruguay", "ウルグアイ"),
  c("0758", "33", "Saint Lucia", "セントルシア", ["St Lucia"]),
  c("0767", "33", "Dominica", "ドミニカ国"),
  c("0784", "33", "Saint Vincent and the Grenadines", "セントビンセント及びグレナディーン諸島", ["St Vincent"]),
  c("0809", "33", "Dominican Republic", "ドミニカ共和国"),
  c("0868", "33", "Trinidad and Tobago", "トリニダード・トバゴ"),
  c("0869", "33", "Saint Kitts and Nevis", "セントクリストファー・ネービス", ["St Kitts"]),
  c("0876", "33", "Jamaica", "ジャマイカ"),
  c("1242", "33", "Bahamas", "バハマ", ["The Bahamas"]),
  c("1246", "33", "Barbados", "バルバドス"),
  c("1268", "33", "Antigua and Barbuda", "アンティグア・バーブーダ"),
  // Europe (42) — MOFA groups Russia, the Caucasus and Central Asia here
  c("0007", "42", "Kazakhstan", "カザフスタン"),
  c("0030", "42", "Greece", "ギリシャ"),
  c("0031", "42", "Netherlands", "オランダ", ["Holland"]),
  c("0032", "42", "Belgium", "ベルギー"),
  c("0033", "42", "France", "フランス"),
  c("0034", "42", "Spain", "スペイン"),
  c("0036", "42", "Hungary", "ハンガリー"),
  c("0039", "42", "Italy", "イタリア"),
  c("0040", "42", "Romania", "ルーマニア"),
  c("0041", "42", "Switzerland", "スイス"),
  c("0043", "42", "Austria", "オーストリア"),
  c("0044", "42", "United Kingdom", "英国／イギリス／グレートブリテン及び北部アイルランド連合王国", ["UK", "Britain", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"]),
  c("0045", "42", "Denmark", "デンマーク"),
  c("0046", "42", "Sweden", "スウェーデン"),
  c("0047", "42", "Norway", "ノルウェー"),
  c("0048", "42", "Poland", "ポーランド"),
  c("0049", "42", "Germany", "ドイツ"),
  c("0351", "42", "Portugal", "ポルトガル"),
  c("0352", "42", "Luxembourg", "ルクセンブルク"),
  c("0353", "42", "Ireland", "アイルランド"),
  c("0354", "42", "Iceland", "アイスランド"),
  c("0355", "42", "Albania", "アルバニア"),
  c("0356", "42", "Malta", "マルタ"),
  c("0357", "42", "Cyprus", "キプロス／サイプラス"),
  c("0358", "42", "Finland", "フィンランド"),
  c("0359", "42", "Bulgaria", "ブルガリア"),
  c("0370", "42", "Lithuania", "リトアニア"),
  c("0371", "42", "Latvia", "ラトビア"),
  c("0372", "42", "Estonia", "エストニア"),
  c("0373", "42", "Moldova", "モルドバ"),
  c("0374", "42", "Armenia", "アルメニア"),
  c("0375", "42", "Belarus", "ベラルーシ"),
  c("0376", "42", "Andorra", "アンドラ"),
  c("0377", "42", "Monaco", "モナコ"),
  c("0378", "42", "San Marino", "サンマリノ"),
  c("0380", "42", "Ukraine", "ウクライナ"),
  c("0381", "42", "Serbia", "セルビア"),
  c("0382", "42", "Montenegro", "モンテネグロ"),
  c("0385", "42", "Croatia", "クロアチア"),
  c("0386", "42", "Slovenia", "スロベニア"),
  c("0387", "42", "Bosnia and Herzegovina", "ボスニア・ヘルツェゴビナ", ["Bosnia"]),
  c("0389", "42", "North Macedonia", "北マケドニア共和国", ["Macedonia"]),
  c("0420", "42", "Czech Republic", "チェコ", ["Czechia"]),
  c("0421", "42", "Slovakia", "スロバキア"),
  c("0423", "42", "Liechtenstein", "リヒテンシュタイン"),
  c("0992", "42", "Tajikistan", "タジキスタン"),
  c("0993", "42", "Turkmenistan", "トルクメニスタン"),
  c("0994", "42", "Azerbaijan", "アゼルバイジャン"),
  c("0995", "42", "Georgia", "ジョージア（旧グルジア）"),
  c("0996", "42", "Kyrgyzstan", "キルギス", ["Kyrgyz Republic"]),
  c("0998", "42", "Uzbekistan", "ウズベキスタン"),
  c("9007", "42", "Russia", "ロシア", ["Russian Federation"]),
  c("9039", "42", "Vatican City", "バチカン市国", ["Holy See", "Vatican"]),
  c("9381", "42", "Kosovo", "コソボ"),
  // Middle East (50)
  c("0090", "50", "Turkey", "トルコ", ["Türkiye", "Turkiye"]),
  c("0093", "50", "Afghanistan", "アフガニスタン"),
  c("0098", "50", "Iran", "イラン"),
  c("0961", "50", "Lebanon", "レバノン"),
  c("0962", "50", "Jordan", "ヨルダン"),
  c("0963", "50", "Syria", "シリア"),
  c("0964", "50", "Iraq", "イラク"),
  c("0965", "50", "Kuwait", "クウェート"),
  c("0966", "50", "Saudi Arabia", "サウジアラビア"),
  c("0967", "50", "Yemen", "イエメン"),
  c("0968", "50", "Oman", "オマーン"),
  c("0970", "50", "Palestine", "パレスチナ", ["Palestinian Territories", "Gaza", "West Bank"]),
  c("0971", "50", "United Arab Emirates", "アラブ首長国連邦", ["UAE", "Dubai", "Abu Dhabi"]),
  c("0972", "50", "Israel", "イスラエル"),
  c("0973", "50", "Bahrain", "バーレーン"),
  c("0974", "50", "Qatar", "カタール"),
  // Africa (60)
  c("0020", "60", "Egypt", "エジプト"),
  c("0027", "60", "South Africa", "南アフリカ共和国"),
  c("0211", "60", "South Sudan", "南スーダン"),
  c("0212", "60", "Morocco", "モロッコ"),
  c("0213", "60", "Algeria", "アルジェリア"),
  c("0216", "60", "Tunisia", "チュニジア"),
  c("0218", "60", "Libya", "リビア"),
  c("0220", "60", "Gambia", "ガンビア", ["The Gambia"]),
  c("0221", "60", "Senegal", "セネガル"),
  c("0222", "60", "Mauritania", "モーリタニア"),
  c("0223", "60", "Mali", "マリ"),
  c("0224", "60", "Guinea", "ギニア"),
  c("0225", "60", "Côte d'Ivoire", "コートジボワール", ["Ivory Coast", "Cote d'Ivoire"]),
  c("0226", "60", "Burkina Faso", "ブルキナファソ"),
  c("0227", "60", "Niger", "ニジェール"),
  c("0228", "60", "Togo", "トーゴ"),
  c("0229", "60", "Benin", "ベナン"),
  c("0230", "60", "Mauritius", "モーリシャス"),
  c("0231", "60", "Liberia", "リベリア"),
  c("0232", "60", "Sierra Leone", "シエラレオネ"),
  c("0233", "60", "Ghana", "ガーナ"),
  c("0234", "60", "Nigeria", "ナイジェリア"),
  c("0235", "60", "Chad", "チャド"),
  c("0236", "60", "Central African Republic", "中央アフリカ", ["CAR"]),
  c("0237", "60", "Cameroon", "カメルーン"),
  c("0238", "60", "Cabo Verde", "カーボベルデ", ["Cape Verde"]),
  c("0239", "60", "São Tomé and Príncipe", "サントメ・プリンシペ", ["Sao Tome and Principe"]),
  c("0240", "60", "Equatorial Guinea", "赤道ギニア"),
  c("0241", "60", "Gabon", "ガボン"),
  c("0242", "60", "Republic of the Congo", "コンゴ共和国", ["Congo-Brazzaville", "Congo Republic"]),
  c("0243", "60", "Democratic Republic of the Congo", "コンゴ民主共和国", ["DRC", "DR Congo", "Congo-Kinshasa"]),
  c("0244", "60", "Angola", "アンゴラ"),
  c("0245", "60", "Guinea-Bissau", "ギニアビサウ"),
  c("0248", "60", "Seychelles", "セーシェル"),
  c("0249", "60", "Sudan", "スーダン"),
  c("0250", "60", "Rwanda", "ルワンダ"),
  c("0251", "60", "Ethiopia", "エチオピア"),
  c("0252", "60", "Somalia", "ソマリア"),
  c("0253", "60", "Djibouti", "ジブチ"),
  c("0254", "60", "Kenya", "ケニア"),
  c("0255", "60", "Tanzania", "タンザニア"),
  c("0256", "60", "Uganda", "ウガンダ"),
  c("0257", "60", "Burundi", "ブルンジ"),
  c("0258", "60", "Mozambique", "モザンビーク"),
  c("0260", "60", "Zambia", "ザンビア"),
  c("0261", "60", "Madagascar", "マダガスカル"),
  c("0263", "60", "Zimbabwe", "ジンバブエ"),
  c("0264", "60", "Namibia", "ナミビア"),
  c("0265", "60", "Malawi", "マラウイ"),
  c("0266", "60", "Lesotho", "レソト"),
  c("0267", "60", "Botswana", "ボツワナ"),
  c("0268", "60", "Eswatini", "エスワティニ", ["Swaziland"]),
  c("0269", "60", "Comoros", "コモロ"),
  c("0291", "60", "Eritrea", "エリトリア"),
  c("9212", "60", "Western Sahara", "西サハラ"),
];

export const INFO_TYPES: InfoType[] = [
  {
    code: "T40",
    nameEn: "Risk Information (travel advisory)",
    nameJa: "危険情報",
    category: "travel_advisory",
    description:
      "Standing travel advisory for a country, assigning Levels 1–4 to regions within it based on security conditions.",
  },
  {
    code: "T81",
    nameEn: "Infectious Disease Risk Information",
    nameJa: "感染症危険情報",
    category: "travel_advisory",
    description:
      "Standing advisory for high-risk infectious diseases (e.g. pandemic influenza), using the same Levels 1–4.",
  },
  {
    code: "T41",
    nameEn: "Infectious Disease Risk Information (legacy code)",
    nameJa: "感染症危険情報",
    category: "travel_advisory",
    description: "Older code for Infectious Disease Risk Information that appears in the format spec.",
  },
  {
    code: "C30",
    nameEn: "Spot Information",
    nameJa: "スポット情報",
    category: "travel_advisory",
    description:
      "Breaking alert about a specific incident or emerging risk in one country (terrorism, unrest, disaster, crime trends, etc.).",
  },
  {
    code: "C31",
    nameEn: "Spot Information (Infectious Disease)",
    nameJa: "スポット情報(感染症)",
    category: "travel_advisory",
    description: "Spot Information about an infectious disease outbreak.",
  },
  {
    code: "C50",
    nameEn: "Wide-area Information",
    nameJa: "広域情報",
    category: "travel_advisory",
    description:
      "Alert covering multiple countries or the whole world (e.g. international terrorism trends, global events).",
  },
  {
    code: "C51",
    nameEn: "Wide-area Information (Infectious Disease)",
    nameJa: "広域情報(感染症)",
    category: "travel_advisory",
    description: "Wide-area alert about an infectious disease spreading across multiple countries.",
  },
  {
    code: "R10",
    nameEn: "Embassy/Consulate Notice (General)",
    nameJa: "領事メール(一般)",
    category: "embassy_notice",
    description:
      "Email notice sent by a Japanese embassy or consulate to registered Japanese nationals (Tabireg / ORRnet): crime warnings, demonstrations, holidays, office closures, etc.",
  },
  {
    code: "R20",
    nameEn: "Embassy/Consulate Notice (Emergency)",
    nameJa: "領事メール(緊急)",
    category: "embassy_notice",
    description:
      "Urgent notice from a Japanese embassy or consulate (attacks, disasters, coups, evacuation guidance, etc.).",
  },
];

export const RISK_LEVELS = [
  {
    level: 1,
    nameEn: "Level 1: Exercise caution",
    nameJa: "レベル１：十分注意してください。",
    description: "Special caution is required to avoid danger when traveling to or staying in the area.",
  },
  {
    level: 2,
    nameEn: "Level 2: Avoid non-essential travel",
    nameJa: "レベル２：不要不急の渡航は止めてください。",
    description:
      "Non-essential travel should be cancelled. Anyone who does travel must take special care and adequate safety measures.",
  },
  {
    level: 3,
    nameEn: "Level 3: Avoid all travel (travel cancellation advisory)",
    nameJa: "レベル３：渡航は止めてください。（渡航中止勧告）",
    description:
      "All travel should be cancelled regardless of purpose. May include messages urging residents to prepare for possible evacuation.",
  },
  {
    level: 4,
    nameEn: "Level 4: Evacuate and avoid all travel (evacuation advisory)",
    nameJa: "レベル４：退避してください。渡航は止めてください。（退避勧告）",
    description:
      "People in the area should evacuate to a safe country/region. All new travel is to be cancelled regardless of purpose.",
  },
] as const;

export const INFECTION_LEVELS = [
  {
    level: 1,
    nameEn: "Level 1: Exercise caution",
    description:
      "WHO Emergency Committee convened under IHR Art. 49 and travel is judged to carry risk.",
  },
  {
    level: 2,
    nameEn: "Level 2: Avoid non-essential travel",
    description: "WHO Director-General declares a Public Health Emergency of International Concern (PHEIC).",
  },
  {
    level: 3,
    nameEn: "Level 3: Avoid all travel (travel cancellation advisory)",
    description: "As Level 2, and WHO accepts trade/travel restrictions to prevent spread (IHR Art. 18).",
  },
  {
    level: 4,
    nameEn: "Level 4: Evacuate and avoid all travel (evacuation advisory)",
    description: "As Level 3, and the local medical system is clearly fragile.",
  },
] as const;

function embassyKind(nameJa: string): string {
  if (nameJa.includes("代表部")) return "Permanent Mission / Representative Office";
  if (nameJa.includes("大使館")) return "Embassy";
  if (nameJa.includes("総領事館")) return "Consulate-General";
  if (nameJa.includes("領事事務所")) return "Consular Office";
  if (nameJa.includes("出張駐在官")) return "Branch Office (Resident Officer)";
  if (nameJa.includes("交流協会")) return "Japan-Taiwan Exchange Association office";
  return "Territory/jurisdiction entry (no resident mission)";
}

export const EMBASSIES: Embassy[] = (embassiesJson as Array<{ areaCd: string; countryCd: string; cd: string; ja: string }>).map(
  (e) => ({
    code: e.cd,
    areaCode: e.areaCd,
    countryCode: e.countryCd,
    nameJa: e.ja,
    kind: embassyKind(e.ja),
  }),
);

// ---------- lookups ----------

const areaByCode = new Map(AREAS.map((a) => [a.code, a]));
const countryByCode = new Map(COUNTRIES.map((x) => [x.code, x]));
const infoTypeByCode = new Map(INFO_TYPES.map((t) => [t.code, t]));
const embassyByCode = new Map(EMBASSIES.map((e) => [e.code, e]));

export const getArea = (code: string | undefined) => (code ? areaByCode.get(code) : undefined);
export const getCountry = (code: string | undefined) => (code ? countryByCode.get(code) : undefined);
export const getInfoType = (code: string | undefined) => (code ? infoTypeByCode.get(code) : undefined);
export const getEmbassy = (code: string | undefined) => (code ? embassyByCode.get(code) : undefined);

function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Normalize an area code given as "10", "Asia", "アジア", etc. */
export function resolveAreaCode(input: string): string | undefined {
  const raw = input.trim();
  if (raw === ALL_AREAS_CODE || /^(all|world|global|worldwide)$/i.test(raw)) return ALL_AREAS_CODE;
  if (areaByCode.has(raw)) return raw;
  const n = normalize(raw);
  const hit = AREAS.find((a) => normalize(a.nameEn).split(" ")[0] === n || normalize(a.nameEn) === n || a.nameJa === raw);
  if (hit) return hit.code;
  const partial = AREAS.find((a) => normalize(a.nameEn).includes(n));
  return partial?.code;
}

/**
 * Search countries by code, English name, alias or Japanese name.
 * Exact matches rank first, then prefix matches, then substring matches.
 */
export function searchCountries(query: string): Country[] {
  const raw = query.trim();
  if (!raw) return [];
  if (/^\d{1,4}$/.test(raw)) {
    const hit = countryByCode.get(raw.padStart(4, "0"));
    return hit ? [hit] : [];
  }
  const n = normalize(raw);
  const scored: Array<{ country: Country; score: number }> = [];
  for (const country of COUNTRIES) {
    const names = [country.nameEn, ...(country.aliases ?? [])].map(normalize);
    const jaNames = country.nameJa.split(/[／（）]/).filter(Boolean);
    let score = 0;
    if (names.includes(n) || jaNames.includes(raw)) score = 100;
    else if (names.some((x) => x.startsWith(n)) || jaNames.some((x) => x.startsWith(raw))) score = 50;
    else if (names.some((x) => x.includes(n)) || country.nameJa.includes(raw)) score = 10;
    if (score) scored.push({ country, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.country);
}

/** Resolve a single country code from a code or name; throws a helpful error if ambiguous/unknown. */
export function resolveCountryCode(input: string): string {
  const matches = searchCountries(input);
  if (matches.length === 0) {
    throw new Error(
      `Unknown country "${input}". Use the search_countries tool to find the 4-digit MOFA country code.`,
    );
  }
  const exact = matches.filter((m) => {
    const n = normalize(input);
    return (
      m.code === input.padStart(4, "0") ||
      normalize(m.nameEn) === n ||
      (m.aliases ?? []).some((a) => normalize(a) === n) ||
      m.nameJa.split(/[／（）]/).includes(input.trim())
    );
  });
  if (exact.length === 1) return exact[0].code;
  if (matches.length === 1) return matches[0].code;
  const list = matches
    .slice(0, 8)
    .map((m) => `${m.code} ${m.nameEn}`)
    .join(", ");
  throw new Error(`Country "${input}" is ambiguous: ${list}. Pass the 4-digit countryCode instead.`);
}
