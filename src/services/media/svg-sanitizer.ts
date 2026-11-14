/**
 * Strict SVG Sanitizer & Multi-Layer Security Validator.
 * Implements Defense-in-Depth against Stored XSS, script injection, external entity resolution (XXE),
 * foreignObject escaping, CSS @import leaks, and unauthorized external fetches.
 */

// Permitted SVG elements (whitelist - all lowercase for case-insensitive matching)
const ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "rect",
  "circle",
  "ellipse",
  "path",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "title",
  "desc",
  "style" // Only checked scoped CSS rules
]);

// Permitted SVG attributes (whitelist - all lowercase for case-insensitive matching)
const ALLOWED_ATTRIBUTES = new Set([
  "xmlns",
  "viewbox",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-opacity",
  "fill-opacity",
  "opacity",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "text-anchor",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "dominant-baseline",
  "id",
  "class",
  "role",
  "aria-label",
  "offset",
  "stop-color",
  "stop-opacity"
]);

// Prohibited patterns, script indicators, and external vectors
const FORBIDDEN_PATTERNS = [
  /<\s*script/i,
  /<\s*iframe/i,
  /<\s*foreignobject/i,
  /<\s*embed/i,
  /<\s*object/i,
  /<\s*image/i,
  /<\s*use/i, // block xlink / use tag injection
  /<\s*animate/i,
  /<\s*set/i,
  /on\w+\s*=/i, // onload, onerror, onclick, etc.
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /data\s*:\s*application\/javascript/i,
  /xlink\s*:\s*href/i,
  /href\s*=\s*['"]\s*https?:/i,
  /<!ENTITY/i,
  /<!DOCTYPE/i,
  /url\s*\(\s*['"]?\s*https?:/i,
  /@import/i, // block CSS import exfiltration
  /-moz-binding/i,
  /expression\s*\(/i
];

export interface SvgSanitizationResult {
  isValid: boolean;
  sanitizedSvg: string;
  violations: string[];
}

/**
 * Validates structural tag balance and nest hierarchy using a LIFO (Last-In-First-Out) stack.
 * Returns true if all opened elements have corresponding closed elements in proper nested order.
 */
function validateXmlStructure(svg: string): { balanced: boolean; error?: string } {
  const stack: string[] = []; // LIFO call stack
  const tagRegex = /<\/?([a-zA-Z0-9:-]+)[^>]*(\/)?>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(svg)) !== null) {
    const fullTag = match[0];
    const rawName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith("</");
    const isSelfClosing = Boolean(match[2]) || fullTag.endsWith("/>");

    // Skip declaration / comments
    if (rawName.startsWith("?") || rawName.startsWith("!")) continue;

    if (isClosing) {
      if (stack.length === 0) {
        return { balanced: false, error: `Unexpected closing tag </${rawName}> with empty LIFO stack` };
      }
      const top = stack.pop(); // LIFO pop
      if (top !== rawName) {
        return { balanced: false, error: `Mismatched closing tag </${rawName}>, expected </${top}> from LIFO stack` };
      }
    } else if (!isSelfClosing) {
      stack.push(rawName); // LIFO push
    }
  }

  if (stack.length > 0) {
    return { balanced: false, error: `Unclosed SVG tags remaining on LIFO stack: ${stack.join(", ")}` };
  }

  return { balanced: true };
}

/**
 * Validates and sanitizes untrusted or generated SVG markup using multi-layer inspection.
 */
export function sanitizeSvg(rawSvg: string): SvgSanitizationResult {
  const violations: string[] = [];

  if (!rawSvg || typeof rawSvg !== "string") {
    return {
      isValid: false,
      sanitizedSvg: "",
      violations: ["SVG input must be a non-empty string"]
    };
  }

  // 1. Layer 1: Pattern and Exploit Heuristics
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(rawSvg)) {
      violations.push(`Blocked hazardous pattern detected: ${pattern.toString()}`);
    }
  }

  // 2. Layer 2: Root element check
  const trimmed = rawSvg.trim();
  if (!trimmed.startsWith("<svg") || !trimmed.endsWith("</svg>")) {
    violations.push("SVG must be a root <svg> element with a matching closing </svg> tag");
  }

  // 3. Layer 3: Structural XML Parse & Balance Check
  const structureCheck = validateXmlStructure(trimmed);
  if (!structureCheck.balanced) {
    violations.push(`XML Structural Validation Error: ${structureCheck.error}`);
  }

  // 4. Layer 4: Element and Attribute Whitelist Inspection
  const tagRegex = /<\/?([a-zA-Z0-9:-]+)([^>]*)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(rawSvg)) !== null) {
    const tagName = match[1].toLowerCase();
    const cleanTag = tagName.includes(":") ? tagName.split(":")[1] : tagName;

    if (!ALLOWED_ELEMENTS.has(cleanTag)) {
      violations.push(`Forbidden SVG tag '<${tagName}>' detected`);
    }

    const attrString = match[2];
    if (attrString) {
      const attrRegex = /([a-zA-Z0-9:-]+)\s*=\s*(['"][^'"]*['"]|[^\s>]+)/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrRegex.exec(attrString)) !== null) {
        const attrName = attrMatch[1].toLowerCase();
        const cleanAttr = attrName.includes(":") ? attrName.split(":")[1] : attrName;

        if (attrName.startsWith("on")) {
          violations.push(`Event handler attribute '${attrName}' is strictly prohibited`);
        } else if (!ALLOWED_ATTRIBUTES.has(cleanAttr) && !ALLOWED_ATTRIBUTES.has(attrName)) {
          violations.push(`Attribute '${attrName}' is not on the allowed SVG attributes whitelist`);
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      isValid: false,
      sanitizedSvg: "",
      violations
    };
  }

  // Clean XML comments and normalize whitespace
  const sanitizedSvg = trimmed
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  return {
    isValid: true,
    sanitizedSvg,
    violations: []
  };
}
