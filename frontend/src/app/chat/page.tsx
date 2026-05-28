"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { 
  MessageSquare, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Mic, 
  Square, 
  Send 
} from "lucide-react";

interface Session {
  id: string;
  title: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const router = useRouter();

  // Sessions & Conversations list state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Input & Streaming states
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Speech Recognition dictation state
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
        const res = await fetch("/api/chat/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const list = await res.json();
          setSessions(list);
          if (list.length > 0) {
            // Load latest session by default
            loadSession(list[0], token);
          } else {
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

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Text-To-Speech utter synthesis
  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  };

  // Load past session messages
  const loadSession = async (session: Session, token: string) => {
    setLoading(true);
    setActiveSession(session);

    try {
      const res = await fetch(`/api/chat/sessions/${session.id}/messages`, {
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

  // Start new conversation
  const startNewChat = () => {
    setActiveSession(null);
    setMessages([]);
  };

  // SSE Send message streaming
  const handleSendMessage = async (e?: React.FormEvent, customMsg?: string) => {
    e?.preventDefault();
    const message = customMsg || input.trim();
    if (!message || streaming) return;

    setInput("");
    setStreaming(true);

    const token = localStorage.getItem("dg_token");

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    
    // Add placeholder AI message
    const aiMessageIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message, sessionId: activeSession?.id })
      });

      if (!res.ok) {
        throw new Error("Failed to stream response from AI.");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              fullText += data.delta;
              setMessages((prev) => {
                const next = [...prev];
                if (next[aiMessageIndex]) {
                  next[aiMessageIndex].content = fullText;
                }
                return next;
              });
            }
            if (data.done && data.sessionId) {
              if (!activeSession) {
                const freshSession = {
                  id: data.sessionId,
                  title: message.length > 30 ? message.slice(0, 27) + "..." : message
                };
                setActiveSession(freshSession);
                setSessions((prev) => [freshSession, ...prev]);
              }
            }
          } catch (e) {
            // Ignore incomplete chunks
          }
        }
      }

      // Speak answer
      if (fullText) {
        speakText(fullText);
      }
    } catch (err: any) {
      setMessages((prev) => {
        const next = [...prev];
        if (next[aiMessageIndex]) {
          next[aiMessageIndex].content = `Error: ${err.message || "Failed to retrieve embedding context."}`;
        }
        return next;
      });
    } finally {
      setStreaming(false);
    }
  };

  // Local Web Speech Mic
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

  const promptSuggestions = [
    "What patterns do you see in how I handle work stress?",
    "What were my happiest moments from this month?",
    "Summarize my relationship logs and social themes."
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-diary-cream font-sans">
      <Sidebar />

      <main className="flex-1 overflow-hidden flex flex-col relative max-w-5xl mx-auto w-full border-r border-diary-border">
        <div className="flex-1 flex overflow-hidden">
          {/* CONVERSATIONS LIST SIDEBAR */}
          <div className="w-56 border-r border-diary-border bg-[#FAF8F3]/50 flex flex-col shrink-0 select-none">
            <div className="p-4 border-b border-diary-border flex justify-between items-center bg-[#FAF8F3]">
              <span className="text-[10px] font-mono font-bold tracking-widest text-diary-gray uppercase">
                Conversations
              </span>
              <button
                onClick={startNewChat}
                className="px-2.5 py-1 border border-diary-border hover:bg-diary-cream rounded-md text-[10px] font-bold text-diary-charcoal cursor-pointer transition-all"
              >
                + New
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
              {sessions.length === 0 ? (
                <span className="text-[11px] font-serif italic text-diary-gray p-3 text-center">
                  No chats logged yet
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
                      <div className="truncate">{s.title || "RAG conversation"}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ACTIVE CHAT WORKSPACE */}
          <div className="flex-1 flex flex-col bg-[#FDFCF7]">
            {/* Control header */}
            <div className="p-4 border-b border-diary-border flex justify-between items-center bg-[#FAF8F3]/40 select-none">
              <span className="font-serif text-sm font-bold text-diary-charcoal">
                {activeSession?.title || "New RAG conversation"}
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

            {/* MESSAGE CHANNELS */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {/* Suggestions welcome card if empty */}
              {!loading && messages.length === 0 && (
                <div className="my-auto text-center max-w-md mx-auto select-none fade-in flex flex-col gap-6">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-diary-rust flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="font-serif text-lg font-bold text-diary-charcoal mb-2">
                      Query Your Personal Volume
                    </h3>
                    <p className="text-xs text-diary-gray leading-relaxed max-w-sm mx-auto">
                      Ask open-ended questions about your past, look for recurring habits, or check emotional progress. The AI will cite only your relevant journal logs.
                    </p>
                  </div>

                  {/* Suggestion list */}
                  <div className="flex flex-col gap-2 select-text">
                    {promptSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(undefined, s)}
                        className="w-full text-left p-3.5 rounded-xl border border-diary-border bg-[#FAF8F3] hover:border-diary-rust/30 hover:bg-[#FAF8F3]/90 text-xs text-diary-charcoal font-medium font-sans flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-diary-rust shrink-0" />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stream messages list */}
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
                          ? "bg-[#FAF8F3] border-diary-border text-diary-charcoal font-serif italic"
                          : "bg-diary-charcoal border-diary-charcoal text-white font-sans"
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.content}</p>
                    </div>
                  </div>
                );
              })}
              
              <div ref={messagesEndRef} />
            </div>

            {/* FLOATING TEXT CHAT INPUT */}
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
                placeholder={isDictating ? "Listening..." : "Ask your diary a question..."}
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
