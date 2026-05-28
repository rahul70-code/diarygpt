"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  PenTool, 
  MessageSquare, 
  Search, 
  Sparkles, 
  HeartHandshake, 
  Library, 
  ShieldCheck, 
  Settings, 
  LogOut 
} from "lucide-react";

interface DiaryEntry {
  id: string | number;
  title: string;
  writtenAt: string;
  analysis?: {
    mood: string;
  };
}

interface ConfigState {
  provider: string;
  privacy: "local" | "cloud";
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [userEmail, setUserEmail] = useState("");
  const [config, setConfig] = useState<ConfigState>({ provider: "OLLAMA", privacy: "local" });
  const [recentEntries, setRecentEntries] = useState<DiaryEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Get active route class
  const activeClass = (path: string) => {
    const isActive = pathname === path || (path !== "/" && pathname.startsWith(path));
    return `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
      isActive 
        ? "bg-[#FAF8F3] text-diary-rust font-medium border border-diary-border/40 shadow-sm" 
        : "text-diary-charcoal/80 hover:text-diary-rust hover:bg-[#FAF8F3]/50"
    }`;
  };

  // Sign out handler
  const handleSignOut = () => {
    localStorage.removeItem("dg_token");
    localStorage.removeItem("dg_user");
    router.push("/login");
  };

  // Fetch initial configuration & recent entries
  useEffect(() => {
    const token = localStorage.getItem("dg_token");
    const userStr = localStorage.getItem("dg_user");
    
    if (!token) {
      router.push("/login");
      return;
    }

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserEmail(user?.email || "");
      } catch (e) {
        console.error(e);
      }
    }

    // Helper for API calls
    const fetchSidebarData = async () => {
      try {
        // Fetch active LLM provider configuration
        const configRes = await fetch("/api/config", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (configRes.status === 401) {
          handleSignOut();
          return;
        }
        if (configRes.ok) {
          const cfg = await configRes.json();
          setConfig({
            provider: cfg.active?.provider?.toUpperCase() || "OLLAMA",
            privacy: cfg.active?.privacy || "local"
          });
        }

        // Fetch recent entries for "THIS WEEK"
        const diaryRes = await fetch("/api/diary", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (diaryRes.ok) {
          const list: DiaryEntry[] = await diaryRes.json();
          // Filter to items within the last 7 days (or just top 4 most recent for UI showcase)
          setRecentEntries(list.slice(0, 4));
        }
      } catch (error) {
        console.warn("Failed to fetch sidebar dynamic data:", error);
      } finally {
        setLoadingEntries(false);
      }
    };

    fetchSidebarData();
  }, [pathname]);

  // Translate mood into status dot color matching design
  const getMoodDotColor = (mood: string = "") => {
    const m = mood.toLowerCase();
    if (["happy", "excited"].includes(m)) return "bg-[#fb923c]"; // Orange dot
    if (["calm", "reflective"].includes(m)) return "bg-[#fbbf24]"; // Yellow dot
    if (["tender", "safe"].includes(m)) return "bg-[#34d399]"; // Green dot
    if (["sad", "anxious", "angry", "mixed"].includes(m)) return "bg-[#f87171]"; // Red/Pinkish dot
    return "bg-diary-gray/50"; // default gray
  };

  const getDayLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return days[d.getDay()];
    } catch {
      return "Mon";
    }
  };

  return (
    <aside className="w-64 border-r border-diary-border bg-[#FAF8F3] flex flex-col h-screen select-none shrink-0">
      {/* Sidebar Header with Brand */}
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-diary-charcoal hover:opacity-90">
            Diary<span className="text-diary-rust">gpt</span>
          </Link>
          <span className="text-[10px] font-mono text-diary-gray tracking-widest uppercase">v0.4</span>
        </div>

        {/* Privacy & Mode Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-diary-border bg-[#FDFCF7] shadow-sm select-none">
          <span className={`w-2 h-2 rounded-full ${config.privacy === "local" ? "bg-diary-green animate-pulse" : "bg-diary-amber"}`}></span>
          <span className="text-[11px] font-mono font-bold tracking-wider text-diary-charcoal/80 uppercase">
            {config.privacy === "local" ? "LOCAL" : "CLOUD"} · {config.provider}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="px-4 flex flex-col gap-1 flex-1 overflow-y-auto">
        <Link href="/diary/new" className={activeClass("/diary/new")}>
          <PenTool className="w-4.5 h-4.5 shrink-0" />
          <span>Write</span>
        </Link>
        <Link href="/chat" className={activeClass("/chat")}>
          <MessageSquare className="w-4.5 h-4.5 shrink-0" />
          <div className="flex justify-between items-center w-full">
            <span>Ask the diary</span>
            <span className="text-[10px] font-mono text-diary-gray px-1.5 py-0.5 rounded border border-diary-border bg-[#FDFCF7]">⌘K</span>
          </div>
        </Link>
        <Link href="/search" className={activeClass("/search")}>
          <Search className="w-4.5 h-4.5 shrink-0" />
          <span>Search</span>
        </Link>
        <Link href="/insights" className={activeClass("/insights")}>
          <Sparkles className="w-4.5 h-4.5 shrink-0" />
          <span>Insights</span>
        </Link>
        <Link href="/companion" className={activeClass("/companion")}>
          <HeartHandshake className="w-4.5 h-4.5 shrink-0" />
          <span>Companion</span>
        </Link>
        <Link href="/" className={activeClass("/")}>
          <Library className="w-4.5 h-4.5 shrink-0" />
          <span>Library</span>
        </Link>

        {/* THIS WEEK Section (Dynamic Recent Entries) */}
        <div className="mt-8 pt-6 border-t border-diary-border/60">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-diary-gray mb-3 px-3">
            This Week
          </h3>
          
          {loadingEntries ? (
            <div className="px-3 py-2 text-xs font-mono text-diary-gray">Loading logs...</div>
          ) : recentEntries.length === 0 ? (
            <div className="px-3 py-2 text-xs italic text-diary-gray">No entries logged yet</div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {recentEntries.map((entry) => (
                <a 
                  key={entry.id} 
                  href={`/diary/${entry.id}`}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-diary-charcoal/80 hover:text-diary-rust hover:bg-[#FAF8F3] transition-all"
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-1">
                    <span className="font-mono text-diary-gray w-7 shrink-0 text-left">
                      {getDayLabel(entry.writtenAt)}
                    </span>
                    <span className="truncate max-w-[130px]">
                      {entry.title || "Untitled Entry"}
                    </span>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${getMoodDotColor(entry.analysis?.mood)} shrink-0`}></span>
                </a>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar Footer Account Actions */}
      <div className="p-4 border-t border-diary-border flex flex-col gap-2 bg-[#FAF8F3]">
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col overflow-hidden select-none">
            <span className="text-[10px] font-mono uppercase tracking-wider text-diary-gray">Logged in as</span>
            <span className="text-xs font-medium truncate text-diary-charcoal max-w-[150px]">{userEmail || "loading..."}</span>
          </div>
          <Link href="/settings" title="Settings" className="text-diary-gray hover:text-diary-rust p-1.5 rounded-md hover:bg-[#FDFCF7] border border-transparent hover:border-diary-border transition-all">
            <Settings className="w-4.5 h-4.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <Link 
            href="/settings"
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-diary-border bg-[#FDFCF7] text-[11px] text-diary-charcoal hover:bg-[#FAF8F3] font-medium transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-diary-gray" />
            <span>Privacy</span>
          </Link>
          <button 
            onClick={handleSignOut}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-transparent bg-diary-charcoal hover:bg-diary-charcoal/90 text-white text-[11px] font-medium transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
