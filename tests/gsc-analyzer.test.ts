import { describe, it, expect } from "vitest";
import {
  analyzeGsc28DayComparison,
  GscRawRow
} from "@/services/integrations/gsc-performance-analyzer";

describe("Google Search Console 28-Day vs Previous 28-Day Analyzer", () => {
  const benchmarkRows: GscRawRow[] = [
    // Page 1: High Impressions, Low CTR in Current 28d (Oct 16 - Nov 12, 2026)
    {
      pageUrl: "https://apextech.example.com/self-hosted-ai-blog-automation-n8n-ollama-docker",
      query: "self hosted ai blog automation n8n ollama docker",
      date: "2026-10-01",
      clicks: 18,
      impressions: 950,
      ctr: 1.89,
      position: 11.4,
      isBenchmarkSimulation: true
    },
    {
      pageUrl: "https://apextech.example.com/self-hosted-ai-blog-automation-n8n-ollama-docker",
      query: "self hosted ai blog automation n8n ollama docker",
      date: "2026-11-05",
      clicks: 24,
      impressions: 1850,
      ctr: 1.3,
      position: 8.6,
      isBenchmarkSimulation: true
    },
    // Page 2: Losing Clicks (Content Decay)
    {
      pageUrl: "https://apextech.example.com/fix-n8n-ollama-connection-refused-11434-docker-compose",
      query: "n8n ollama connection refused 11434 docker compose",
      date: "2026-09-25",
      clicks: 92,
      impressions: 1100,
      ctr: 8.36,
      position: 3.2,
      isBenchmarkSimulation: true
    },
    {
      pageUrl: "https://apextech.example.com/fix-n8n-ollama-connection-refused-11434-docker-compose",
      query: "n8n ollama connection refused 11434 docker compose",
      date: "2026-11-02",
      clicks: 49,
      impressions: 980,
      ctr: 5.0,
      position: 6.4,
      isBenchmarkSimulation: true
    },
    // Page 3: Striking Distance Pos 14.2 + New Search Query in Current 28d
    {
      pageUrl: "https://apextech.example.com/automated-internal-linking-wordpress-n8n-without-plugins",
      query: "automated internal linking wordpress n8n workflow without plugins",
      date: "2026-11-08",
      clicks: 9,
      impressions: 640,
      ctr: 1.41,
      position: 14.2,
      isBenchmarkSimulation: true
    }
  ];

  it("identifies high-impression low-CTR pages, striking distance queries (pos 5-30), click decay, impression gains, and new queries", () => {
    const report = analyzeGsc28DayComparison(
      benchmarkRows,
      "2026-11-12",
      "BENCHMARK_SIMULATION_DATASET"
    );

    expect(report.dataClassification).toBe("BENCHMARK_SIMULATION_DATASET");
    expect(report.highImpressionLowCtrPages.length).toBe(2);
    expect(report.highImpressionLowCtrPages[0].pageUrl).toContain(
      "self-hosted-ai-blog-automation-n8n-ollama-docker"
    );

    expect(report.pagesLosingClicks.length).toBe(1);
    expect(report.pagesLosingClicks[0].clickDelta).toBe(-43);

    expect(report.pagesGainingImpressions.length).toBe(2);
    expect(report.strikingDistanceKeywords.length).toBe(3);
    expect(report.newSearchQueries.length).toBe(1);
    expect(report.newSearchQueries[0].query).toBe(
      "automated internal linking wordpress n8n workflow without plugins"
    );
  });
});

