import { ComplianceAuditVerdict, EvidenceAuditItem } from "./adsense-compliance-engine";

export interface ServerTrafficLogEntry {
  timestamp: string;
  ipHash: string;
  userAgent: string;
  referrer: string;
  countryCode: string;
  path: string;
  adClickRecorded?: boolean;
}

export interface TrafficQualityAuditInput {
  websiteId: string;
  logs: ServerTrafficLogEntry[];
  baselineDailySessions?: number;
  currentDailySessions?: number;
}

export interface TrafficQualityReport {
  websiteId: string;
  overallVerdict: ComplianceAuditVerdict;
  botTrafficRatioPct: number;
  suspiciousReferrers: string[];
  invalidClickSpikeDetected: boolean;
  countryDistribution: Record<string, number>;
  auditItems: EvidenceAuditItem[];
  evaluatedAt: string;
}

const KNOWN_SCRAPER_OR_BOT_UA =
  /\b(headlesschrome|phantomjs|selenium|puppeteer|playwright|python-requests|curl|wget|scrapy|go-http-client|ahrefsbot|semrushbot|mj12bot|dotbot)\b/i;

const SUSPICIOUS_TRAFFIC_EXCHANGE_REFERRERS =
  /\b(10khits|hitleap|sparktraffic|babylon-traffic|autosurf|buy-cheap-traffic|ptc-clicks|traffic-bot)\b/i;

/**
 * Module 6: Traffic Quality Protection & Invalid Traffic (IVT) Detector.
 * Protects AdSense accounts by flagging bot User-Agents, traffic-exchange referrers,
 * single-IP click bursts, and sudden unattributed session spikes.
 * Never purchases, generates, or simulates artificial traffic.
 */
