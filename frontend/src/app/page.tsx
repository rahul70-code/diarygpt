"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Plus, BookOpen, Clock, Calendar } from "lucide-react";

interface DiaryEntry {
  id: string | number;
  title: string;
  body: string;
  writtenAt: string;
  analysis?: {
    mood: string;
    themes?: string[];
  };
}

export default function LibraryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userToken, setUserToken] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("dg_token");
    if (!token) {
      router.push("/login");
      return;
    }
    setUserToken(token);

    const fetchEntries = async () => {
      try {
        const res = await fetch("/api/diary", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem("dg_token");
          router.push("/login");
          return;
        }
        if (res.ok) {
          const list = await res.json();
          setEntries(list);
        }
      } catch (err) {
        console.error("Failed to load entries:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [router]);

  // Clean formatting helpers
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

  const getWordCount = (body: string = "") => {
    return body.trim().split(/\s+/).filter(Boolean).length;
  };

  const getReadTime = (body: string = "") => {
    const words = getWordCount(body);
    const wpm = 200; // Average reading speed
    const mins = Math.ceil(words / wpm);
    return `${mins} min read`;
  };

  const getMoodBadgeStyles = (mood: string = "") => {
    const m = mood.toLowerCase();
    switch (m) {
      case "happy":
      case "excited":
        return "bg-orange-50 border-orange-200 text-orange-700";
      case "calm":
      case "reflective":
        return "bg-amber-50 border-amber-200 text-amber-700";
      case "tender":
      case "safe":
        return "bg-emerald-50 border-emerald-200 text-emerald-700";
      case "sad":
      case "anxious":
      case "angry":
      case "mixed":
        return "bg-rose-50 border-rose-200 text-rose-700";
      default:
        return "bg-stone-50 border-stone-200 text-stone-700";
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-diary-cream font-sans">
      {/* Shared Editorial Sidebar */}
      <Sidebar />

      {/* Main Core Viewport */}
      <main className="flex-1 overflow-y-auto p-8 relative flex flex-col max-w-5xl mx-auto w-full">
        {/* Dynamic Vol. IV Header Bar */}
        <div className="border-b border-diary-border/80 pb-6 mb-8 flex justify-between items-end">
          <div>
            <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-diary-gray mb-1.5">
              Vol. IV — Journal Library
            </div>
            <h1 className="font-serif text-3xl font-bold text-diary-charcoal flex items-center gap-2">
              My Journal
              <span className="text-xs font-mono font-normal text-diary-gray border border-diary-border px-2 py-0.5 rounded-full bg-[#FAF8F3]">
                {loading ? "Loading..." : `${entries.length} log${entries.length === 1 ? "" : "s"}`}
              </span>
            </h1>
          </div>

          <Link
            href="/diary/new"
            className="flex items-center gap-2 px-4 py-2 bg-diary-charcoal hover:bg-diary-charcoal/90 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-diary-charcoal/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New entry</span>
          </Link>
        </div>

        {/* Entries Content Container */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-diary-rust border-t-transparent rounded-full animate-spin"></div>
              <div className="text-sm font-mono text-diary-gray">Opening volumes...</div>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center select-none fade-in">
            <div className="text-4xl mb-4">📓</div>
            <h2 className="font-serif text-xl font-bold text-diary-charcoal mb-2">
              Your journal is empty
            </h2>
            <p className="text-diary-gray text-sm max-w-sm mb-6 leading-relaxed">
              Write your first entry and let our local model guide your self-reflection and extract emotional indicators.
            </p>
            <Link
              href="/diary/new"
              className="flex items-center gap-2 px-6 py-2.5 bg-diary-charcoal hover:bg-diary-charcoal/90 text-white rounded-full text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Write your first entry</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12 fade-in">
            {entries.map((entry) => (
              <a
                key={entry.id}
                href={`/diary/${entry.id}`}
                className="group relative flex flex-col p-6 rounded-2xl border border-diary-border bg-[#FAF8F3]/50 hover:bg-[#FAF8F3] hover:border-diary-rust/35 transition-all duration-300 shadow-sm"
              >
                {/* Paper Top Corner Decal (Subtle UI accent) */}
                <div className="absolute top-4 right-4 text-[10px] font-mono text-diary-gray flex items-center gap-1.5 group-hover:text-diary-rust transition-colors">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(entry.writtenAt)}</span>
                </div>

                {/* Entry Title */}
                <h3 className="font-serif text-xl font-bold text-diary-charcoal tracking-tight pr-24 group-hover:text-diary-rust transition-colors mb-3">
                  {entry.title || "Untitled Entry"}
                </h3>

                {/* Body Snippet */}
                <p className="text-sm text-diary-gray leading-relaxed mb-6 flex-1 line-clamp-3">
                  {entry.body}
                </p>

                {/* Footer Metadata & Badges */}
                <div className="flex items-center justify-between border-t border-diary-border/40 pt-4 mt-auto">
                  <div className="flex items-center gap-4 text-[11px] font-mono text-diary-gray">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {getWordCount(entry.body)} words
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {getReadTime(entry.body)}
                    </span>
                  </div>

                  {entry.analysis?.mood && (
                    <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border uppercase ${getMoodBadgeStyles(entry.analysis.mood)}`}>
                      {entry.analysis.mood}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
