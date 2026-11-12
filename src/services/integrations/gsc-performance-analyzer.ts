export interface GscRawRow {
  pageUrl: string;
  query: string;
  date: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number; // percentage 0..100 or ratio 0..1
  position: number;
  isBenchmarkSimulation?: boolean;
}

export interface PagePeriodComparison {
  pageUrl: string;
  currentClicks: number;
  previousClicks: number;
  clickDelta: number;
  clickChangePct: number;
  currentImpressions: number;
  previousImpressions: number;
  impressionDelta: number;
  impressionChangePct: number;
  currentCtrPct: number;
  previousCtrPct: number;
  currentAvgPosition: number;
  previousAvgPosition: number;
}

export interface StrikingDistanceQuery {
  query: string;
  pageUrl: string;
  impressions: number;
  clicks: number;
  ctrPct: number;
  avgPosition: number;
  opportunityTier: "PAGE_1_BOTTOM (Pos 5-10)" | "STRIKING_DISTANCE (Pos 11-20)" | "PAGE_3_CANDIDATE (Pos 21-30)";
}

export interface NewSearchQueryDiscovery {
  query: string;
  pageUrl: string;
  currentImpressions: number;
  currentClicks: number;
  avgPosition: number;
}

export interface Gsc28DayComparisonReport {
  dataClassification: "VERIFIED_LIVE_GSC_DATA" | "BENCHMARK_SIMULATION_DATASET";
  window: {
    current28dStart: string;
    current28dEnd: string;
    previous28dStart: string;
    previous28dEnd: string;
  };
  totals: {
    currentClicks: number;
    previousClicks: number;
    currentImpressions: number;
    previousImpressions: number;
    currentCtrPct: number;
    previousCtrPct: number;
  };
  highImpressionLowCtrPages: PagePeriodComparison[];
  strikingDistanceKeywords: StrikingDistanceQuery[];
  pagesLosingClicks: PagePeriodComparison[];
  pagesGainingImpressions: PagePeriodComparison[];
  newSearchQueries: NewSearchQueryDiscovery[];
}

function normalizeCtrPct(clicks: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Number(((clicks / impressions) * 100).toFixed(2));
}

/**
 * Deterministic 28-day vs previous 28-day Google Search Console Performance Analyzer.
 * Strictly separates verified live GSC rows from benchmark simulation datasets.
 */
