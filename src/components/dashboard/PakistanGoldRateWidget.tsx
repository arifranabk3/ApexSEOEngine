"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Coins,
  RefreshCw,
  Clock,
  MapPin,
  AlertTriangle,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import type {
  PakistanGoldRatesResult,
  SupportedCitySlug
} from "@/services/finance/pakistan-gold-rate-schemas";

const CITIES: Array<{ slug: SupportedCitySlug; label: string }> = [
  { slug: "islamabad", label: "Islamabad" },
  { slug: "rawalpindi", label: "Rawalpindi" },
  { slug: "karachi", label: "Karachi" },
  { slug: "lahore", label: "Lahore" },
  { slug: "peshawar", label: "Peshawar" },
  { slug: "faisalabad", label: "Faisalabad" },
  { slug: "multan", label: "Multan" },
  { slug: "quetta", label: "Quetta" }
];

type WeightUnit = "tola" | "10g" | "1g";

export function PakistanGoldRateWidget() {
  const [city, setCity] = useState<SupportedCitySlug>("islamabad");
  const [unit, setUnit] = useState<WeightUnit>("tola");
  const [data, setData] = useState<PakistanGoldRatesResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const fetchRates = useCallback(
    async (targetCity: SupportedCitySlug, isManual = false) => {
      if (isManual) {
        setRefreshing(true);
        setCooldownSeconds(10); // 10s cooldown
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const query = isManual ? `?city=${targetCity}&refresh=true` : `?city=${targetCity}`;
        const res = await fetch(`/api/v1/finance/pakistan-gold-rates${query}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          setError(json.error?.message || "Failed to load gold rates.");
        } else {
          setData(json.data.rates);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Network error fetching gold rates.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchRates(city);
  }, [city, fetchRates]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const formatPrice = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return "N/A";
    return `PKR ${val.toLocaleString()}`;
  };

  const getPurityPriceByUnit = (
    purity: "24K" | "22K" | "21K" | "18K",
    selectedUnit: WeightUnit
  ): number | null => {
    if (!data || !data.rates || !data.rates[purity]) return null;
    const p = data.rates[purity];
    if (selectedUnit === "tola") return p.perTolaPkr;
    if (selectedUnit === "10g") return p.per10GramsPkr;
    return p.perGramPkr;
  };

  const rate24k = getPurityPriceByUnit("24K", unit);

  return (
    <div className="apex-card p-6 border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-amber-950/20 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Pakistan Gold Bullion Market Rates
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                LIVE SPOT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Official Sarafa Association benchmark rates &bull; Free bullion feed
            </p>
          </div>
        </div>

        {/* Controls: City Selector & Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={city}
              onChange={(e) => setCity(e.target.value as SupportedCitySlug)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {CITIES.map((c) => (
                <option key={c.slug} value={c.slug} className="bg-slate-900 text-white">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={refreshing || cooldownSeconds > 0}
            onClick={() => fetchRates(city, true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{cooldownSeconds > 0 ? `${cooldownSeconds}s` : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Stale Warning Banner */}
      {data?.isStale && (
        <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{data.staleReason || "Displaying cached market snapshot."}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Weight Unit Toggle Pills */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-400">Select Weight Metric:</div>
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          {(
            [
              { id: "tola", label: "Per Tola (11.66g)" },
              { id: "10g", label: "Per 10 Grams" },
              { id: "1g", label: "Per 1 Gram" }
            ] as const
          ).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setUnit(u.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                unit === u.id
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary 24K Headline Banner */}
      <div className="mt-5 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider">
            24 Karat Pure Gold &bull; {data?.cityName || city}
          </div>
          <div className="text-3xl font-black text-white mt-1 tracking-tight">
            {loading ? "Loading..." : formatPrice(rate24k)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Standard unit: {unit === "tola" ? "1 Tola (11.6638 grams)" : unit === "10g" ? "10 Grams" : "1 Gram (Calculated: 10g / 10)"}
          </div>
        </div>

        {data?.pathoor24kPerTola && unit === "tola" && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-right">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">
              Pathoor (Local 24K Raw)
            </div>
            <div className="text-base font-bold text-amber-300 mt-0.5">
              PKR {data.pathoor24kPerTola.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">Per Tola</div>
          </div>
        )}
      </div>

      {/* Secondary Purity Breakdown Grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(
          [
            { purity: "22K" as const, title: "22 Karat (Jewelry)", desc: "91.6% Pure Gold" },
            { purity: "21K" as const, title: "21 Karat", desc: "87.5% Standard" },
            { purity: "18K" as const, title: "18 Karat", desc: "75.0% Alloy" }
          ] as const
        ).map((item) => {
          const price = getPurityPriceByUnit(item.purity, unit);
          return (
            <div
              key={item.purity}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">{item.title}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {item.purity}
                </span>
              </div>
              <div className="text-lg font-bold text-slate-100 mt-2">
                {loading ? "..." : formatPrice(price)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Meta, Cache & Attribution Footer */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Updated: {data?.providerTimestamp ? new Date(data.providerTimestamp).toLocaleTimeString() : "N/A"}</span>
          </div>

          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Server Cache: 15m TTL</span>
          </div>

          {data?.remainingDailyQuota !== null && data?.remainingDailyQuota !== undefined && (
            <div className="font-mono text-[10px] text-slate-500">
              Provider Quota: {data.remainingDailyQuota}/100 remaining
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span>Source:</span>
          <a
            href="https://sarafa.pk"
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-0.5"
          >
            <span>Sarafa.pk</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-3 text-[10px] text-slate-500 leading-relaxed">
        <strong>Notice:</strong> Spot bullion prices published for informational purposes. Local jewelers apply making charges (ujrat) and wastage upon crafting.
      </div>
    </div>
  );
}
