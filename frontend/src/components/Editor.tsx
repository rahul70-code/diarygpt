"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { 
  ChevronLeft, 
  Trash2, 
  Save, 
  Mic, 
  Square, 
  Sparkles, 
  CornerDownLeft, 
  Check 
} from "lucide-react";

interface EditorProps {
  id?: string | null;
}

interface DiaryEntry {
  id: string | number;
  title: string;
  body: string;
  writtenAt: string;
  analysis?: {
    mood: string;
    themes?: string[];
    reflection?: string;
    followUpQuestion?: string;
  };
}

export default function Editor({ id = null }: EditorProps) {
  const router = useRouter();

  // Resolve the actual entry ID from the browser URL to bypass Next.js static export mock params ("placeholder")
  const [activeId, setActiveId] = useState<string | null>(id);
  const [isNew, setIsNew] = useState(id === null || id === "placeholder");
  const [loading, setLoading] = useState(id !== null && id !== "placeholder");

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [writtenAt, setWrittenAt] = useState(new Date().toISOString().slice(0, 10));
  const [entry, setEntry] = useState<DiaryEntry | null>(null);

  // Status State
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("draft · standing by");
  const [errorMsg, setErrorMsg] = useState("");
  
  // AI Prompts State
  const [promptLoading, setPromptLoading] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState("");
  
  // Speech Dictation State
  const [isDictating, setIsDictating] = useState(false);
  const [dictationText, setDictationText] = useState("");
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(30).fill(6));
  const waveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resolve ID from path at client runtime
  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const match = path.match(/\/diary\/([^/]+)\/?$/);
      if (match && match[1] !== "placeholder" && match[1] !== "new") {
        setActiveId(match[1]);
        setIsNew(false);
        setLoading(true);
      } else if (match && match[1] === "new") {
        setActiveId(null);
        setIsNew(true);
        setLoading(false);
      } else {
        setActiveId(id);
        setIsNew(id === null || id === "placeholder");
        setLoading(id !== null && id !== "placeholder");
      }
    }
  }, [id]);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(400, textareaRef.current.scrollHeight)}px`;
    }
  }, [body]);

  // Load entry if editing
  useEffect(() => {
    if (isNew || !activeId || activeId === "placeholder") return;

    const token = localStorage.getItem("dg_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchEntry = async () => {
      try {
        const res = await fetch(`/api/diary/${activeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem("dg_token");
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Entry not found.");

        const data: DiaryEntry = await res.json();
        setEntry(data);
        setTitle(data.title || "");
        setBody(data.body || "");
        setWrittenAt(data.writtenAt ? data.writtenAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
        setSaveStatus("saved locally");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load entry.");
      } finally {
        setLoading(false);
      }
    };

    fetchEntry();
  }, [activeId, isNew, router]);

  // Handle Save
  const handleSave = async () => {
    if (!body.trim()) {
      setErrorMsg("Write some thoughts before saving.");
      return;
    }

    setErrorMsg("");
    setSaving(true);
    setSaveStatus("saving...");

    const token = localStorage.getItem("dg_token");
    if (!token) return;

    try {
      const endpoint = isNew ? "/api/diary" : `/api/diary/${activeId}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), writtenAt })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Save failed.");
      }

      setSaveStatus("saved locally");
      
      if (isNew) {
        // Redirect to edit page for RAG and AI Analysis to kick in
        router.push(`/diary/${data.id}`);
      } else {
        // Refresh entry data (for analysis update)
        setEntry(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save entry.");
      setSaveStatus("error saving");
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (isNew) return;
    if (!confirm("Are you sure you want to delete this entry? This cannot be undone.")) return;

    const token = localStorage.getItem("dg_token");
    if (!token) return;

    try {
      const res = await fetch(`/api/diary/${activeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        router.push("/");
      } else {
        throw new Error("Deletion failed.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete entry.");
    }
  };

  // Fetch AI Journaling Prompt
  const suggestAPrompt = async () => {
    setPromptLoading(true);
    const token = localStorage.getItem("dg_token");
    if (!token) return;

    try {
      const res = await fetch("/api/insights/prompt", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedPrompt(data.prompt);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setPromptLoading(false);
    }
  };

  // Inject suggested prompt into editor body
  const usePrompt = () => {
    setBody((prev) => (prev ? prev + "\n\n" : "") + suggestedPrompt + "\n\n");
    setSuggestedPrompt("");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Dictation: Vertical Waveform Simulator
  const startWaveformSimulation = () => {
    waveTimerRef.current = setInterval(() => {
      setWaveHeights(
        Array(30)
          .fill(0)
          .map(() => Math.floor(Math.random() * 24) + 4)
      );
    }, 120);
  };

  const stopWaveformSimulation = () => {
    if (waveTimerRef.current) {
      clearInterval(waveTimerRef.current);
      waveTimerRef.current = null;
    }
    setWaveHeights(Array(30).fill(6));
  };

  // Speech Recognition Core
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsDictating(true);
      setDictationText("Listening...");
      startWaveformSimulation();
    };

    rec.onresult = (e: any) => {
      const results = Array.from(e.results);
      const interim = results.filter((r: any) => !r.isFinal).map((r: any) => r[0].transcript).join("");
      const final = results.filter((r: any) => r.isFinal).map((r: any) => r[0].transcript).join("");
      
      if (interim) {
        setDictationText(interim);
      }
      if (final) {
        setBody((prev) => (prev ? prev + " " : "") + final);
        setDictationText("");
      }
    };

    rec.onerror = (e: any) => {
      console.warn("[speech error]", e.error);
      stopSpeechRecognition();
    };

    rec.onend = () => {
      stopSpeechRecognition();
    };

    rec.start();
    recognitionRef.current = rec;
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsDictating(false);
    setDictationText("");
    stopWaveformSimulation();
  };

  // Word count and read time calculations
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const readTime = Math.ceil(words / 200);

  // Mock themes derived from patterns in designs
  const getMockedThemes = () => {
    if (entry?.analysis?.themes && entry.analysis.themes.length > 0) {
      return entry.analysis.themes.map((t, idx) => ({
        label: t,
        percentage: idx === 0 ? 82 : idx === 1 ? 61 : 48
      }));
    }
    
    // Default placeholder themes if new
    return [
      { label: "work · being seen", percentage: 82 },
      { label: "sleep · early waking", percentage: 61 },
      { label: "self-trust", percentage: 48 }
    ];
  };

  const getMoodValue = () => {
    if (entry?.analysis?.mood) {
      const mood = entry.analysis.mood.toLowerCase();
      if (["happy", "excited"].includes(mood)) return { score: "8.6", text: "vibrant, positive" };
      if (["calm", "reflective"].includes(mood)) return { score: "7.2", text: "peaceful, mindful" };
      if (["tender", "safe"].includes(mood)) return { score: "8.0", text: "connected, gentle" };
      if (["sad", "anxious", "angry", "mixed"].includes(mood)) return { score: "3.4", text: "subdued, ruminating" };
    }
    return { score: "5.0", text: "neutral log" };
  };

  const currentMood = getMoodValue();

  return (
    <div className="flex h-screen overflow-hidden bg-diary-cream font-sans">
      {/* Editorial Sidebar */}
      <Sidebar />

      {/* Main Core Viewport splits into: Center Editor, Right Context Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* CENTER WRITING WORKSPACE */}
        <main className="flex-1 overflow-y-auto px-10 py-8 flex flex-col relative bg-[#FDFCF7]">
          {/* Editor Header Bar */}
          <div className="border-b border-diary-border/80 pb-4 mb-8 flex justify-between items-center text-xs font-mono text-diary-gray">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push("/")}
                className="flex items-center gap-1 hover:text-diary-rust transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>VOL. IV</span>
              </button>
              <span className="text-diary-border">|</span>
              <span className="uppercase tracking-widest text-diary-rust/90">
                ENTRY — {isNew ? "DRAFT" : "PUBLISHED"} · {saveStatus.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-4 select-none">
              <span>{words} WORDS</span>
              <span>·</span>
              <span>{readTime} MIN READ</span>
              <span>·</span>
              <span>SAVED LOCALLY</span>
            </div>
          </div>

          {/* Form Area */}
          <div className="flex-1 max-w-[680px] w-full mx-auto flex flex-col select-text mb-24">
            
            {/* Display Error alerts */}
            {errorMsg && (
              <div className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Date Pick Input */}
            <div className="mb-2">
              <input
                type="date"
                value={writtenAt}
                onChange={(e) => setWrittenAt(e.target.value)}
                className="font-mono text-xs text-diary-gray bg-transparent border-none focus:outline-none focus:ring-0 focus:text-diary-rust select-none cursor-pointer"
              />
            </div>

            {/* Suggest prompt block */}
            {isNew && (
              <div className="mb-4">
                {suggestedPrompt ? (
                  <div className="p-4 rounded-2xl border border-diary-border bg-[#FAF8F3] fade-in flex flex-col gap-3">
                    <p className="font-serif italic text-sm text-diary-charcoal leading-relaxed">
                      &ldquo;{suggestedPrompt}&rdquo;
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={usePrompt}
                        className="px-3 py-1 bg-diary-charcoal hover:bg-diary-charcoal/90 text-white rounded-full text-xs font-medium cursor-pointer"
                      >
                        Use this prompt
                      </button>
                      <button 
                        onClick={suggestAPrompt}
                        className="px-3 py-1 border border-diary-border hover:bg-diary-cream rounded-full text-xs font-medium text-diary-charcoal cursor-pointer"
                      >
                        Try another
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={suggestAPrompt}
                    disabled={promptLoading}
                    className="flex items-center gap-1.5 text-xs text-diary-rust hover:text-diary-rust/80 font-medium transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{promptLoading ? "Consulting past themes..." : "Suggest a personalized prompt"}</span>
                  </button>
                )}
              </div>
            )}

            {/* Entry Title Input */}
            <input
              type="text"
              placeholder="Entry title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full font-serif text-4xl font-bold tracking-tight text-diary-charcoal border-none focus:outline-none focus:ring-0 placeholder-diary-gray/30 p-0 mb-6 bg-transparent"
            />

            {/* Writing Body Textarea */}
            <textarea
              ref={textareaRef}
              placeholder="What's on your mind today..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full font-serif text-lg leading-relaxed text-diary-charcoal border-none focus:outline-none focus:ring-0 placeholder-diary-gray/30 p-0 bg-transparent resize-none overflow-hidden flex-1"
            />
            
            {/* Status indicators */}
            <div className="mt-8 text-xs font-mono text-diary-gray select-none border-t border-diary-border/30 pt-4 flex justify-between items-center">
              <span>typing — local model standing by</span>
              <div className="flex gap-3">
                {!isNew && (
                  <button 
                    onClick={handleDelete}
                    className="flex items-center gap-1 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete log</span>
                  </button>
                )}
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 hover:text-diary-rust transition-colors font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? "Saving..." : "Save changes"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* FLOATING VOICE DICTATION CAPSULE */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#FAF8F3] border border-diary-border rounded-full p-2 pl-3 shadow-md z-20 flex items-center gap-4 max-w-[500px] select-none">
            {isDictating ? (
              <button
                onClick={stopSpeechRecognition}
                className="w-10 h-10 rounded-full bg-diary-charcoal hover:bg-diary-charcoal/90 text-white flex items-center justify-center cursor-pointer transition-all shadow-sm"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                onClick={startSpeechRecognition}
                className="w-10 h-10 rounded-full bg-diary-rust hover:bg-diary-rust/90 text-white flex items-center justify-center cursor-pointer transition-all shadow-sm shadow-diary-rust/20 animate-pulse"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            <div className="flex flex-col pr-2">
              <span className="text-[10px] font-mono text-diary-rust font-bold uppercase tracking-wider">
                {isDictating ? "🔴 RECORDING VOICE" : "MIC STANDING BY"}
              </span>
              <span className="text-[11px] font-mono text-diary-charcoal truncate max-w-[180px]">
                {isDictating ? (dictationText || "transcribing locally...") : "Speak to dictate text"}
              </span>
            </div>

            {/* Fluctuating Audio Wave (Simulated/Active) */}
            <div className="flex items-end gap-0.5 h-6 select-none mr-2">
              {waveHeights.map((h, i) => (
                <span 
                  key={i} 
                  style={{ height: `${h}px` }} 
                  className={`w-0.75 rounded-full transition-all duration-100 ${isDictating ? "bg-diary-rust" : "bg-diary-gray/25"}`}
                ></span>
              ))}
            </div>

            {isDictating && (
              <button 
                onClick={stopSpeechRecognition}
                className="px-4 py-2 bg-diary-charcoal hover:bg-diary-charcoal/90 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            )}
          </div>
        </main>

        {/* RIGHT CONTEXTUAL INSIGHTS SIDEBAR */}
        <aside className="w-72 border-l border-diary-border bg-[#FAF8F3] p-6 overflow-y-auto flex flex-col gap-8 shrink-0 select-none">
          {/* Section: Model Insights */}
          <div className="flex flex-col gap-4">
            <div>
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-diary-gray mb-1">
                The Model Noticed
              </h4>
              <p className="text-xs text-diary-charcoal leading-relaxed font-medium">
                {entry?.analysis 
                  ? "Themes extracted by Claude from this entry:" 
                  : "Start writing to review dynamic themes across your last eight entries."}
              </p>
            </div>

            <div className="flex flex-col gap-3.5 mt-2">
              {getMockedThemes().map((t, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-serif italic font-medium text-diary-charcoal">
                      {t.label}
                    </span>
                    <span className="font-mono text-diary-gray text-[10px]">
                      {t.percentage}%
                    </span>
                  </div>
                  {/* Progress Line */}
                  <div className="h-0.75 w-full bg-diary-border/60 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${t.percentage}%` }} 
                      className="h-full bg-diary-rust/80 rounded-full transition-all duration-1000"
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Mood Tracker */}
          <div className="border-t border-diary-border/80 pt-6 flex flex-col gap-4">
            <div>
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-diary-gray mb-1.5">
                Mood — Entry So Far
              </h4>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-diary-charcoal tracking-tight">
                  {currentMood.score}
                </span>
                <span className="text-xs text-diary-gray font-mono">/ 10</span>
                <span className="text-xs text-diary-gray font-medium tracking-tight ml-1 font-mono">
                  · {currentMood.text}
                </span>
              </div>
            </div>

            {/* Dynamic Colored Badges */}
            {entry?.analysis?.mood ? (
              <div className="flex flex-wrap gap-2 select-none">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 border border-rose-200 bg-rose-50 text-rose-700 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  {entry.analysis.mood}
                </span>
                {entry.analysis.themes?.map((t, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 border border-diary-border bg-[#FDFCF7] text-diary-charcoal rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-diary-gray"></span>
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs italic text-diary-gray font-serif">
                Mood tags will appear once changes are saved.
              </div>
            )}
          </div>

          {/* Section: Stall Prompt */}
          <div className="border-t border-diary-border/80 pt-6 flex flex-col gap-2 mt-auto">
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-diary-gray">
              A Prompt, If You Stall
            </h4>
            <p className="font-serif italic text-[13px] text-diary-charcoal leading-relaxed mt-1">
              {entry?.analysis?.followUpQuestion 
                ? `"${entry.analysis.followUpQuestion}"` 
                : `"What is a micro-moment from today that made you slow down, even for a second?"`}
            </p>
            <span className="text-[9px] font-mono text-diary-gray mt-2 tracking-wide select-none">
              generated from your patterns
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
