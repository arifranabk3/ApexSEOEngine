"use client";

import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function PublicThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  function handleToggle() {
    const next = !isDark;
    setIsDark(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
      document.documentElement.style.colorScheme = next ? "dark" : "light";
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label="Toggle color theme"
      title="Switch Light / Dark Mode"
      className="p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 hover:border-cyan-500/40 transition text-slate-700 dark:text-slate-200"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700" />
      )}
    </button>
  );
}