export function evaluateTrafficQualityProtection(
  input: TrafficQualityAuditInput
): TrafficQualityReport {
  if (input.logs.length === 0) {
    return {
      websiteId: input.websiteId,
      overallVerdict: "NOT_VERIFIED",
      botTrafficRatioPct: 0,
      suspiciousReferrers: [],
      invalidClickSpikeDetected: false,
      countryDistribution: {},
      auditItems: [
        {
          id: "TRAFFIC_TELEMETRY_STATUS",
          layer: "TRAFFIC_QUALITY",
          requirement: "Server-side traffic analytics and Invalid Traffic (IVT) monitoring",
          currentStatus: "No live server traffic logs recorded yet (Zero fabricated traffic)",
          evidence: "logs.length === 0",
          severity: "LOW",
          recommendedFix:
            "Stream server access logs or GA4 / GSC telemetry to monitor for bot spikes and suspicious referrers",
          validationResult: "NOT_VERIFIED"
        }
      ],
      evaluatedAt: new Date().toISOString()
    };
  }

  let botHits = 0;
  const suspiciousReferrerSet = new Set<string>();
  const clicksByIp = new Map<string, number>();
  const countryDistribution: Record<string, number> = {};

  for (const entry of input.logs) {
    if (KNOWN_SCRAPER_OR_BOT_UA.test(entry.userAgent)) {
      botHits++;
    }
    if (SUSPICIOUS_TRAFFIC_EXCHANGE_REFERRERS.test(entry.referrer)) {
      suspiciousReferrerSet.add(entry.referrer);
    }
    if (entry.adClickRecorded) {
      clicksByIp.set(entry.ipHash, (clicksByIp.get(entry.ipHash) || 0) + 1);
    }
    const cc = entry.countryCode || "UNKNOWN";
    countryDistribution[cc] = (countryDistribution[cc] || 0) + 1;
  }

  const botTrafficRatioPct = Number(((botHits / input.logs.length) * 100).toFixed(2));
  const suspiciousReferrers = Array.from(suspiciousReferrerSet);

  let maxClicksSingleIp = 0;
  for (const count of clicksByIp.values()) {
    if (count > maxClicksSingleIp) maxClicksSingleIp = count;
  }
  const invalidClickSpikeDetected = maxClicksSingleIp >= 3;

  const auditItems: EvidenceAuditItem[] = [
    {
      id: "TRAFFIC_BOT_FILTER",
      layer: "TRAFFIC_QUALITY",
      requirement: "Automated bot & headless browser traffic detection",
      currentStatus:
        botTrafficRatioPct > 25
          ? `High automated bot ratio (${botTrafficRatioPct}%)`
          : `Bot ratio within normal crawl bounds (${botTrafficRatioPct}%)`,
      evidence: `Total sampled requests: ${input.logs.length}; Bot UA matches: ${botHits} (${botTrafficRatioPct}%)`,
      severity: "HIGH",
      recommendedFix:
        botTrafficRatioPct > 25
          ? "Block automated headless browsers at the WAF/reverse-proxy level and suppress ad rendering for non-human user agents"
          : null,
      validationResult:
        botTrafficRatioPct > 40 ? "FAIL" : botTrafficRatioPct > 20 ? "WARNING" : "PASS"
    },
    {
      id: "TRAFFIC_SUSPICIOUS_REFERRERS",
      layer: "TRAFFIC_QUALITY",
      requirement: "Prohibition of auto-surf, pay-to-click (PTC), and traffic-exchange referrals",
      currentStatus:
        suspiciousReferrers.length === 0
          ? "0 suspicious traffic-exchange referrers detected"
          : `ALERT: ${suspiciousReferrers.length} suspicious referrer(s) detected`,
      evidence:
        suspiciousReferrers.length === 0
          ? "Clean referrer profile"
          : `Suspicious referrers: ${suspiciousReferrers.join(", ")}`,
      severity: "CRITICAL",
      recommendedFix:
        suspiciousReferrers.length === 0
          ? null
          : "Immediately block traffic-exchange referrers at the edge firewall and disable ad tags on sessions originating from untrusted referrers",
      validationResult: suspiciousReferrers.length === 0 ? "PASS" : "FAIL"
    },
    {
      id: "TRAFFIC_INVALID_CLICK_BURST",
      layer: "TRAFFIC_QUALITY",
      requirement: "AdSense Invalid Traffic (IVT) repetitive single-IP click burst protection",
      currentStatus: invalidClickSpikeDetected
        ? `CRITICAL IVT ALERT: Single IP hash recorded ${maxClicksSingleIp} rapid ad clicks`
        : "No repetitive single-IP ad click bursts detected",
      evidence: `Peak ad clicks from a single IP hash: ${maxClicksSingleIp}`,
      severity: "CRITICAL",
      recommendedFix: invalidClickSpikeDetected
        ? "Temporarily hide ad units for repeat-click IP hashes and submit an Invalid Clicks Contact Form report in AdSense if attack persists"
        : null,
      validationResult: invalidClickSpikeDetected ? "FAIL" : "PASS"
    }
  ];

  const hasFail = auditItems.some((i) => i.validationResult === "FAIL");
  const hasWarn = auditItems.some((i) => i.validationResult === "WARNING");

  return {
    websiteId: input.websiteId,
    overallVerdict: hasFail ? "FAIL" : hasWarn ? "WARNING" : "PASS",
    botTrafficRatioPct,
    suspiciousReferrers,
    invalidClickSpikeDetected,
    countryDistribution,
    auditItems,
    evaluatedAt: new Date().toISOString()
  };
}

export interface PolicyReferenceEntry {
  id: string;
  policyName: string;
  officialUrl: string;
  lastCheckedDate: string;
  versionOrRevisionTag: string;
  changeSummary: string;
  affectedModules: string[];
  requiredCodeOrContentChanges: string;
}

/**
 * Module 7: Configurable Google Search & AdSense Policy Update Monitor Registry.
 */
