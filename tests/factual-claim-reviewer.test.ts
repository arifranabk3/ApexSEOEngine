import { describe, it, expect } from "vitest";
import { validateSafeExternalUrl } from "@/services/seo/safe-url-validator";
import { reviewArticleFactualClaims } from "@/services/seo/factual-claim-reviewer";
import { FactualReviewInput } from "@/services/seo/factual-claim-schemas";

describe("Phase 02.1-F3: Factual Claim & Source Review Engine", () => {
  describe("SSRF & Safe URL Validation", () => {
    it("allows valid public HTTPS URLs", () => {
      const result = validateSafeExternalUrl("https://example.com/research-paper.pdf");
      expect(result.isSafe).toBe(true);
      expect(result.normalizedUrl).toBe("https://example.com/research-paper.pdf");
    });

    it("blocks localhost, loopback and 127.0.0.1", () => {
      expect(validateSafeExternalUrl("http://localhost:3000/secret").isSafe).toBe(false);
      expect(validateSafeExternalUrl("http://127.0.0.1/admin").isSafe).toBe(false);
      expect(validateSafeExternalUrl("http://127.0.0.2:80").isSafe).toBe(false);
    });

    it("blocks cloud metadata service IP (169.254.169.254)", () => {
      const result = validateSafeExternalUrl("http://169.254.169.254/latest/meta-data/");
      expect(result.isSafe).toBe(false);
      expect(result.reason).toContain("blocked");
    });

    it("blocks private RFC 1918 subnets (10.x, 172.16.x, 192.168.x)", () => {
      expect(validateSafeExternalUrl("http://10.0.0.1/status").isSafe).toBe(false);
      expect(validateSafeExternalUrl("http://172.16.0.5/api").isSafe).toBe(false);
      expect(validateSafeExternalUrl("http://192.168.1.1/router").isSafe).toBe(false);
    });

    it("blocks non-HTTP protocols and credential embedding", () => {
      expect(validateSafeExternalUrl("ftp://files.example.com").isSafe).toBe(false);
      expect(validateSafeExternalUrl("file:///etc/passwd").isSafe).toBe(false);
      expect(validateSafeExternalUrl("https://user:password@example.com").isSafe).toBe(false);
      expect(validateSafeExternalUrl("https://example.com:8443").isSafe).toBe(false);
    });
  });

  describe("Claim Extraction & Risk Categorization", () => {
    it("extracts statistical, numerical and percentage claims", () => {
      const sampleText = `
# Performance Evaluation
In our benchmark tests, response latency decreased by 42% after enabling Redis caching.
The database cluster handles 12,500 queries per second with high reliability.
      `;

      const report = reviewArticleFactualClaims({
        title: "Redis Performance Guide",
        content: sampleText
      });

      expect(report.summary.totalClaims).toBeGreaterThanOrEqual(2);
      const statClaims = report.claims.filter((c) => c.category === "STATISTICAL_NUMERICAL");
      expect(statClaims.length).toBeGreaterThanOrEqual(1);
      expect(statClaims[0].riskLevel).toBe("HIGH");
      expect(statClaims[0].requiresHumanReview).toBe(true);
    });

    it("classifies health and safety claims as CRITICAL risk", () => {
      const sampleText = `
## Health Advisory
This supplement cures chronic arthritis and eliminates joint disease symptoms within two weeks.
Always verify clinical dosage before administration.
      `;

      const report = reviewArticleFactualClaims({
        title: "Medical Supplement Review",
        content: sampleText
      });

      const criticalClaims = report.claims.filter((c) => c.riskLevel === "CRITICAL");
      expect(criticalClaims.length).toBeGreaterThanOrEqual(1);
      expect(criticalClaims[0].category).toBe("HEALTH_SAFETY");
      expect(criticalClaims[0].recommendedAction).toContain("MANDATORY EDITORIAL ACTION");
    });

    it("classifies financial and commercial claims accurately", () => {
      const sampleText = `
## Pricing Overview
Implementing this solution saves $45,000 in cloud server costs each year and boosts revenue significantly.
      `;

      const report = reviewArticleFactualClaims({
        title: "Cloud Infrastructure Cost Analysis",
        content: sampleText
      });

      const finClaim = report.claims.find((c) => c.category === "FINANCIAL");
      expect(finClaim).toBeDefined();
      expect(finClaim?.riskLevel).toBe("HIGH");
    });

    it("extracts historical dates and technical benchmarks", () => {
      const sampleText = `
## Architecture History
Founded in 2015, the project adopted open standards across all network ingress points.
In October 2023, the core team released version 2.0.
      `;

      const report = reviewArticleFactualClaims({
        title: "System Architecture",
        content: sampleText
      });

      const dateClaim = report.claims.find((c) => c.category === "DATES_HISTORICAL");
      expect(dateClaim).toBeDefined();
      expect(dateClaim?.riskLevel).toBe("MEDIUM");
    });

    it("marks claims UNVERIFIED if no corroborated primary source is accessible", () => {
      const sampleText = `
## Cloud Adoption
Over 87% of Fortune 500 enterprises have migrated to local Ollama AI pipelines.
      `;

      const report = reviewArticleFactualClaims({
        title: "AI Trends",
        content: sampleText
      });

      expect(report.claims.length).toBe(1);
      expect(report.claims[0].verificationStatus).toBe("UNVERIFIED");
      expect(report.claims[0].hasCitation).toBe(false);
      expect(report.summary.readyForPublishing).toBe(false);
    });

    it("handles embedded markdown links and checks safe URL compliance", () => {
      const sampleText = `
## Verified Benchmarks
According to [Official Mozilla Docs](https://developer.mozilla.org/en-US/docs/Web), modern browsers enforce strict CSP headers.
Meanwhile, internal metrics on [Dev Server](http://127.0.0.1:8080/metrics) show high latency.
      `;

      const report = reviewArticleFactualClaims({
        title: "Web Security Overview",
        content: sampleText
      });

      expect(report.claims.length).toBeGreaterThanOrEqual(1);
      // The claim containing 127.0.0.1 link must have evaluated source with REJECTED_UNSAFE
      const rejectedEval = report.claims
        .flatMap((c) => c.evaluatedSources)
        .find((s) => s.authorityAssessment === "REJECTED_UNSAFE");
      expect(rejectedEval).toBeDefined();
    });

    it("enforces mandatory editorial disclaimer on all review summaries", () => {
      const report = reviewArticleFactualClaims({
        title: "Test Article",
        content: "Apex SEO Engine delivers automated publishing pipelines."
      });

      expect(report.summary.mandatoryDisclaimer).toContain(
        "LLM output does not constitute factual proof"
      );
    });
  });
});
