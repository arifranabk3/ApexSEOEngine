import {
  evaluateGoogleSearchComplianceGate,
  FullComplianceAuditInput
} from "./seo-quality-gate";
import {
  evaluateAdSenseCompliance,
  AdSenseFullAuditInput,
  EvidenceAuditItem
} from "./adsense-compliance-engine";

export type PublishingLifecycleState =
  | "DRAFT"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "PUBLISHED";

export interface ContentPublishingGateInput {
  articleId: string;
  websiteId: string;
  currentState: PublishingLifecycleState;
  requestedState: PublishingLifecycleState;
  requireHumanApproval: boolean;
  humanApprovedByUserId?: string | null;
  isYmylTopic: boolean;
  qualifiedHumanReviewerName?: string | null;
  searchAuditInput: FullComplianceAuditInput;
  adSenseAuditInput: AdSenseFullAuditInput;
}

export interface ContentPublishingGateDecision {
  articleId: string;
  websiteId: string;
  previousState: PublishingLifecycleState;
  resultingState: PublishingLifecycleState;
  transitionAllowed: boolean;
  blockReasons: string[];
  auditSummary: {
    googleSearchCompliance: "PASS" | "WARNING" | "FAIL";
    adSenseContentPolicy: "PASS" | "WARNING" | "FAIL" | "NOT_VERIFIED";
    technicalSeo: "PASS" | "WARNING" | "FAIL";
    factualAccuracy: "PASS" | "WARNING" | "FAIL";
    copyrightCompliance: "PASS" | "WARNING" | "FAIL";
    internalLinkValidation: "PASS" | "WARNING" | "FAIL";
    imageValidation: "PASS" | "WARNING" | "FAIL";
  };
  blockingAuditItems: EvidenceAuditItem[];
  evaluatedAt: string;
}

/**
 * Module 5: 4-State Content Publishing Gate (DRAFT -> NEEDS_REVIEW -> APPROVED -> PUBLISHED).
 * Runs all 7 mandatory pre-publish audits (Google Search, AdSense Content, Technical SEO,
 * Factual Accuracy, Copyright, Internal Links, Image Validation) and enforces human review on YMYL topics.
 */
export function evaluateContentPublishingTransition(
  input: ContentPublishingGateInput
): ContentPublishingGateDecision {
  const searchReport = evaluateGoogleSearchComplianceGate(input.searchAuditInput);
  const adSenseReport = evaluateAdSenseCompliance(input.adSenseAuditInput);

  const findSearchStatus = (id: string): "PASS" | "WARNING" | "FAIL" => {
    const item = searchReport.allResults.find((r) => r.id === id);
    if (!item) return "PASS";
    return item.status === "BLOCKED" ? "FAIL" : item.status;
  };

  const findAdSenseStatus = (id: string): "PASS" | "WARNING" | "FAIL" | "NOT_VERIFIED" => {
    const item = adSenseReport.items.find((r) => r.id === id);
    return item ? item.validationResult : "PASS";
  };

  const techSeoFailures = searchReport.allResults.filter(
    (r) => r.module === "TECHNICAL_SEO" && r.status === "BLOCKED"
  );
  const technicalSeoStatus: "PASS" | "WARNING" | "FAIL" =
    techSeoFailures.length > 0 ? "FAIL" : "PASS";

  const factualStatus = findSearchStatus("QUALITY_FACTUAL_SOURCES");
  const copyrightStatus =
    findAdSenseStatus("ADSENSE_COPYRIGHT_AND_UGC") === "FAIL" ? "FAIL" : "PASS";
  const internalLinkStatus =
    findSearchStatus("TECH_BROKEN_LINKS") === "FAIL"
      ? "FAIL"
      : findSearchStatus("ONPAGE_LINKS_AND_REFERENCES");
  const imageStatus = findSearchStatus("ONPAGE_IMAGE_ALT");

  const adSenseContentFailures = adSenseReport.items.filter(
    (i) =>
      (i.id === "ADSENSE_PROHIBITED_RESTRICTED_CONTENT" ||
        i.id === "ADSENSE_COPYRIGHT_AND_UGC" ||
        i.id === "ADSENSE_INVALID_TRAFFIC_AND_PLACEMENT") &&
      i.validationResult === "FAIL"
  );

  const blockReasons: string[] = [];
  const blockingAuditItems: EvidenceAuditItem[] = [];

  for (const b of searchReport.blockingIssues) {
    blockReasons.push(`[Google Search / ${b.module}] ${b.outstandingIssue || b.requirement}`);
    blockingAuditItems.push({
      id: b.id,
      layer: "GOOGLE_SEARCH",
      requirement: b.requirement,
      currentStatus: "BLOCKED",
      evidence: b.evidence,
      severity: "CRITICAL",
      recommendedFix: b.recommendedFix,
      validationResult: "FAIL"
    });
  }

  for (const a of adSenseContentFailures) {
    blockReasons.push(`[AdSense Policy] ${a.currentStatus}`);
    blockingAuditItems.push(a);
  }

  // Enforce YMYL Human Review
  if (
    input.isYmylTopic &&
    (input.requestedState === "APPROVED" || input.requestedState === "PUBLISHED")
  ) {
    if (!input.qualifiedHumanReviewerName || !input.humanApprovedByUserId) {
      blockReasons.push(
        "[YMYL Safeguard] YMYL topic requires explicit qualified human review and approval before entering APPROVED or PUBLISHED state."
      );
    }
  }

  // Enforce Configurable Human Approval Gate
  if (
    input.requireHumanApproval &&
    input.requestedState === "PUBLISHED" &&
    !input.humanApprovedByUserId
  ) {
    blockReasons.push(
      "[Human Approval Gate] Website policy requires human editorial sign-off before transitioning to PUBLISHED."
    );
  }

  // Determine resulting state
  let transitionAllowed = true;
  let resultingState: PublishingLifecycleState = input.requestedState;

  if (
    (input.requestedState === "APPROVED" || input.requestedState === "PUBLISHED") &&
    blockReasons.length > 0
  ) {
    transitionAllowed = false;
    resultingState = "NEEDS_REVIEW";
  }

  return {
    articleId: input.articleId,
    websiteId: input.websiteId,
    previousState: input.currentState,
    resultingState,
    transitionAllowed,
    blockReasons,
    auditSummary: {
      googleSearchCompliance:
        searchReport.overallGateStatus === "BLOCKED"
          ? "FAIL"
          : searchReport.overallGateStatus,
      adSenseContentPolicy:
        adSenseContentFailures.length > 0 ? "FAIL" : adSenseReport.overallVerdict,
      technicalSeo: technicalSeoStatus,
      factualAccuracy: factualStatus,
      copyrightCompliance: copyrightStatus,
      internalLinkValidation: internalLinkStatus,
      imageValidation: imageStatus
    },
    blockingAuditItems,
    evaluatedAt: new Date().toISOString()
  };
}

