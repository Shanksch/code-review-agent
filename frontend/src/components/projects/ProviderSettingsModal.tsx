import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Eye, EyeOff, Save, Check, X } from 'lucide-react';
import { api } from '@/lib/api';

interface ProviderSettingsModalProps {
  projectId: string;
  currentConfigId: string | null;
  configs: any[];
  stats?: any;
  onClose: () => void;
  onSave: (configId: string, updatedConfig: any) => void;
}

const PRESETS = {
  OpenAI: 'https://api.openai.com/v1',
  Groq: 'https://api.groq.com/openai/v1',
  'LM Studio': 'http://localhost:1234/v1',
  Ollama: 'http://localhost:11434/v1',
  Custom: ''
};

export default function ProviderSettingsModal({ projectId, currentConfigId, configs, stats, onClose, onSave }: ProviderSettingsModalProps) {
  const [selectedConfigId, setSelectedConfigId] = useState(currentConfigId);
  const [preset, setPreset] = useState('Custom');
  
  const [name, setName] = useState('My Provider');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{status: string, message: string} | null>(null);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (selectedConfigId) {
      const config = configs.find(c => c.id === selectedConfigId);
      if (config) {
        setName(config.name || 'My Provider');
        setBaseUrl(config.base_url || '');
        setApiKey(config.api_key || '');
        setModelName(config.model_name || '');
        setTemperature(config.temperature ?? 0.7);
        setMaxTokens(config.max_tokens ?? 2048);
        setLastTestedAt(config.last_tested_at || null);
        
        // Infer preset
        const matchedPreset = Object.entries(PRESETS).find(([k, v]) => v === config.base_url);
        if (matchedPreset) {
          setPreset(matchedPreset[0]);
        } else {
          setPreset('Custom');
        }
      }
    }
  }, [selectedConfigId, configs]);

  const handlePresetSelect = (p: string) => {
    setPreset(p);
    if (p !== 'Custom') {
      setBaseUrl(PRESETS[p as keyof typeof PRESETS]);
    }
  };

  const handleTest = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      if (selectedConfigId) {
        // Update first, then test
        await api.patch(`/ai-provider-configs/${selectedConfigId}`, {
          name, base_url: baseUrl, api_key: apiKey, model_name: modelName,
          temperature, max_tokens: maxTokens
        });
        await api.post(`/ai-provider-configs/${selectedConfigId}/test`, {});
      } else {
        // Just test without saving
        await api.post(`/ai-provider-configs/test`, {
          name, base_url: baseUrl, api_key: apiKey, model_name: modelName
        });
      }
      setTestResult({ status: 'success', message: 'Connection successful' });
      setLastTestedAt(new Date().toISOString());
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message || 'Connection failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let configId = selectedConfigId;
      if (configId) {
        const res = await api.patch(`/ai-provider-configs/${configId}`, {
          name, base_url: baseUrl, api_key: apiKey, model_name: modelName,
          temperature, max_tokens: maxTokens
        });
        await api.patch(`/projects/${projectId}`, { ai_provider_config_id: configId });
        onSave(configId, res);
      } else {
        // Create new config
        const res = await api.post(`/ai-provider-configs`, {
          name, base_url: baseUrl, api_key: apiKey, model_name: modelName
        });
        configId = res.id;
        // Optionally update other fields if backend create doesn't support them yet
        await api.patch(`/ai-provider-configs/${configId}`, {
          temperature, max_tokens: maxTokens
        });
        await api.patch(`/projects/${projectId}`, { ai_provider_config_id: configId });
        onSave(configId, { ...res, temperature, max_tokens: maxTokens });
      }
      onClose();
    } catch (err: any) {
      alert("Failed to save settings: " + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="card w-full max-w-2xl p-0 animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-zinc-900/50">
          <h2 className="text-xl font-semibold text-zinc-50 tracking-tight">AI Provider Settings</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preset Selector */}
          <div>
            <label className="label-text mb-2 block">Provider Preset</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESETS).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePresetSelect(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${
                    preset === p 
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' 
                      : 'bg-zinc-800 text-zinc-400 border-white/5 hover:bg-zinc-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Provider Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="input-field mt-1" 
                placeholder="My Custom Provider"
              />
            </div>
            <div>
              <label className="label-text">Base URL</label>
              <input 
                type="text" 
                value={baseUrl} 
                onChange={e => setBaseUrl(e.target.value)} 
                disabled={preset !== 'Custom'}
                className={`input-field mt-1 ${preset !== 'Custom' ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>

          <div>
            <label className="label-text">API Key</label>
            <div className="relative mt-1">
              <input 
                type={showApiKey ? 'text' : 'password'}
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
                className="input-field pr-10" 
                placeholder="sk-..."
              />
              <button 
                type="button" 
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label-text block">Model Name</label>
            <div className="text-xs text-zinc-500 mb-2">Specify the exact model identifier (e.g. gpt-4o, llama3). Make sure it matches what your provider expects.</div>
            <input 
              type="text" 
              value={modelName} 
              onChange={e => setModelName(e.target.value)} 
              className="input-field"
              placeholder="gpt-4o"
            />
          </div>

          {/* Advanced Settings */}
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 bg-zinc-900/50 flex justify-between items-center hover:bg-zinc-800 transition-colors"
            >
              <span className="text-sm font-medium text-zinc-300">Advanced Settings</span>
              <svg className={`w-4 h-4 text-zinc-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showAdvanced && (
              <div className="p-4 bg-zinc-950 space-y-4 border-t border-white/5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-zinc-400 font-medium">Temperature: {temperature}</label>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="2" step="0.1" 
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                    <span>Precise (0)</span>
                    <span>Creative (2)</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-zinc-400 font-medium">Max Tokens: {maxTokens}</label>
                  </div>
                  <input 
                    type="range" 
                    min="256" max="8192" step="256" 
                    value={maxTokens}
                    onChange={e => setMaxTokens(parseInt(e.target.value))}
                    className="w-full accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                    <span>Short (256)</span>
                    <span>Long (8192)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Code Analysis Section (from Sprint 6) */}
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 bg-zinc-900/50 flex justify-between items-center border-b border-white/5">
              <span className="text-sm font-medium text-zinc-300">Code Analysis</span>
            </div>
            <div className="p-4 bg-zinc-950 space-y-4">
              <div className="text-xs text-zinc-500 mb-2">
                This project was imported using default analysis settings.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Included Extensions</div>
                  <div className="text-sm text-zinc-300 font-mono">
                    {stats?.included_extensions?.join(", ") || ".ts, .tsx, .js, .jsx, .py, .go, .rs"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Excluded Patterns</div>
                  <div className="text-sm text-zinc-300 font-mono">
                    {stats?.excluded_patterns?.join(", ") || "node_modules/, .git/, dist/, build/, __pycache__/, *.lock"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 text-xs text-zinc-400">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {stats?.total_files || 0} source files &middot; {stats?.total_lines || 0} lines &middot; ~{Math.round((stats?.total_lines || 0) * 3.5)} estimated tokens
                </span>
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="p-4 rounded-lg border border-white/5 bg-zinc-900/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleTest}
                disabled={testingConnection || (!selectedConfigId && !baseUrl)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-2"
              >
                {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Test Connection
              </button>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-sm">
                  {testResult ? (
                    <>
                      <div className={`w-2 h-2 rounded-full ${testResult.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <span className={testResult.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                        {testResult.status === 'success' ? 'Connected' : 'Connection failed'}
                      </span>
                    </>
                  ) : lastTestedAt ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
                      <span className="text-zinc-400">Previous test successful</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                      <span className="text-zinc-500">Not tested</span>
                    </>
                  )}
                </div>
                {lastTestedAt && (
                  <div className="text-[10px] text-zinc-500 ml-4">
                    Last tested: {new Date(lastTestedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            
            {testResult && testResult.status === 'error' && (
              <div className="text-xs text-red-400 max-w-[200px] truncate" title={testResult.message}>
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex gap-3 justify-end shrink-0 bg-zinc-900/50">
          <button type="button" onClick={onClose} className="btn-secondary px-6">
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-6 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