export function analyzeGsc28DayComparison(
  rows: GscRawRow[],
  referenceEndDateStr: string,
  dataClassification: "VERIFIED_LIVE_GSC_DATA" | "BENCHMARK_SIMULATION_DATASET" = "VERIFIED_LIVE_GSC_DATA"
): Gsc28DayComparisonReport {
  const refEnd = new Date(`${referenceEndDateStr}T23:59:59Z`);
  const dayMs = 86_400_000;

  const currentStart = new Date(refEnd.getTime() - 27 * dayMs);
  currentStart.setUTCHours(0, 0, 0, 0);

  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - 27 * dayMs);
  prevStart.setUTCHours(0, 0, 0, 0);

  const currentRows: GscRawRow[] = [];
  const previousRows: GscRawRow[] = [];

  for (const r of rows) {
    const dt = new Date(`${r.date}T12:00:00Z`);
    if (dt >= currentStart && dt <= refEnd) {
      currentRows.push(r);
    } else if (dt >= prevStart && dt <= prevEnd) {
      previousRows.push(r);
    }
  }

  // Group by pageUrl
  const pageMap = new Map<
    string,
    {
      currClicks: number;
      prevClicks: number;
      currImpr: number;
      prevImpr: number;
      currPosWeighted: number;
      prevPosWeighted: number;
    }
  >();

  for (const r of currentRows) {
    const entry = pageMap.get(r.pageUrl) || {
      currClicks: 0,
      prevClicks: 0,
      currImpr: 0,
      prevImpr: 0,
      currPosWeighted: 0,
      prevPosWeighted: 0
    };
    entry.currClicks += r.clicks;
    entry.currImpr += r.impressions;
    entry.currPosWeighted += r.position * r.impressions;
    pageMap.set(r.pageUrl, entry);
  }

  for (const r of previousRows) {
    const entry = pageMap.get(r.pageUrl) || {
      currClicks: 0,
      prevClicks: 0,
      currImpr: 0,
      prevImpr: 0,
      currPosWeighted: 0,
      prevPosWeighted: 0
    };
    entry.prevClicks += r.clicks;
    entry.prevImpr += r.impressions;
    entry.prevPosWeighted += r.position * r.impressions;
    pageMap.set(r.pageUrl, entry);
  }

  const pageComparisons: PagePeriodComparison[] = [];
  for (const [pageUrl, agg] of pageMap.entries()) {
    const clickDelta = agg.currClicks - agg.prevClicks;
    const clickChangePct =
      agg.prevClicks > 0
        ? Number(((clickDelta / agg.prevClicks) * 100).toFixed(1))
        : agg.currClicks > 0
        ? 100
        : 0;

    const impressionDelta = agg.currImpr - agg.prevImpr;
    const impressionChangePct =
      agg.prevImpr > 0
        ? Number(((impressionDelta / agg.prevImpr) * 100).toFixed(1))
        : agg.currImpr > 0
        ? 100
        : 0;

    pageComparisons.push({
      pageUrl,
      currentClicks: agg.currClicks,
      previousClicks: agg.prevClicks,
      clickDelta,
      clickChangePct,
      currentImpressions: agg.currImpr,
      previousImpressions: agg.prevImpr,
      impressionDelta,
      impressionChangePct,
      currentCtrPct: normalizeCtrPct(agg.currClicks, agg.currImpr),
      previousCtrPct: normalizeCtrPct(agg.prevClicks, agg.prevImpr),
      currentAvgPosition:
        agg.currImpr > 0 ? Number((agg.currPosWeighted / agg.currImpr).toFixed(1)) : 0,
      previousAvgPosition:
        agg.prevImpr > 0 ? Number((agg.prevPosWeighted / agg.prevImpr).toFixed(1)) : 0
    });
  }

  // 1. High Impression, Low CTR Pages (Impressions >= 500 and CTR < 2.5%)
  const highImpressionLowCtrPages = pageComparisons
    .filter((p) => p.currentImpressions >= 500 && p.currentCtrPct < 2.5)
    .sort((a, b) => b.currentImpressions - a.currentImpressions);

  // 2. Pages Losing Clicks (Click Delta < 0, sorted by largest drop)
  const pagesLosingClicks = pageComparisons
    .filter((p) => p.clickDelta < 0)
    .sort((a, b) => a.clickDelta - b.clickDelta);

  // 3. Pages Gaining Impressions (Impression Delta > 0, sorted by largest gain)
  const pagesGainingImpressions = pageComparisons
    .filter((p) => p.impressionDelta > 0)
    .sort((a, b) => b.impressionDelta - a.impressionDelta);

  // Group current & previous by Query
  const currentQueryMap = new Map<
    string,
    { pageUrl: string; clicks: number; impr: number; posWeighted: number }
  >();
  const previousQuerySet = new Set<string>();

  for (const r of previousRows) {
    if (r.impressions > 0) {
      previousQuerySet.add(r.query.toLowerCase());
    }
  }

  for (const r of currentRows) {
    const key = r.query.toLowerCase();
    const existing = currentQueryMap.get(key) || {
      pageUrl: r.pageUrl,
      clicks: 0,
      impr: 0,
      posWeighted: 0
    };
    existing.clicks += r.clicks;
    existing.impr += r.impressions;
    existing.posWeighted += r.position * r.impressions;
    currentQueryMap.set(key, existing);
  }

  // 4. Keywords Ranking Between Positions 5 and 30
  const strikingDistanceKeywords: StrikingDistanceQuery[] = [];
  // 5. New Search Queries (0 impressions in previous 28d, > 0 in current 28d)
  const newSearchQueries: NewSearchQueryDiscovery[] = [];

  for (const [query, qAgg] of currentQueryMap.entries()) {
    const avgPos = qAgg.impr > 0 ? Number((qAgg.posWeighted / qAgg.impr).toFixed(1)) : 0;
    const ctrPct = normalizeCtrPct(qAgg.clicks, qAgg.impr);

    if (avgPos >= 5.0 && avgPos <= 30.0) {
      let tier: StrikingDistanceQuery["opportunityTier"] = "STRIKING_DISTANCE (Pos 11-20)";
      if (avgPos <= 10.0) {
        tier = "PAGE_1_BOTTOM (Pos 5-10)";
      } else if (avgPos > 20.0) {
        tier = "PAGE_3_CANDIDATE (Pos 21-30)";
      }
      strikingDistanceKeywords.push({
        query,
        pageUrl: qAgg.pageUrl,
        impressions: qAgg.impr,
        clicks: qAgg.clicks,
        ctrPct,
        avgPosition: avgPos,
        opportunityTier: tier
      });
    }

    if (!previousQuerySet.has(query) && qAgg.impr > 0) {
      newSearchQueries.push({
        query,
        pageUrl: qAgg.pageUrl,
        currentImpressions: qAgg.impr,
        currentClicks: qAgg.clicks,
        avgPosition: avgPos
      });
    }
  }

  strikingDistanceKeywords.sort((a, b) => b.impressions - a.impressions);
  newSearchQueries.sort((a, b) => b.currentImpressions - a.currentImpressions);

  const currentClicks = currentRows.reduce((s, r) => s + r.clicks, 0);
  const previousClicks = previousRows.reduce((s, r) => s + r.clicks, 0);
  const currentImpressions = currentRows.reduce((s, r) => s + r.impressions, 0);
  const previousImpressions = previousRows.reduce((s, r) => s + r.impressions, 0);

  return {
    dataClassification,
    window: {
      current28dStart: currentStart.toISOString().slice(0, 10),
      current28dEnd: refEnd.toISOString().slice(0, 10),
      previous28dStart: prevStart.toISOString().slice(0, 10),
      previous28dEnd: prevEnd.toISOString().slice(0, 10)
    },
    totals: {
      currentClicks,
      previousClicks,
      currentImpressions,
      previousImpressions,
      currentCtrPct: normalizeCtrPct(currentClicks, currentImpressions),
      previousCtrPct: normalizeCtrPct(previousClicks, previousImpressions)
    },
    highImpressionLowCtrPages,
    strikingDistanceKeywords,
    pagesLosingClicks,
    pagesGainingImpressions,
    newSearchQueries
  };
}

