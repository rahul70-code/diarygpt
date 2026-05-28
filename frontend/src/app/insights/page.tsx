"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Sparkles, Flame, History, Award, Calendar } from "lucide-react";

interface Memory {
  id: string;
  title: string;
  writtenAt: string;
  snippet: string;
  yearsAgo: number;
}

interface InsightsResponse {
  moodCounts: Record<string, number>;
  streak: number;
  memories: Memory[];
  totalEntries: number;
}

const MOOD_COLORS: Record<string, string> = {
  happy: "#fbbf24", // amber
  calm: "#34d399", // emerald
  excited: "#fb923c", // orange
  reflective: "#a78bfa", // purple
  sad: "#60a5fa", // blue
  anxious: "#f87171", // red
  angry: "#ef4444", // red-deep
  mixed: "#94a3b8", // slate
};

export default function InsightsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState("");
  const [data, setData] = useState<InsightsResponse | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("dg_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchInsights = async () => {
      try {
        const res = await fetch("/api/insights/mood?period=30", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const list: InsightsResponse = await res.json();
          setData(list);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [router]);

  // Request AI Weekly summary
  const generateWeeklySummary = async () => {
    setGeneratingWeekly(true);
    setWeeklySummary("Consulting past logs and analyzing your emotional timeline...");
    const token = localStorage.getItem("dg_token");

    try {
      const res = await fetch("/api/insights/weekly", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        setWeeklySummary(result.summary);
      } else {
        throw new Error("Weekly summary generation failed.");
      }
    } catch (error) {
      setWeeklySummary("Could not generate summary at this time. Make sure you have entries logged within the last 7 days.");
    } finally {
      setGeneratingWeekly(false);
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

  if (loading) {
    return (
      <div className="flex h-screen bg-diary-cream select-none items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-diary-rust border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-diary-gray">Loading insights data...</span>
        </div>
      </div>
    );
  }

  // Calculate SVG Doughnut segments
  const moodCounts = data?.moodCounts || {};
  const totalMoods = Object.values(moodCounts).reduce((a, b) => a + b, 0);
  const moodsList = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);

  let accumulatedPercentage = 0;
  const svgSegments = moodsList.map(([mood, count]) => {
    const percentage = totalMoods > 0 ? (count / totalMoods) * 100 : 0;
    const strokeDashArray = `${percentage} ${100 - percentage}`;
    const strokeDashOffset = 100 - accumulatedPercentage + 25; // 25 to start at 12 o'clock
    accumulatedPercentage += percentage;
    return {
      mood,
      count,
      percentage,
      color: MOOD_COLORS[mood] || "#94a3b8",
      strokeDashArray,
      strokeDashOffset,
    };
  });

  return (
    <div className="flex h-screen overflow-hidden bg-diary-cream font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
        {/* Editorial Header */}
        <div className="border-b border-diary-border/80 pb-6 mb-8 flex justify-between items-end">
          <div>
            <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-diary-gray mb-1.5">
              Vol. IV — Insights Engine
            </div>
            <h1 className="font-serif text-3xl font-bold text-diary-charcoal">
              Mental Health & Patterns
            </h1>
            <p className="text-xs text-diary-gray font-mono mt-1">
              Deep reflective analytics extracted automatically from your private journaling entries.
            </p>
          </div>

          {data && data.streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-orange-200 bg-orange-50 font-mono text-xs font-bold text-orange-700 shadow-sm select-none">
              <Flame className="w-4 h-4 fill-orange-500 text-orange-500 animate-bounce" />
              <span>🔥 {data.streak}-DAY STREAK</span>
            </div>
          )}
        </div>

        {/* Dashboard Grid Wrap */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20 select-none">
          {/* Card Column 1: Mood Doughnut Chart */}
          <div className="lg:col-span-1 p-6 rounded-2xl border border-diary-border bg-[#FAF8F3] shadow-sm flex flex-col gap-6 select-none">
            <div>
              <h3 className="font-serif text-lg font-bold text-diary-charcoal mb-0.5">Mood This Month</h3>
              <p className="text-[10px] font-mono text-diary-gray uppercase tracking-widest">
                {data?.totalEntries || 0} Entries Analyzed
              </p>
            </div>

            {totalMoods === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center select-none text-diary-gray">
                <span className="text-3xl mb-2">🧘</span>
                <p className="text-xs font-serif italic max-w-[180px] leading-relaxed">
                  No mood data yet. Write some entries, and your emotional breakdown will appear here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 items-center">
                {/* Custom Pure SVG Doughnut Chart (Stroke-Dasharray) */}
                <div className="relative w-36 h-36">
                  <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
                    <circle
                      cx="21"
                      cy="21"
                      r="15.915"
                      fill="transparent"
                      stroke="#E6E1D8"
                      strokeWidth="4"
                    />
                    {svgSegments.map((seg, idx) => (
                      <circle
                        key={idx}
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="4.5"
                        strokeDasharray={seg.strokeDashArray}
                        strokeDashoffset={seg.strokeDashOffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    ))}
                  </svg>
                  
                  {/* Inside Circle Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAF8F3] rounded-full m-4 border border-diary-border/30">
                    <span className="text-2xl font-bold font-serif text-diary-charcoal">{totalMoods}</span>
                    <span className="text-[9px] font-mono text-diary-gray uppercase tracking-wider font-bold">Logs</span>
                  </div>
                </div>

                {/* Legend Breakdown */}
                <div className="w-full flex flex-col gap-2 border-t border-diary-border/40 pt-4">
                  {svgSegments.map((seg, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-mono text-diary-charcoal">
                      <div className="flex items-center gap-2">
                        <span style={{ backgroundColor: seg.color }} className="w-2.5 h-2.5 rounded-full shrink-0"></span>
                        <span className="capitalize font-medium">{seg.mood}</span>
                      </div>
                      <span className="text-diary-gray">{seg.count} log{seg.count === 1 ? "" : "s"} ({Math.round(seg.percentage)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card Column 2: Weekly Reflection */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="p-6 rounded-2xl border border-diary-border bg-[#FAF8F3] shadow-sm flex flex-col gap-4 flex-1 select-none">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-serif text-lg font-bold text-diary-charcoal flex items-center gap-1.5">
                    <Sparkles className="w-5 h-5 text-diary-rust" />
                    Weekly AI Reflection
                  </h3>
                  <p className="text-[10px] font-mono text-diary-gray uppercase tracking-widest mt-0.5">
                    Empathetic Synthesis of your Last 7 Days
                  </p>
                </div>
                
                <button
                  onClick={generateWeeklySummary}
                  disabled={generatingWeekly}
                  className="px-4 py-1.5 bg-diary-charcoal hover:bg-diary-charcoal/90 text-white rounded-full text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer disabled:opacity-55"
                >
                  {generatingWeekly ? "Consulting..." : "Generate summary"}
                </button>
              </div>

              {weeklySummary ? (
                <div className="p-5 rounded-2xl border border-diary-border bg-[#FDFCF7] fade-in select-text">
                  <p className="font-serif italic text-sm text-diary-charcoal leading-relaxed whitespace-pre-wrap">
                    {weeklySummary}
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center select-none border border-dashed border-diary-border rounded-2xl text-diary-gray/70">
                  <Award className="w-10 h-10 mb-2 opacity-50 text-diary-gray" />
                  <p className="text-sm font-serif italic max-w-sm px-4">
                    Click &ldquo;Generate summary&rdquo; above, and Claude will analyze the emotional arc and recurring themes of your last seven days.
                  </p>
                </div>
              )}
            </div>

            {/* Memories Block ("On this day...") */}
            {data && data.memories && data.memories.length > 0 && (
              <div className="p-6 rounded-2xl border border-diary-border bg-[#FAF8F3] shadow-sm flex flex-col gap-4 select-none">
                <div>
                  <h3 className="font-serif text-lg font-bold text-diary-charcoal flex items-center gap-1.5">
                    <History className="w-5 h-5 text-diary-gray" />
                    On This Day...
                  </h3>
                  <p className="text-[10px] font-mono text-diary-gray uppercase tracking-widest mt-0.5">
                    Memories from your writing history
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {data.memories.map((m) => (
                    <a
                      key={m.id}
                      href={`/diary/${m.id}`}
                      className="group p-4 rounded-xl border border-diary-border bg-[#FDFCF7] hover:border-diary-rust/35 transition-all duration-300 flex justify-between items-center gap-4 shadow-sm"
                    >
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold tracking-widest text-diary-rust bg-orange-50 px-2 py-0.5 rounded border border-orange-200 uppercase shrink-0">
                            {m.yearsAgo} Year{m.yearsAgo > 1 ? "s" : ""} Ago
                          </span>
                          <h4 className="font-serif text-sm font-bold text-diary-charcoal group-hover:text-diary-rust truncate">
                            {m.title || "Untitled log"}
                          </h4>
                        </div>
                        <p className="text-xs text-diary-gray line-clamp-1 leading-relaxed">
                          {m.snippet}
                        </p>
                      </div>
                      
                      <div className="flex items-center font-mono text-[9px] text-diary-gray gap-1 shrink-0">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(m.writtenAt)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
