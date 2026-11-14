/**
 * Safe URL & SSRF Protection Utility for External Source Validation.
 * Blocks private, link-local, loopback, cloud metadata endpoints, and non-HTTP protocols.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // AWS/GCP/Azure instance metadata
  "metadata.google.internal",
  "instance-data"
]);

export interface SafeUrlValidationResult {
  isSafe: boolean;
  normalizedUrl?: string;
  reason?: string;
}

/**
 * Validates whether a URL is safe to reference or access without SSRF risks.
 */
export function validateSafeExternalUrl(inputUrl: string): SafeUrlValidationResult {
  if (!inputUrl || typeof inputUrl !== "string") {
    return { isSafe: false, reason: "Empty or invalid URL input." };
  }

  const trimmed = inputUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { isSafe: false, reason: "Malformed URL syntax." };
  }

  // 1. Enforce HTTP/HTTPS only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isSafe: false,
      reason: `Disallowed protocol '${parsed.protocol}'. Only http: and https: are allowed.`
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject credentials in URL (e.g., http://user:pass@host)
  if (parsed.username || parsed.password) {
    return { isSafe: false, reason: "Credentials in URL are strictly prohibited." };
  }

  // 3. Block known loopback and internal hostname strings
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { isSafe: false, reason: `Access to internal host '${hostname}' is blocked.` };
  }

  // 4. Validate IPv4 address ranges (private & special-purpose RFC 1918, RFC 3927, RFC 5737)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = hostname.match(ipv4Regex);
  if (ipMatch) {
    const octets = [
      parseInt(ipMatch[1], 10),
      parseInt(ipMatch[2], 10),
      parseInt(ipMatch[3], 10),
      parseInt(ipMatch[4], 10)
    ];

    if (octets.some((o) => o < 0 || o > 255)) {
      return { isSafe: false, reason: "Invalid IPv4 octet range." };
    }

    // 127.0.0.0/8 (Loopback)
    if (octets[0] === 127) {
      return { isSafe: false, reason: "Access to loopback IP address range is blocked." };
    }
    // 10.0.0.0/8 (Private)
    if (octets[0] === 10) {
      return { isSafe: false, reason: "Access to private IP range (10.0.0.0/8) is blocked." };
    }
    // 172.16.0.0/12 (Private)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return { isSafe: false, reason: "Access to private IP range (172.16.0.0/12) is blocked." };
    }
    // 192.168.0.0/16 (Private)
    if (octets[0] === 192 && octets[1] === 168) {
      return { isSafe: false, reason: "Access to private IP range (192.168.0.0/16) is blocked." };
    }
    // 169.254.0.0/16 (Link-Local / Cloud metadata)
    if (octets[0] === 169 && octets[1] === 254) {
      return { isSafe: false, reason: "Access to link-local IP range (169.254.0.0/16) is blocked." };
    }
    // 0.0.0.0/8 (Broadcast/Current network)
    if (octets[0] === 0) {
      return { isSafe: false, reason: "Access to 0.0.0.0/8 is blocked." };
    }
  }

  // 5. Block standard IPv6 private addresses
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const inner = hostname.slice(1, -1).toLowerCase();
    if (inner === "::1" || inner.startsWith("fe80:") || inner.startsWith("fc00:") || inner.startsWith("fd00:")) {
      return { isSafe: false, reason: "Access to local/private IPv6 address is blocked." };
    }
  }

  // 6. Block non-standard or dangerous ports
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443" && parsed.port !== "") {
    return { isSafe: false, reason: `Port ${parsed.port} is not permitted. Only ports 80 and 443 are allowed.` };
  }

  return { isSafe: true, normalizedUrl: parsed.toString() };
}
