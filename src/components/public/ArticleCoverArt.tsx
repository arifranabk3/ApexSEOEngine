import React from "react";

export function ArticleCoverArt({
  slug,
  categoryName,
  seoScore,
  variant = "card"
}: {
  slug: string;
  categoryName?: string | null;
  seoScore?: number;
  variant?: "hero" | "card";
}) {
  const isAdSense =
    slug.includes("adsense") ||
    (categoryName || "").toLowerCase().includes("adsense") ||
    (categoryName || "").toLowerCase().includes("publisher");
  const isCwv =
    slug.includes("core-web-vitals") || slug.includes("json-ld");

  const gradientClass = isAdSense
    ? "from-emerald-950 via-teal-950 to-slate-950 border-emerald-500/25"
    : isCwv
      ? "from-indigo-950 via-violet-950 to-slate-950 border-indigo-500/25"
      : "from-cyan-950 via-blue-950 to-slate-950 border-cyan-500/25";

  const accentBadge = isAdSense
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
    : isCwv
      ? "bg-violet-500/20 text-violet-300 border-violet-400/30"
      : "bg-cyan-500/20 text-cyan-300 border-cyan-400/30";

  return (
    <div
      className={`media relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradientClass} border apex-grid-pattern flex flex-col justify-between p-5 select-none ${
        variant === "hero" ? "min-h-[240px] lg:min-h-[280px]" : "min-h-[168px]"
      }`}
    >
      {/* Ambient Radial Glows */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-2xl ${
          isAdSense
            ? "bg-emerald-500/25"
            : isCwv
              ? "bg-violet-500/25"
              : "bg-cyan-500/25"
        }`}
      />

      {/* Top Blueprint Telemetry Row */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${accentBadge}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          {isAdSense
            ? "PUBLISHER POLICY GATE"
            : isCwv
              ? "CWV & JSON-LD SCHEMA"
              : "POSTGRESQL 16 + OLLAMA"}
        </span>
        {typeof seoScore === "number" && (
          <span className="px-2.5 py-1 rounded-full bg-slate-950/80 border border-white/10 text-[10px] font-mono font-bold text-emerald-400">
            GATE {seoScore}/100
          </span>
        )}
      </div>

      {/* Center Vector Schematic Illustration */}
      <div className="relative z-10 my-3 flex items-center justify-center">
        <svg
          viewBox="0 0 360 90"
          className="w-full max-w-[320px] h-auto opacity-90"
          role="img"
          aria-label={`${categoryName || "Technical Architecture"} schematic`}
        >
          <defs>
            <linearGradient id={`grad-${slug}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {/* Connection Lines */}
          <path
            d="M 55 45 L 145 45 M 215 45 L 305 45"
            stroke={`url(#grad-${slug})`}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          {/* Node 1 */}
          <rect
            x="10"
            y="22"
            width="75"
            height="46"
            rx="10"
            fill="rgba(15, 23, 42, 0.88)"
            stroke="rgba(56, 189, 248, 0.5)"
            strokeWidth="1.5"
          />
          <text
            x="47"
            y="43"
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {isAdSense ? "TRUST" : isCwv ? "DOM HTML" : "POSTGRES"}
          </text>
          <text
            x="47"
            y="56"
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="8"
            fontFamily="monospace"
          >
            {isAdSense ? "ads.txt" : isCwv ? "LCP / CLS" : "21 Models"}
          </text>

          {/* Node 2 (Center Gate) */}
          <rect
            x="132"
            y="16"
            width="96"
            height="58"
            rx="12"
            fill="rgba(15, 23, 42, 0.95)"
            stroke="rgba(129, 140, 248, 0.65)"
            strokeWidth="1.75"
          />
          <text
            x="180"
            y="41"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9.5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {isAdSense ? "ADSENSE GATE" : isCwv ? "SCHEMA PARITY" : "DURABLE QUEUE"}
          </text>
          <text
            x="180"
            y="56"
            textAnchor="middle"
            fill="#a5b4fc"
            fontSize="8"
            fontFamily="monospace"
          >
            {isAdSense ? "IVT + E-E-A-T" : isCwv ? "JSON-LD Match" : "HMAC Worker"}
          </text>

          {/* Node 3 */}
          <rect
            x="275"
            y="22"
            width="75"
            height="46"
            rx="10"
            fill="rgba(15, 23, 42, 0.88)"
            stroke="rgba(52, 211, 153, 0.55)"
            strokeWidth="1.5"
          />
          <text
            x="312"
            y="43"
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            VERCEL
          </text>
          <text
            x="312"
            y="56"
            textAnchor="middle"
            fill="#34d399"
            fontSize="8"
            fontFamily="monospace"
          >
            PUBLISHED
          </text>
        </svg>
      </div>

      {/* Bottom Caption Strip */}
      <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-slate-300/80 border-t border-white/10 pt-2.5">
        <span>ARCH // {slug.slice(0, 24).toUpperCase()}</span>
        <span className="text-cyan-300">VERIFIED V1.0</span>
      </div>
    </div>
  );
}

