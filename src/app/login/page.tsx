"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Cpu,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Database,
  CheckCircle2,
  KeyRound
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@apexseo.local");
  const [password, setPassword] = useState("Admin@12345");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Authentication failed");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error while connecting to authentication service");
      setLoading(false);
    }
  }

  function fillDemoCredentials() {
    setEmail("admin@apexseo.local");
    setPassword("Admin@12345");
    setError(null);
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-center items-center px-4 py-10 bg-[#050811] text-slate-100 apex-mesh-bg">
      {/* Ambient Decorative Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl"
      />

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-slate-800/90 bg-slate-900/75 backdrop-blur-xl shadow-2xl overflow-hidden relative z-10">
        {/* Left Brand & Architecture Showcase */}
        <div className="lg:col-span-6 p-8 lg:p-10 bg-gradient-to-br from-blue-950/60 via-slate-900/90 to-indigo-950/60 border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px] font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Enterprise SEO + Google AdSense Control Plane</span>
            </div>

            <div className="flex items-center gap-3.5 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white">
                  ApexSEO Autonomous
                </h1>
                <p className="text-xs text-slate-400">
                  Phase 01 Master Foundation &bull; Zero-Cost Stack
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300/90 mt-4">
              Provider-independent AI content engineering, technical SEO auditing, and independent Google AdSense publisher policy enforcement — built with zero paid APIs.
            </p>

            <div className="mt-6 space-y-3">
              {[
                {
                  title: "Google Search & AdSense Dual Gate",
                  desc: "Separate compliance engines for Search Essentials, E-E-A-T, ads.txt, and IVT protection."
                },
                {
                  title: "Zero-Cost Local AI & Automation",
                  desc: "Native adapters for Ollama local LLMs, n8n Community Edition, and WordPress REST API."
                },
                {
                  title: "AES-256-GCM Credential Vault",
                  desc: "Authenticated encryption at rest with strict multi-website PostgreSQL isolation."
                }
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-white">{item.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              PostgreSQL 16 + Prisma ORM
            </span>
            <span className="text-emerald-400 font-mono">v1.0.0-phase01</span>
          </div>
        </div>

        {/* Right Sign-In Form */}
        <div className="lg:col-span-6 p-8 lg:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Sign in to Control Plane</h2>
            <p className="text-xs text-slate-400 mt-1">
              Authenticate with your RBAC administrator account to manage websites and compliance gates.
            </p>
          </div>

          <div className="mb-6 p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-slate-300 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Principal Architect Demo Account</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Credentials pre-filled for instant local workspace verification.
              </p>
            </div>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium flex items-center gap-1 transition"
            >
              <KeyRound className="w-3 h-3" />
              Reset
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Administrator Email
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  placeholder="admin@apexseo.local"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition"
            >
              <span>
                {loading ? "Authenticating Session..." : "Launch Control Plane"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
