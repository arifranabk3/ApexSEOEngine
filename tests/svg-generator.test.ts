import { describe, it, expect } from "vitest";
import { sanitizeSvg } from "@/services/media/svg-sanitizer";
import { DeterministicSvgEngine } from "@/services/media/svg-engine";

describe("Phase 02.1-E: SVG Security Sanitizer Suite", () => {
  it("allows safe, well-formed SVG without scripts or event handlers", () => {
    const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad1)"/>
      <circle cx="50" cy="50" r="25" fill="#10b981"/>
      <text x="50" y="55" font-family="sans-serif" font-size="14" fill="#ffffff" text-anchor="middle">SAFE</text>
    </svg>`;

    const res = sanitizeSvg(safeSvg);
    expect(res.isValid).toBe(true);
    expect(res.violations).toHaveLength(0);
    expect(res.sanitizedSvg).toContain("<svg");
  });

  it("blocks inline <script> tags", () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="blue"/>
      <script>alert(document.cookie);</script>
    </svg>`;

    const res = sanitizeSvg(maliciousSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("script"))).toBe(true);
  });

  it("blocks onload, onerror and other JavaScript event handlers", () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)">
      <circle cx="50" cy="50" r="25" fill="red" onclick="fetch('https://evil.com')"/>
    </svg>`;

    const res = sanitizeSvg(maliciousSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("Event handler attribute") || v.includes("Blocked hazardous"))).toBe(true);
  });

  it("blocks foreignObject escaping to HTML", () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <foreignObject width="100" height="100">
        <body xmlns="http://www.w3.org/1999/xhtml">
          <iframe src="javascript:alert(1)"></iframe>
        </body>
      </foreignObject>
    </svg>`;

    const res = sanitizeSvg(maliciousSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("foreignobject") || v.includes("Blocked hazardous"))).toBe(true);
  });

  it("blocks javascript: pseudo-protocols in links or attributes", () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <a href="javascript:alert('xss')">
        <text x="10" y="20">Click me</text>
      </a>
    </svg>`;

    const res = sanitizeSvg(maliciousSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("javascript"))).toBe(true);
  });

  it("blocks external resource fetches via external URLs", () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <image href="https://attacker.com/cookie-stealer.png" width="10" height="10"/>
    </svg>`;

    const res = sanitizeSvg(maliciousSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("Blocked hazardous"))).toBe(true);
  });

  it("blocks CSS @import and external url() in stylesheets", () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <style>
        @import url('https://evil.com/leak.css');
        .leak { background: url('https://evil.com/beacon'); }
      </style>
      <rect width="100" height="100" class="leak"/>
    </svg>`;

    const res = sanitizeSvg(maliciousSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("@import") || v.includes("url"))).toBe(true);
  });

  it("blocks malformed XML and mismatched closing tags", () => {
    const malformedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g>
        <rect width="50" height="50" fill="red"/>
      </svg>
    </g>`;

    const res = sanitizeSvg(malformedSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("XML Structural Validation Error"))).toBe(true);
  });

  it("verifies proper LIFO stack handling for deeply nested elements", () => {
    const deeplyNestedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <lineargradient id="g1">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="100%" stop-color="#000"/>
        </lineargradient>
      </defs>
      <g id="parent">
        <g id="child">
          <rect width="50" height="50"/>
          <circle cx="25" cy="25" r="10"/>
        </g>
      </g>
    </svg>`;

    const res = sanitizeSvg(deeplyNestedSvg);
    expect(res.isValid).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it("blocks unclosed tags remaining on LIFO stack", () => {
    const unclosedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g>
        <rect width="50" height="50"/>
    </svg>`;

    const res = sanitizeSvg(unclosedSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("Mismatched closing tag </svg>, expected </g>"))).toBe(true);
  });

  it("detects trailing unclosed root element", () => {
    const unclosedRootSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="50" height="50"/>`;

    const res = sanitizeSvg(unclosedRootSvg);
    expect(res.isValid).toBe(false);
    expect(res.violations.some((v) => v.includes("SVG must be a root <svg>") || v.includes("Unclosed SVG tags remaining"))).toBe(true);
  });
});

describe("Phase 02.1-E: Deterministic SVG Engine Template Generation", () => {
  const engine = new DeterministicSvgEngine();

  it("generates a valid FEATURED_HERO SVG with correct dimensions, alt text, and metadata", () => {
    const asset = engine.generate({
      title: "Self-Hosted Ollama AI Blog Engine",
      categoryName: "ENTERPRISE TECHNICAL ARCHITECTURE",
      focusKeyword: "self-hosted ollama",
      templateType: "FEATURED_HERO"
    });

    expect(asset.width).toBe(1200);
    expect(asset.height).toBe(630);
    expect(asset.filename).toBe("self-hosted-ollama-ai-blog-engine-featured.svg");
    expect(asset.altText).toContain("Featured illustration for Self-Hosted Ollama AI Blog Engine");
    expect(asset.svgContent).toContain("<svg");
    expect(asset.svgContent).toContain("</svg>");
    expect(asset.svgContent).toContain("VERCEL");
    expect(asset.svgContent).toContain("OLLAMA");

    const security = sanitizeSvg(asset.svgContent);
    expect(security.isValid).toBe(true);
  });

  it("generates a TECHNICAL_ARCHITECTURE schematic diagram", () => {
    const asset = engine.generate({
      title: "Next.js & Ollama Isolated Worker Pipeline",
      templateType: "TECHNICAL_ARCHITECTURE",
      diagramNodes: [
        { label: "Frontend", subtext: "Next.js Vercel" },
        { label: "Database", subtext: "PostgreSQL Prisma" },
        { label: "Queue", subtext: "DurableJob" },
        { label: "AI Inference", subtext: "Llama 3.2 Ollama" }
      ]
    });

    expect(asset.width).toBe(1200);
    expect(asset.height).toBe(630);
    expect(asset.templateType).toBe("TECHNICAL_ARCHITECTURE");
    expect(asset.svgContent).toContain("Next.js Vercel");
    expect(asset.svgContent).toContain("FIGURE 1");

    const security = sanitizeSvg(asset.svgContent);
    expect(security.isValid).toBe(true);
  });

  it("generates a CORE_WEB_VITALS audit diagram with official Google thresholds and labeled internal targets", () => {
    const asset = engine.generate({
      title: "Self-Hosted Blog Performance",
      templateType: "CORE_WEB_VITALS"
    });

    expect(asset.width).toBe(1200);
    expect(asset.height).toBe(630);
    // Official Google thresholds
    expect(asset.svgContent).toContain("LCP (GOOD &le; 2.5s)");
    expect(asset.svgContent).toContain("INP (GOOD &le; 200ms)");
    expect(asset.svgContent).toContain("CLS (GOOD &le; 0.1)");
    // Clearly labeled internal targets
    expect(asset.svgContent).toContain("Internal Target: 1.2s (Good &le; 2.5s)");
    expect(asset.svgContent).toContain("Internal Target: 48ms (Good &le; 200ms)");
    expect(asset.svgContent).toContain("Internal Target: 0.00 (Good &le; 0.1)");

    const security = sanitizeSvg(asset.svgContent);
    expect(security.isValid).toBe(true);
  });
});
