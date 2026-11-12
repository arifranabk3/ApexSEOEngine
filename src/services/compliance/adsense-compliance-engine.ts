export type ComplianceAuditVerdict = "PASS" | "WARNING" | "FAIL" | "NOT_VERIFIED";

export interface EvidenceAuditItem {
  id: string;
  layer:
    | "GOOGLE_SEARCH"
    | "ADSENSE_POLICY"
    | "TECHNICAL_SEO"
    | "CONTENT_QUALITY"
    | "WEBSITE_READINESS"
    | "TRAFFIC_QUALITY";
  requirement: string;
  currentStatus: string;
  evidence: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  recommendedFix: string | null;
  validationResult: ComplianceAuditVerdict;
}

export interface AdSenseWebsiteIdentityInput {
  hasAboutUsPage: boolean;
  hasContactUsPage: boolean;
  hasPrivacyPolicyPage: boolean;
  hasTermsAndConditionsPage: boolean;
  hasEditorialPolicyPage: boolean;
  hasClearAuthorAttribution: boolean;
  hasClearSiteNavigation: boolean;
}

export interface AdSenseContentPolicyInput {
  htmlContent: string;
  isOriginalContentVerified?: boolean;
  hasCopyrightedScrapedMaterial?: boolean;
  hasUnmoderatedUserGeneratedContent?: boolean;
}

export interface AdSenseAdPlacementAndTechnicalInput {
  siteUrl: string;
  adsTxtContent?: string | null;
  publisherId?: string | null; // e.g., pub-1234567890123456
  adSlotCount?: number;
  hasMisleadingAdLabels?: boolean; // e.g., labeling ads as "Helpful Links" or "Download Now"
  hasAccidentalClickLayout?: boolean; // e.g., ads too close to navigation buttons or sticky overlapping
  attemptsAutoClickOrRefreshAds?: boolean;
  usesIncentivizedOrBotTraffic?: boolean;
  allowsMediapartnersGoogleCrawler?: boolean;
  hasCmpConsentBannerConfigured?: boolean;
  policyCenterLastReviewedAt?: string | null;
  adServingStatus?: "ACTIVE" | "LIMITED" | "DISABLED" | "NOT_CONNECTED";
}

export interface AdSenseFullAuditInput {
  websiteId: string;
  identity: AdSenseWebsiteIdentityInput;
  content: AdSenseContentPolicyInput;
  advertisingAndTechnical: AdSenseAdPlacementAndTechnicalInput;
}

export interface AdSenseComplianceReport {
  websiteId: string;
  overallVerdict: ComplianceAuditVerdict;
  adSenseReady: boolean;
  disclaimer: string;
  summary: {
    pass: number;
    warning: number;
    fail: number;
    notVerified: number;
  };
  items: EvidenceAuditItem[];
  evaluatedAt: string;
}

/**
 * Validates ads.txt syntax and Google Publisher ID (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`).
 */
export function validateAdsTxtRecord(
  adsTxtContent: string | null | undefined,
  publisherId: string | null | undefined
): { valid: boolean; verdict: ComplianceAuditVerdict; evidence: string; fix: string | null } {
  if (!adsTxtContent || !publisherId) {
    return {
      valid: false,
      verdict: "NOT_VERIFIED",
      evidence: "ads.txt content or Publisher ID (pub-XXXXXXXXXXXXXXXX) not configured yet",
      fix: "Publish /ads.txt at the root domain containing: google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0"
    };
  }

  const pubPattern = /^pub-\d{16}$/;
  if (!pubPattern.test(publisherId.trim())) {
    return {
      valid: false,
      verdict: "FAIL",
      evidence: `Malformed Publisher ID format: "${publisherId}" (Expected pub- followed by 16 digits)`,
      fix: "Correct the Google AdSense Publisher ID to match pub-0000000000000000 format"
    };
  }

  const lines = adsTxtContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const matchingLine = lines.find((line) => {
    const parts = line.split(",").map((p) => p.trim());
    return (
      parts.length >= 3 &&
      parts[0].toLowerCase() === "google.com" &&
      parts[1] === publisherId.trim() &&
      (parts[2].toUpperCase() === "DIRECT" || parts[2].toUpperCase() === "RESELLER")
    );
  });

  if (!matchingLine) {
    return {
      valid: false,
      verdict: "FAIL",
      evidence: `ads.txt missing authorized google.com entry for ${publisherId}`,
      fix: `Add line to /ads.txt: google.com, ${publisherId.trim()}, DIRECT, f08c47fec0942fa0`
    };
  }

  return {
    valid: true,
    verdict: "PASS",
    evidence: `Verified authorized ads.txt line: "${matchingLine}"`,
    fix: null
  };
}

/**
 * Separate, Independent Google AdSense & Publisher Policies Compliance Engine (Module 3).
 * Never conflates Technical SEO with AdSense eligibility.
 */
