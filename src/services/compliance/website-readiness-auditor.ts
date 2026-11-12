import {
  ComplianceAuditVerdict,
  EvidenceAuditItem,
  evaluateAdSenseCompliance,
  AdSenseFullAuditInput
} from "./adsense-compliance-engine";
import {
  evaluateGoogleSearchComplianceGate,
  FullComplianceAuditInput
} from "./seo-quality-gate";

export interface WebsiteReadinessAuditInput {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  publishedOriginalArticleCount: number;
  categoryCount: number;
  brokenPageCount: number;
  searchComplianceInput: FullComplianceAuditInput;
  adSenseComplianceInput: AdSenseFullAuditInput;
}

export interface WebsiteReadinessReport {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  searchComplianceVerdict: ComplianceAuditVerdict;
  adSenseComplianceVerdict: ComplianceAuditVerdict;
  readyForAdSenseApplication: boolean;
  readyForOrganicSearchIndexation: boolean;
  disclaimer: string;
  auditMatrix: EvidenceAuditItem[];
  evaluatedAt: string;
}

/**
 * Module 4: Full Pre-Application Website Readiness Auditor.
 * Enforces the Final CTO Rule: Google Search compliance and AdSense compliance are evaluated
 * as independent, mandatory validation layers. A website can pass Technical SEO while failing
 * AdSense publisher requirements, or be AdSense-ready while having search performance warnings.
 */
export function evaluateWebsiteReadiness(
  input: WebsiteReadinessAuditInput
): WebsiteReadinessReport {
  const searchGate = evaluateGoogleSearchComplianceGate(input.searchComplianceInput);
  const adSenseReport = evaluateAdSenseCompliance(input.adSenseComplianceInput);

  const searchVerdict: ComplianceAuditVerdict =
    searchGate.overallGateStatus === "BLOCKED"
      ? "FAIL"
      : searchGate.overallGateStatus === "WARNING"
      ? "WARNING"
      : "PASS";

  const structuralItems: EvidenceAuditItem[] = [
    {
      id: "READINESS_CONTENT_DEPTH_AND_CATEGORIES",
      layer: "WEBSITE_READINESS",
      requirement:
        "Substantial library of original, published articles organized into clear topical categories",
      currentStatus: `${input.publishedOriginalArticleCount} published article(s) across ${input.categoryCount} category(ies)`,
      evidence: `publishedOriginalArticleCount=${input.publishedOriginalArticleCount}, categoryCount=${input.categoryCount}`,
      severity: "HIGH",
      recommendedFix:
        input.publishedOriginalArticleCount >= 10 && input.categoryCount >= 2
          ? null
          : "Publish a substantive base of original, helpful articles organized into logical categories before submitting an AdSense application",
      validationResult:
        input.publishedOriginalArticleCount >= 10 && input.categoryCount >= 2
          ? "PASS"
          : input.publishedOriginalArticleCount >= 3
          ? "WARNING"
          : "FAIL"
    },
    {
      id: "READINESS_ZERO_BROKEN_PAGES",
      layer: "WEBSITE_READINESS",
      requirement: "Zero broken pages, under-construction placeholders, or dead navigation links",
      currentStatus:
        input.brokenPageCount === 0
          ? "0 broken pages detected"
          : `${input.brokenPageCount} broken or placeholder page(s) detected`,
      evidence: `brokenPageCount=${input.brokenPageCount}`,
      severity: "CRITICAL",
      recommendedFix:
        input.brokenPageCount === 0
          ? null
          : "Fix or remove all broken links and 'under construction' placeholder pages prior to review",
      validationResult: input.brokenPageCount === 0 ? "PASS" : "FAIL"
    }
  ];

  const mappedSearchItems: EvidenceAuditItem[] = searchGate.allResults.map((r) => ({
    id: r.id,
    layer:
      r.module === "TECHNICAL_SEO"
        ? "TECHNICAL_SEO"
        : r.module === "CONTENT_QUALITY"
        ? "CONTENT_QUALITY"
        : "GOOGLE_SEARCH",
    requirement: r.requirement,
    currentStatus: r.status,
    evidence: r.evidence,
    severity: r.status === "BLOCKED" ? "CRITICAL" : "MEDIUM",
    recommendedFix: r.recommendedFix,
    validationResult:
      r.status === "BLOCKED" ? "FAIL" : r.status === "WARNING" ? "WARNING" : "PASS"
  }));

  const auditMatrix = [
    ...structuralItems,
    ...adSenseReport.items,
    ...mappedSearchItems
  ];

  const hasStructuralFail = structuralItems.some((i) => i.validationResult === "FAIL");
  const readyForAdSenseApplication =
    adSenseReport.overallVerdict === "PASS" && !hasStructuralFail;
  const readyForOrganicSearchIndexation = searchVerdict !== "FAIL" && input.brokenPageCount === 0;

  return {
    websiteId: input.websiteId,
    websiteName: input.websiteName,
    websiteUrl: input.websiteUrl,
    searchComplianceVerdict: searchVerdict,
    adSenseComplianceVerdict: adSenseReport.overallVerdict,
    readyForAdSenseApplication,
    readyForOrganicSearchIndexation,
    disclaimer:
      "Google Search compliance and Google AdSense compliance are independent layers. Passing internal readiness checks never guarantees Google Search ranking, indexing, AdSense account approval, or ad revenue.",
    auditMatrix,
    evaluatedAt: new Date().toISOString()
  };
}

