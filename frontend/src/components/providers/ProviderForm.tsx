"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Server, Key, BrainCircuit, X } from "lucide-react";

interface ProviderFormProps {
  onSuccess: (configId: string) => void;
  onCancel: () => void;
}

export default function ProviderForm({ onSuccess, onCancel }: ProviderFormProps) {
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gpt-4o");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);

  const presetConfigs = [
    { name: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o" },
    { name: "Groq", url: "https://api.groq.com/openai/v1", model: "llama3-70b-8192" },
    { name: "LM Studio", url: "http://localhost:1234/v1", model: "local-model" },
    { name: "Ollama", url: "http://localhost:11434/v1", model: "llama3" },
  ];

  const handlePreset = (preset: typeof presetConfigs[0]) => {
    setBaseUrl(preset.url);
    setModelName(preset.model);
    if (preset.name === "LM Studio" || preset.name === "Ollama") {
      setApiKey("not-needed");
    } else {
      setApiKey("");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestSuccess(false);
    try {
      await api.post("/ai-provider-configs/test", {
        name: presetConfigs.find(p => p.url === baseUrl)?.name || "Custom",
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName
      });
      setTestSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to connect to provider");
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testSuccess) return;

    setLoading(true);
    setError(null);
    try {
      // Post to backend
      const res = await api.post<{ id: string }>("/ai-provider-configs", {
        name: presetConfigs.find(p => p.url === baseUrl)?.name || "Custom",
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName
      });
      onSuccess(res.id);
    } catch (err: any) {
      setError(err.message || "Failed to save configuration");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-zinc-50 tracking-tight">AI Provider Configuration</h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {presetConfigs.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePreset(preset)}
              type="button"
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-white/10 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors whitespace-nowrap"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-text flex items-center gap-2">
              <Server className="w-4 h-4 text-zinc-500" /> API Base URL
            </label>
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setTestSuccess(false); }}
              className="input-field"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div>
            <label className="label-text flex items-center gap-2">
              <Key className="w-4 h-4 text-zinc-500" /> API Key
            </label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestSuccess(false); }}
              className="input-field font-mono"
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className="label-text flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-zinc-500" /> Model Name
            </label>
            <input
              type="text"
              required
              value={modelName}
              onChange={(e) => { setModelName(e.target.value); setTestSuccess(false); }}
              className="input-field"
              placeholder="gpt-4o"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}

          {testSuccess && !error && (
            <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              Connection successful! Ready to save.
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !baseUrl || !apiKey || !modelName}
              className="btn-secondary flex-1 flex justify-center items-center"
            >
              {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Test Connection"}
            </button>
            
            <button
              type="submit"
              disabled={loading || !testSuccess}
              className="btn-primary flex-1 flex justify-center items-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Config"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