export function evaluateAdSenseCompliance(
  input: AdSenseFullAuditInput
): AdSenseComplianceReport {
  const items: EvidenceAuditItem[] = [];

  // A. Website Identity & Mandatory Trust Pages
  const mandatoryPages = [
    { key: "About Us", present: input.identity.hasAboutUsPage },
    { key: "Contact Us", present: input.identity.hasContactUsPage },
    { key: "Privacy Policy", present: input.identity.hasPrivacyPolicyPage },
    { key: "Terms and Conditions", present: input.identity.hasTermsAndConditionsPage },
    { key: "Editorial Policy", present: input.identity.hasEditorialPolicyPage }
  ];
  const missingPages = mandatoryPages.filter((p) => !p.present).map((p) => p.key);

  items.push({
    id: "ADSENSE_IDENTITY_PAGES",
    layer: "ADSENSE_POLICY",
    requirement:
      "Mandatory Publisher Trust Pages (About Us, Contact Us, Privacy Policy, Terms & Conditions, Editorial Policy)",
    currentStatus:
      missingPages.length === 0
        ? "All 5 trust pages present"
        : `Missing ${missingPages.length} trust page(s): ${missingPages.join(", ")}`,
    evidence: `Present: ${mandatoryPages
      .filter((p) => p.present)
      .map((p) => p.key)
      .join(", ") || "None"}`,
    severity: "CRITICAL",
    recommendedFix:
      missingPages.length === 0
        ? null
        : `Create and link visible ${missingPages.join(", ")} pages in the site footer before applying for AdSense`,
    validationResult: missingPages.length === 0 ? "PASS" : "FAIL"
  });

  items.push({
    id: "ADSENSE_AUTHOR_AND_NAV",
    layer: "ADSENSE_POLICY",
    requirement: "Clear Author Attribution & Accessible Site Navigation",
    currentStatus:
      input.identity.hasClearAuthorAttribution && input.identity.hasClearSiteNavigation
        ? "Author transparency and navigation verified"
        : "Incomplete author transparency or site navigation",
    evidence: `Author attribution: ${input.identity.hasClearAuthorAttribution}; Clear navigation: ${input.identity.hasClearSiteNavigation}`,
    severity: "HIGH",
    recommendedFix:
      input.identity.hasClearAuthorAttribution && input.identity.hasClearSiteNavigation
        ? null
        : "Display clear author bylines/bios on articles and provide a consistent top/footer navigation menu",
    validationResult:
      input.identity.hasClearAuthorAttribution && input.identity.hasClearSiteNavigation
        ? "PASS"
        : "FAIL"
  });

  // B. Content Compliance (Prohibited, Restricted, Copyright, Thin/Scraped, UGC)
  const plainText = input.content.htmlContent
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const prohibitedPattern =
    /\b(cracked\s+software|keygen\s+download|pirated\s+movies|illegal\s+narcotics|hate\s+speech|pay-to-click\s+hack|click\s+our\s+sponsors\s+below)\b/i;
  const restrictedPattern =
    /\b(online\s+casino\s+real\s+money|prescription\s+drugs\s+without\s+rx|tobacco\s+vape\s+shop)\b/i;

  const hasProhibited = prohibitedPattern.test(plainText);
  const hasRestricted = restrictedPattern.test(plainText);

  items.push({
    id: "ADSENSE_PROHIBITED_RESTRICTED_CONTENT",
    layer: "ADSENSE_POLICY",
    requirement: "Google Publisher Policies & Google Publisher Restrictions scan",
    currentStatus: hasProhibited
      ? "Prohibited content detected"
      : hasRestricted
      ? "Restricted ad-demand content detected"
      : "No prohibited or restricted publisher content detected",
    evidence: `Prohibited match: ${hasProhibited}; Restricted match: ${hasRestricted}`,
    severity: "CRITICAL",
    recommendedFix: hasProhibited
      ? "Immediately remove prohibited content (piracy, illegal goods, hate speech, or click encouragement)"
      : hasRestricted
      ? "Review Google Publisher Restrictions for restricted categories before serving ads"
      : null,
    validationResult: hasProhibited ? "FAIL" : hasRestricted ? "WARNING" : "PASS"
  });

  const copyrightViolation = Boolean(input.content.hasCopyrightedScrapedMaterial);
  const ugcUnmoderated = Boolean(input.content.hasUnmoderatedUserGeneratedContent);

  items.push({
    id: "ADSENSE_COPYRIGHT_AND_UGC",
    layer: "ADSENSE_POLICY",
    requirement: "Copyright originality compliance and User-Generated Content (UGC) moderation",
    currentStatus: copyrightViolation
      ? "Unlicensed/scraped copyrighted material flagged"
      : ugcUnmoderated
      ? "Unmoderated UGC present without abuse filters"
      : "Original content & moderated environment verified",
    evidence: `Copyright risk: ${copyrightViolation}; Unmoderated UGC: ${ugcUnmoderated}`,
    severity: "CRITICAL",
    recommendedFix:
      copyrightViolation || ugcUnmoderated
        ? "Publish only original or properly licensed content and enforce moderation before displaying ads on UGC pages"
        : null,
    validationResult: copyrightViolation ? "FAIL" : ugcUnmoderated ? "WARNING" : "PASS"
  });

  // C. Advertising Placement & Invalid Traffic Prevention (Zero artificial clicks/impressions)
  const invalidTrafficRisk = Boolean(
    input.advertisingAndTechnical.attemptsAutoClickOrRefreshAds ||
      input.advertisingAndTechnical.usesIncentivizedOrBotTraffic
  );
  const placementViolation = Boolean(
    input.advertisingAndTechnical.hasMisleadingAdLabels ||
      input.advertisingAndTechnical.hasAccidentalClickLayout
  );

  items.push({
    id: "ADSENSE_INVALID_TRAFFIC_AND_PLACEMENT",
    layer: "ADSENSE_POLICY",
    requirement:
      "Strict prohibition of artificial ad clicks/impressions, auto-refreshing ads, misleading labels, and accidental click layouts",
    currentStatus: invalidTrafficRisk
      ? "CRITICAL VIOLATION: Artificial traffic/click/refresh detected"
      : placementViolation
      ? "Ad placement / misleading label violation detected"
      : "Compliant ad separation and zero artificial impression/click automation",
    evidence: `Artificial click/refresh/bot: ${invalidTrafficRisk}; Misleading label/accidental click layout: ${placementViolation}; Ad slots: ${
      input.advertisingAndTechnical.adSlotCount ?? 0
    }`,
    severity: "CRITICAL",
    recommendedFix:
      invalidTrafficRisk || placementViolation
        ? "Never automate ad clicks/impressions, never use incentivized traffic, label ads only as 'Advertisements' or 'Sponsored Links', and separate ads clearly from interactive controls"
        : null,
    validationResult: invalidTrafficRisk || placementViolation ? "FAIL" : "PASS"
  });

  // D. Technical Advertising Requirements (ads.txt, Publisher ID, HTTPS, Crawler, Consent)
  const adsTxtCheck = validateAdsTxtRecord(
    input.advertisingAndTechnical.adsTxtContent,
    input.advertisingAndTechnical.publisherId
  );

  items.push({
    id: "ADSENSE_ADS_TXT_AND_PUB_ID",
    layer: "ADSENSE_POLICY",
    requirement: "Authorized /ads.txt file and verified Google Publisher ID (pub-XXXXXXXXXXXXXXXX)",
    currentStatus: adsTxtCheck.valid ? "Valid ads.txt & Publisher ID" : adsTxtCheck.verdict,
    evidence: adsTxtCheck.evidence,
    severity: "HIGH",
    recommendedFix: adsTxtCheck.fix,
    validationResult: adsTxtCheck.verdict
  });

  const isHttps = input.advertisingAndTechnical.siteUrl.startsWith("https://");
  const crawlerAllowed = input.advertisingAndTechnical.allowsMediapartnersGoogleCrawler !== false;
  const hasConsent = Boolean(input.advertisingAndTechnical.hasCmpConsentBannerConfigured);

  items.push({
    id: "ADSENSE_TECHNICAL_CRAWLER_AND_CONSENT",
    layer: "ADSENSE_POLICY",
    requirement:
      "HTTPS security, Mediapartners-Google crawler accessibility, and user privacy/cookie consent (CMP) readiness",
    currentStatus:
      isHttps && crawlerAllowed && hasConsent
        ? "HTTPS, AdSense crawler, and consent banner verified"
        : "Incomplete technical advertising setup",
    evidence: `HTTPS: ${isHttps}; Mediapartners-Google allowed: ${crawlerAllowed}; CMP Consent configured: ${hasConsent}`,
    severity: "HIGH",
    recommendedFix:
      !isHttps || !crawlerAllowed
        ? "Serve site over HTTPS and allow Mediapartners-Google in robots.txt"
        : !hasConsent
        ? "Configure a Google-certified Consent Management Platform (CMP) for EEA/UK/US privacy compliance"
        : null,
    validationResult: !isHttps || !crawlerAllowed ? "FAIL" : !hasConsent ? "WARNING" : "PASS"
  });

  const summary = {
    pass: items.filter((i) => i.validationResult === "PASS").length,
    warning: items.filter((i) => i.validationResult === "WARNING").length,
    fail: items.filter((i) => i.validationResult === "FAIL").length,
    notVerified: items.filter((i) => i.validationResult === "NOT_VERIFIED").length
  };

  let overallVerdict: ComplianceAuditVerdict = "PASS";
  if (summary.fail > 0) overallVerdict = "FAIL";
  else if (summary.warning > 0) overallVerdict = "WARNING";
  else if (summary.notVerified > 0) overallVerdict = "NOT_VERIFIED";

  return {
    websiteId: input.websiteId,
    overallVerdict,
    adSenseReady: summary.fail === 0 && summary.notVerified === 0,
    disclaimer:
      "AdSense Compliance Engine evaluates technical and editorial adherence to published Google Publisher Policies and AdSense Program Policies. It never guarantees AdSense account approval or ad earnings.",
    summary,
    items,
    evaluatedAt: new Date().toISOString()
  };
}

