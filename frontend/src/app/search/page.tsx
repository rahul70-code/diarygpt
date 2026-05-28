"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Search as SearchIcon, Calendar, Percent } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  body: string;
  writtenAt: string;
  score: number;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("dg_token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    const token = localStorage.getItem("dg_token");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ query: query.trim(), k: 8 })
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-diary-cream font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
        {/* Dynamic Vol. IV Header */}
        <div className="border-b border-diary-border/80 pb-6 mb-8">
          <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-diary-gray mb-1.5">
            Vol. IV — Semantic Engine
          </div>
          <h1 className="font-serif text-3xl font-bold text-diary-charcoal">
            Search Journal
          </h1>
          <p className="text-xs text-diary-gray font-mono mt-1">
            Find journal logs by semantic meaning and concepts rather than just keyword matches.
          </p>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="mb-8 select-none">
          <div className="relative flex items-center bg-[#FAF8F3] border border-diary-border rounded-2xl p-2 pr-3 shadow-sm">
            <SearchIcon className="w-5 h-5 text-diary-gray ml-3 shrink-0" />
            <input
              type="text"
              placeholder="e.g. times I felt overwhelmed at work, moments of pure joy, deep sleep patterns..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none pl-3 pr-4 py-2 text-sm text-diary-charcoal focus:outline-none focus:ring-0 placeholder-diary-gray/45"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-diary-charcoal hover:bg-diary-charcoal/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-55 shrink-0"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {/* Results Container */}
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-diary-rust border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-mono text-diary-gray">Comparing vectors...</span>
          </div>
        ) : searched && results.length === 0 ? (
          <div className="py-16 text-center select-none fade-in">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-serif text-lg font-bold text-diary-charcoal mb-1">
              No semantic matches found
            </h3>
            <p className="text-xs text-diary-gray max-w-xs mx-auto leading-relaxed">
              Try rephrasing your search query or logging more journal entries for the AI to analyze.
            </p>
          </div>
        ) : !searched ? (
          <div className="py-16 text-center select-none text-diary-gray/40">
            <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-serif italic">Type a concept above to query your private logs.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-12 fade-in">
            {results.map((res) => (
              <a
                key={res.id}
                href={`/diary/${res.id}`}
                className="group p-6 rounded-2xl border border-diary-border bg-[#FAF8F3]/40 hover:bg-[#FAF8F3] hover:border-diary-rust/35 transition-all duration-300 shadow-sm flex flex-col gap-2"
              >
                <div className="flex justify-between items-start gap-4">
                  <h3 className="font-serif text-lg font-bold text-diary-charcoal group-hover:text-diary-rust transition-colors">
                    {res.title || "Untitled Entry"}
                  </h3>
                  
                  <div className="flex items-center gap-3 shrink-0 font-mono text-[10px] text-diary-gray">
                    <span className="flex items-center gap-1 bg-[#FDFCF7] border border-diary-border px-2 py-0.5 rounded-full font-bold text-diary-rust">
                      <Percent className="w-3 h-3" />
                      {Math.round(res.score * 100)}% match
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(res.writtenAt)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-diary-gray leading-relaxed line-clamp-2">
                  {res.body}
                </p>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