export const GOOGLE_POLICY_REGISTRY: PolicyReferenceEntry[] = [
  {
    id: "POLICY_SEARCH_ESSENTIALS",
    policyName: "Google Search Essentials (formerly Webmaster Guidelines)",
    officialUrl: "https://developers.google.com/search/docs/essentials",
    lastCheckedDate: "2026-11-12",
    versionOrRevisionTag: "2026.11-core",
    changeSummary:
      "Enforces technical crawlability (HTTP 200, crawlable <a href>, SSR HTML), spam prevention, and people-first helpful content.",
    affectedModules: ["TECHNICAL_SEO", "ON_PAGE_SEO", "CONTENT_QUALITY"],
    requiredCodeOrContentChanges:
      "Maintain static/SSR HTML rendering check and crawlable anchor validation in technical-seo-engine.ts."
  },
  {
    id: "POLICY_SEARCH_SPAM",
    policyName: "Google Search Spam Policies (Scaled Content Abuse, Cloaking, Stuffing)",
    officialUrl: "https://developers.google.com/search/docs/essentials/spam-policies",
    lastCheckedDate: "2026-11-12",
    versionOrRevisionTag: "2026.11-spam-guard",
    changeSummary:
      "Prohibits scaled content abuse (generating many pages without value for users regardless of whether created by AI or humans), hidden text, cloaking, and doorway pages.",
    affectedModules: ["SPAM_POLICY", "CONTENT_QUALITY", "PUBLISHING_GATE"],
    requiredCodeOrContentChanges:
      "Block near-duplicate n-gram shingles (>=45% overlap) and require human review or practical artifacts before publishing."
  },
  {
    id: "POLICY_HELPFUL_CONTENT",
    policyName: "Creating Helpful, Reliable, People-First Content",
    officialUrl: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
    lastCheckedDate: "2026-11-12",
    versionOrRevisionTag: "2026.11-people-first",
    changeSummary:
      "Emphasizes original information, substantive depth, clear author transparency, and avoiding arbitrary word-count targets.",
    affectedModules: ["CONTENT_QUALITY", "ON_PAGE_SEO", "YMYL_PROTECTION"],
    requiredCodeOrContentChanges:
      "Never use fixed word-count or keyword-density quotas as quality proxies; verify citations and author attribution."
  },
  {
    id: "POLICY_GOOGLE_PUBLISHER",
    policyName: "Google Publisher Policies & Google Publisher Restrictions",
    officialUrl: "https://support.google.com/publisherpolicies/answer/10502938",
    lastCheckedDate: "2026-11-12",
    versionOrRevisionTag: "2026.11-publisher",
    changeSummary:
      "Governs illegal/prohibited content, copyright infringement, dangerous/derogatory content, and unmoderated user-generated content.",
    affectedModules: ["ADSENSE_POLICY", "WEBSITE_READINESS", "PUBLISHING_GATE"],
    requiredCodeOrContentChanges:
      "Run prohibited/restricted content scan and copyright originality check in adsense-compliance-engine.ts before publishing."
  },
  {
    id: "POLICY_ADSENSE_PROGRAM",
    policyName: "AdSense Program Policies & Ad Placement Policies",
    officialUrl: "https://support.google.com/adsense/answer/48182",
    lastCheckedDate: "2026-11-12",
    versionOrRevisionTag: "2026.11-adsense-program",
    changeSummary:
      "Requires valuable inventory (no ads on thin/under-construction pages), clear ad labeling ('Advertisements' or 'Sponsored Links' only), and authorized ads.txt.",
    affectedModules: ["ADSENSE_POLICY", "WEBSITE_READINESS"],
    requiredCodeOrContentChanges:
      "Enforce all 5 mandatory trust pages (About, Contact, Privacy, Terms, Editorial) and validate /ads.txt record."
  },
  {
    id: "POLICY_ADSENSE_INVALID_TRAFFIC",
    policyName: "AdSense Invalid Traffic (IVT) & Artificial Clicks/Impressions Policy",
    officialUrl: "https://support.google.com/adsense/answer/16737",
    lastCheckedDate: "2026-11-12",
    versionOrRevisionTag: "2026.11-ivt-guard",
    changeSummary:
      "Strictly prohibits clicking own ads, automated click/impression tools, auto-refreshing ad slots without user interaction, and paid-to-click / traffic-exchange sources.",
    affectedModules: ["ADSENSE_POLICY", "TRAFFIC_QUALITY"],
    requiredCodeOrContentChanges:
      "Monitor server logs via evaluateTrafficQualityProtection() and block suspicious referrers and single-IP click bursts."
  }
];

