"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { 
  HeartHandshake, 
  MessageCircle, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Mic, 
  Square, 
  Send 
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  created_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  crisis?: boolean;
}

export default function CompanionPage() {
  const router = useRouter();

  // Sessions & Active State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Mood check-in State
  const [showMoodMeter, setShowMoodMeter] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  // Chat State
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  
  // Voice Dictation
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("dg_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/therapy/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const list = await res.json();
          setSessions(list);
          if (list.length > 0) {
            // Load most recent session by default
            loadSession(list[0], token);
          } else {
            // Show mood meter for new session
            setShowMoodMeter(true);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchSessions();
  }, [router]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Text-To-Speech engine
  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  };

  // Load a past session's messages
  const loadSession = async (session: Session, token: string) => {
    setLoading(true);
    setActiveSession(session);
    setShowMoodMeter(false);

    try {
      const res = await fetch(`/api/therapy/sessions/${session.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setMessages(list);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Start a fresh therapy session
  const startNewSession = () => {
    setActiveSession(null);
    setMessages([]);
    setShowMoodMeter(true);
  };

  // Handle Mood log submission
  const handleMoodSubmit = async (score: number) => {
    setSelectedMood(score);
    const token = localStorage.getItem("dg_token");

    try {
      await fetch("/api/therapy/mood", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ score })
      });
      
      // Briefly delay to show selection feedback
      setTimeout(() => {
        setShowMoodMeter(false);
      }, 500);
    } catch (err) {
      console.error(err);
    }
  };

  // SSE Send message streaming
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || streaming) return;

    const message = input.trim();
    setInput("");
    setStreaming(true);

    const token = localStorage.getItem("dg_token");

    // Add user message to state
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    
    // Add dummy AI message to receive stream
    const aiMessageIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/therapy/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message, sessionId: activeSession?.id })
      });

      if (!res.ok) {
        throw new Error("Failed to reach AI companion.");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponseText = "";
      let isCrisis = false;

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              fullResponseText += data.delta;
              setMessages((prev) => {
                const next = [...prev];
                if (next[aiMessageIndex]) {
                  next[aiMessageIndex].content = fullResponseText;
                }
                return next;
              });
            }
            if (data.crisis) {
              isCrisis = true;
              setMessages((prev) => {
                const next = [...prev];
                if (next[aiMessageIndex]) {
                  next[aiMessageIndex].crisis = true;
                }
                return next;
              });
            }
            if (data.done && data.sessionId) {
              // If it's a new session, update active state and list
              if (!activeSession) {
                const freshSession = {
                  id: data.sessionId,
                  title: message.length > 30 ? message.slice(0, 27) + "..." : message,
                  created_at: new Date().toISOString()
                };
                setActiveSession(freshSession);
                setSessions((prev) => [freshSession, ...prev]);
              }
            }
          } catch (e) {
            // Ignore incomplete JSON chunks
          }
        }
      }

      // Speak response aloud if not crisis warning (which is text heavy list)
      if (fullResponseText && !isCrisis) {
        speakText(fullResponseText);
      }
    } catch (err: any) {
      setMessages((prev) => {
        const next = [...prev];
        if (next[aiMessageIndex]) {
          next[aiMessageIndex].content = `Error: ${err.message || "Failed to stream thoughts."}`;
        }
        return next;
      });
    } finally {
      setStreaming(false);
    }
  };

  // Local browser mic transcription
  const startMicDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsDictating(true);
    };

    rec.onresult = (e: any) => {
      const interim = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setInput(interim);
    };

    rec.onend = () => {
      setIsDictating(false);
      // Auto-send once silent
      if (input.trim()) {
        handleSendMessage();
      }
    };

    rec.start();
    recognitionRef.current = rec;
  };

  const stopMicDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsDictating(false);
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-diary-cream font-sans">
      <Sidebar />

      <main className="flex-1 overflow-hidden flex flex-col relative max-w-5xl mx-auto w-full border-r border-diary-border">
        {/* Safety Warning Disclosure Banner */}
        <div className="bg-[#FAF8F3] border-b border-diary-border p-4 text-[11px] leading-relaxed text-diary-charcoal font-medium select-none flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 text-diary-rust shrink-0 mt-0.5" />
          <div>
            ⚠️ <strong>AI Emotional Support Space</strong> — This companion is powered by custom CBT thought-reframing prompts. It is <strong>not</strong> a licensed therapist or crisis handler. If you are experiencing distress, please connect with live support at <a href="https://findahelpline.com" target="_blank" rel="noopener" className="underline text-diary-rust">findahelpline.com</a> or text <strong>988</strong> (US).
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* SESSIONS HISTORY SIDEBAR */}
          <div className="w-56 border-r border-diary-border bg-[#FAF8F3]/50 flex flex-col shrink-0 select-none">
            <div className="p-4 border-b border-diary-border flex justify-between items-center bg-[#FAF8F3]">
              <span className="text-[10px] font-mono font-bold tracking-widest text-diary-gray uppercase">
                Coach Logs
              </span>
              <button
                onClick={startNewSession}
                className="px-2.5 py-1 border border-diary-border hover:bg-diary-cream rounded-md text-[10px] font-bold text-diary-charcoal cursor-pointer transition-all"
              >
                + New
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
              {sessions.length === 0 ? (
                <span className="text-[11px] font-serif italic text-diary-gray p-3 text-center">
                  No sessions logged yet
                </span>
              ) : (
                sessions.map((s) => {
                  const isActive = activeSession?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s, localStorage.getItem("dg_token") || "")}
                      className={`w-full text-left p-2.5 rounded-lg text-xs truncate transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#FAF8F3] text-diary-rust font-semibold border border-diary-border/30 shadow-sm"
                          : "text-diary-charcoal/80 hover:bg-[#FAF8F3]/60"
                      }`}
                    >
                      <div className="truncate mb-0.5">{s.title || "Reflective log"}</div>
                      <div className="text-[9px] font-mono text-diary-gray font-normal">{formatDate(s.created_at)}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ACTIVE REFLECTIVE CHAT SPACE */}
          <div className="flex-1 flex flex-col bg-[#FDFCF7]">
            {/* Header control bar */}
            <div className="p-4 border-b border-diary-border flex justify-between items-center bg-[#FAF8F3]/40 select-none">
              <span className="font-serif text-sm font-bold text-diary-charcoal">
                {activeSession?.title || "New reflective session"}
              </span>

              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full border text-[10px] font-bold font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  ttsEnabled
                    ? "bg-[#FAF8F3] border-diary-rust text-diary-rust shadow-sm"
                    : "border-diary-border text-diary-gray hover:bg-[#FAF8F3]/50"
                }`}
              >
                {ttsEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Voice On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Voice Off</span>
                  </>
                )}
              </button>
            </div>

            {/* CHAT CHANNELS DISPLAY */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              
              {/* CBT Sliding check-in meter */}
              {showMoodMeter && (
                <div className="p-6 rounded-2xl border border-diary-border bg-[#FAF8F3] text-center max-w-md mx-auto my-4 shadow-sm fade-in select-none">
                  <h4 className="font-serif text-base font-bold text-diary-charcoal mb-1">
                    How are you feeling right now?
                  </h4>
                  <p className="text-[10px] font-mono text-diary-gray uppercase tracking-widest mb-4">
                    Reflective Thought check-in
                  </p>

                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                      const isSelected = selectedMood === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleMoodSubmit(num)}
                          className={`py-2 rounded-xl text-sm font-mono font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? "bg-diary-rust border-diary-rust text-white shadow-md shadow-diary-rust/20 scale-105"
                              : "bg-diary-cream border-diary-border hover:bg-[#FAF8F3] text-diary-charcoal"
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="flex justify-between font-mono text-[9px] text-diary-gray font-bold tracking-wider uppercase px-1">
                    <span>Struggling</span>
                    <span>Doing Great</span>
                  </div>
                </div>
              )}

              {/* Welcome Screen if empty */}
              {!loading && messages.length === 0 && !showMoodMeter && (
                <div className="my-auto text-center max-w-sm mx-auto select-none fade-in">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-diary-rust flex items-center justify-center mx-auto mb-4">
                    <HeartHandshake className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-diary-charcoal mb-2">
                    Your Safe Space to Reflect
                  </h3>
                  <p className="text-xs text-diary-gray leading-relaxed">
                    Share what is currently on your mind. I am here to listen without judgment, guide you through distress tolerance exercises, and help reframe negative patterns.
                  </p>
                </div>
              )}

              {/* Stream messages */}
              {messages.map((m, idx) => {
                const isAI = m.role === "assistant";
                return (
                  <div
                    key={idx}
                    className={`flex ${isAI ? "justify-start" : "justify-end"} fade-in`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed border select-text ${
                        isAI
                          ? m.crisis
                            ? "bg-rose-50 border-rose-200 text-rose-800 font-mono text-xs leading-normal"
                            : "bg-[#FAF8F3] border-diary-border text-diary-charcoal font-serif italic"
                          : "bg-diary-charcoal border-diary-charcoal text-white font-sans"
                      }`}
                    >
                      {/* Emitting HTML compatible spacing */}
                      <p className="whitespace-pre-line">{m.content}</p>
                    </div>
                  </div>
                );
              })}
              
              <div ref={messagesEndRef} />
            </div>

            {/* FLOATING TEXT INPUT BAR */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-diary-border bg-[#FAF8F3] flex gap-2 select-none">
              {isDictating ? (
                <button
                  type="button"
                  onClick={stopMicDictation}
                  className="w-10 h-10 rounded-xl bg-diary-charcoal text-white flex items-center justify-center cursor-pointer hover:bg-diary-charcoal/90 transition-all shrink-0"
                >
                  <Square className="w-4 h-4 fill-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startMicDictation}
                  className="w-10 h-10 rounded-xl border border-diary-border bg-diary-cream text-diary-gray flex items-center justify-center cursor-pointer hover:bg-[#FAF8F3] transition-all shrink-0"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}

              <input
                type="text"
                placeholder={isDictating ? "Listening..." : "Tell your companion how you are doing today..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={streaming}
                className="flex-1 px-4 bg-diary-cream border border-diary-border rounded-xl text-sm text-diary-charcoal focus:outline-none focus:border-diary-rust/60"
              />

              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="w-10 h-10 rounded-xl bg-diary-charcoal hover:bg-diary-charcoal/95 active:scale-[0.98] disabled:opacity-40 text-white flex items-center justify-center cursor-pointer transition-all shrink-0"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
