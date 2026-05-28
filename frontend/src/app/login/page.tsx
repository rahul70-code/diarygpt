"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to home immediately
  useEffect(() => {
    const token = localStorage.getItem("dg_token");
    if (token) {
      router.push("/");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    
    if (!email.trim() || !password) {
      setErrorMsg("Please fill in all credentials.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      // Save token and credentials
      localStorage.setItem("dg_token", data.token);
      localStorage.setItem("dg_user", JSON.stringify(data.user));
      
      // Navigate to homepage
      router.push("/");
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-diary-cream flex items-center justify-center p-6 relative font-sans select-none overflow-hidden">
      {/* Background visual detail */}
      <div className="absolute inset-0 bg-[radial-gradient(#C2410C_1px,transparent_1px)] [background-size:24px_24px] opacity-10 select-none pointer-events-none"></div>

      <div className="w-full max-w-[420px] bg-[#FAF8F3] border border-diary-border p-8 rounded-3xl shadow-sm z-10 fade-in">
        {/* Editorial Brand Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-diary-charcoal mb-2">
            Diary<span className="text-diary-rust">gpt</span>
          </h1>
          <p className="text-diary-gray text-xs font-mono tracking-widest uppercase">
            Vol. IV — A Private Journal, Kept Honestly
          </p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-1 bg-diary-cream p-1 rounded-xl border border-diary-border mb-6">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setErrorMsg(""); }}
            className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              isLogin 
                ? "bg-[#FAF8F3] text-diary-rust border border-diary-border/30 shadow-sm" 
                : "text-diary-gray hover:text-diary-charcoal"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setErrorMsg(""); }}
            className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              !isLogin 
                ? "bg-[#FAF8F3] text-diary-rust border border-diary-border/30 shadow-sm" 
                : "text-diary-gray hover:text-diary-charcoal"
            }`}
          >
            Register
          </button>
        </div>

        {/* Alert Messages */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono leading-relaxed">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-bold tracking-widest uppercase text-diary-gray px-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 w-4 h-4 text-diary-gray/70" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 bg-diary-cream border border-diary-border rounded-xl text-sm text-diary-charcoal focus:outline-none focus:border-diary-rust/60 focus:ring-1 focus:ring-diary-rust/20 placeholder-diary-gray/50 transition-all font-sans"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-bold tracking-widest uppercase text-diary-gray px-1">
              Secret Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 w-4 h-4 text-diary-gray/70" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="w-full pl-10 pr-4 py-2.5 bg-diary-cream border border-diary-border rounded-xl text-sm text-diary-charcoal focus:outline-none focus:border-diary-rust/60 focus:ring-1 focus:ring-diary-rust/20 placeholder-diary-gray/50 transition-all font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-diary-charcoal hover:bg-diary-charcoal/95 active:scale-[0.99] disabled:opacity-50 text-white rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-diary-charcoal/15 cursor-pointer flex justify-center items-center"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : isLogin ? (
              "Sign In to Diary"
            ) : (
              "Create Private Volume"
            )}
          </button>
        </form>

        {/* Footer Encrypted Notice */}
        <div className="mt-8 border-t border-diary-border/50 pt-4 flex items-center justify-center gap-1.5 text-[10px] font-mono text-diary-gray select-none">
          <ShieldCheck className="w-3.5 h-3.5 text-diary-green" />
          <span>AES-256-GCM encrypted database context</span>
        </div>
      </div>
    </div>
  );
}
