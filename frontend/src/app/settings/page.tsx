"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { ShieldCheck, HardDrive, Cloud, Key, Check } from "lucide-react";

interface ConfigResponse {
  active: {
    provider: string;
    model: string;
    privacy: "local" | "cloud";
    hasCustomKey: boolean;
  };
  available: Record<string, string[]>;
  privacyTiers: Record<string, "local" | "cloud">;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigResponse | null>(null);

  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState<"ok" | "error">("ok");

  useEffect(() => {
    const token = localStorage.getItem("dg_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data: ConfigResponse = await res.json();
          setConfig(data);
          setSelectedProvider(data.active.provider);
          setSelectedModel(data.active.model);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg("");
    const token = localStorage.getItem("dg_token");

    try {
      const payload: Record<string, any> = {
        provider: selectedProvider,
        model: selectedModel
      };
      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }

      const res = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setStatusType("ok");
        setStatusMsg(
          data.privacy === "local"
            ? "✓ Configuration saved — running fully local. Zero data leaves your machine."
            : `✓ Configuration saved — active model set to ${data.provider} (${data.model}).`
        );
        // Reset password input
        setApiKey("");
        
        // Refresh config context
        setConfig((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            active: {
              provider: selectedProvider,
              model: selectedModel,
              privacy: data.privacy,
              hasCustomKey: apiKey.trim() ? true : prev.active.hasCustomKey
            }
          };
        });
      } else {
        throw new Error(data.error || "Failed to update LLM configuration.");
      }
    } catch (err: any) {
      setStatusType("error");
      setStatusMsg(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const getPrivacyTier = (p: string) => {
    return config?.privacyTiers[p] || "local";
  };

  const getAvailableModels = (p: string) => {
    return config?.available[p] || [];
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-diary-cream select-none items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-diary-rust border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-diary-gray">Loading models config...</span>
        </div>
      </div>
    );
  }

  const providers = Object.keys(config?.available || {});
  const localProviders = providers.filter((p) => getPrivacyTier(p) === "local");
  const cloudProviders = providers.filter((p) => getPrivacyTier(p) === "cloud");
  const isCloudSelected = getPrivacyTier(selectedProvider) === "cloud";

  return (
    <div className="flex h-screen overflow-hidden bg-diary-cream font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
        {/* Editorial Header */}
        <div className="border-b border-diary-border/80 pb-6 mb-8">
          <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-diary-gray mb-1.5">
            Vol. IV — System Settings
          </div>
          <h1 className="font-serif text-3xl font-bold text-diary-charcoal">
            Model Configuration
          </h1>
          <p className="text-xs text-diary-gray font-mono mt-1">
            Choose how DiaryGPT reasons — and determine who has access to your data.
          </p>
        </div>

        {/* Settings Panel Grid */}
        <div className="flex flex-col gap-8 pb-20 select-none">
          {/* Section 1: Local Mode */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-diary-charcoal flex items-center gap-2">
              🟢 Local Mode
              <span className="text-[10px] font-mono font-medium tracking-normal text-diary-green bg-green-50 border border-green-200 px-2 py-0.5 rounded-full uppercase">
                Zero data leaves this device
              </span>
            </h2>
            <p className="text-xs text-diary-gray leading-relaxed mb-1">
              Uses Ollama running locally. No external APIs, internet connection, or subscription required. Your diary is completely private.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localProviders.map((prov) => {
                const isActive = selectedProvider === prov;
                return (
                  <div
                    key={prov}
                    onClick={() => {
                      setSelectedProvider(prov);
                      setSelectedModel(getAvailableModels(prov)[0] || "");
                    }}
                    className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-3 cursor-pointer ${
                      isActive
                        ? "bg-[#FAF8F3] border-diary-rust ring-1 ring-diary-rust/20 shadow-sm"
                        : "bg-[#FAF8F3]/40 border-diary-border hover:bg-[#FAF8F3]/70"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="provider"
                          checked={isActive}
                          onChange={() => {}} // Controlled click handles this
                          className="accent-diary-rust"
                        />
                        <span className="font-serif text-lg font-bold text-diary-charcoal uppercase">{prov}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-diary-green flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5" />
                        ON-DEVICE
                      </span>
                    </div>

                    {isActive && (
                      <div className="flex flex-col gap-1.5 mt-1 select-text" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[9px] font-mono text-diary-gray uppercase font-bold tracking-wider">
                          Active local Model
                        </label>
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full text-xs py-2 px-3 bg-diary-cream border border-diary-border rounded-xl text-diary-charcoal focus:outline-none focus:border-diary-rust"
                        >
                          {getAvailableModels(prov).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Cloud Mode */}
          <div className="flex flex-col gap-3 border-t border-diary-border/80 pt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-diary-charcoal flex items-center gap-2">
              🟡 Cloud Mode
              <span className="text-[10px] font-mono font-medium tracking-normal text-diary-amber bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase">
                Opt-in · Bring Your Own Key
              </span>
            </h2>
            <p className="text-xs text-diary-gray leading-relaxed mb-1">
              Higher reasoning, deeper therapeutic responses, and faster performance. When active, only the relevant segments of your journal are sent to the provider&apos;s API.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cloudProviders.map((prov) => {
                const isActive = selectedProvider === prov;
                return (
                  <div
                    key={prov}
                    onClick={() => {
                      setSelectedProvider(prov);
                      setSelectedModel(getAvailableModels(prov)[0] || "");
                    }}
                    className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-3 cursor-pointer ${
                      isActive
                        ? "bg-[#FAF8F3] border-diary-rust ring-1 ring-diary-rust/20 shadow-sm"
                        : "bg-[#FAF8F3]/40 border-diary-border hover:bg-[#FAF8F3]/70"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="provider"
                          checked={isActive}
                          onChange={() => {}}
                          className="accent-diary-rust"
                        />
                        <span className="font-serif text-lg font-bold text-diary-charcoal uppercase">{prov}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-diary-amber flex items-center gap-1">
                        <Cloud className="w-3.5 h-3.5" />
                        SECURE CLOUD
                      </span>
                    </div>

                    {isActive && (
                      <div className="flex flex-col gap-1.5 mt-1 select-text" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[9px] font-mono text-diary-gray uppercase font-bold tracking-wider">
                          Active API Model
                        </label>
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full text-xs py-2 px-3 bg-diary-cream border border-diary-border rounded-xl text-diary-charcoal focus:outline-none focus:border-diary-rust"
                        >
                          {getAvailableModels(prov).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cloud API Key Wrapper */}
            {isCloudSelected && (
              <div className="mt-4 p-5 rounded-2xl border border-diary-border bg-[#FAF8F3] flex flex-col gap-3 select-text fade-in max-w-lg">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-diary-gray uppercase tracking-widest">
                  <Key className="w-4 h-4 text-diary-rust" />
                  <span>API Key for {selectedProvider.toUpperCase()}</span>
                </div>
                
                <input
                  type="password"
                  placeholder={config?.active.hasCustomKey && selectedProvider === config.active.provider ? "•••••••••••••••• (Saved — paste new key to replace)" : "Paste your private API key here"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-diary-cream border border-diary-border rounded-xl text-xs focus:outline-none focus:border-diary-rust placeholder-diary-gray/40"
                  autoComplete="off"
                />
                <p className="text-[10px] font-mono text-diary-gray leading-relaxed">
                  Keys are stored securely on your local server environment and are never transmitted to any third-party indexing services.
                </p>
              </div>
            )}
          </div>

          {/* Alert Status Feedback */}
          {statusMsg && (
            <div className={`p-4 rounded-2xl border text-xs font-mono fade-in max-w-lg ${
              statusType === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {statusMsg}
            </div>
          )}

          {/* Action Trigger Save Button */}
          <div className="mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-diary-charcoal hover:bg-diary-charcoal/95 active:scale-[0.99] disabled:opacity-50 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-md transition-all cursor-pointer flex justify-center items-center gap-1.5"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save system configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
