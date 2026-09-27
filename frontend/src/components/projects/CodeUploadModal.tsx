"use client";

import { useState, useRef } from "react";
import { X, UploadCloud, FileArchive, Loader2, Github } from "lucide-react";
import { api } from "@/lib/api";

interface CodeUploadModalProps {
  projectId: string;
  initialMode?: 'zip' | 'github' | 'files';
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CodeUploadModal({ projectId, initialMode = 'github', onSuccess, onCancel }: CodeUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [mode, setMode] = useState<'zip' | 'github' | 'files'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith(".zip")) {
        setError("Please select a .zip file");
        return;
      }
      if (selected.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MB limit");
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleMultiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(f => f.size <= 50 * 1024 * 1024);
      if (validFiles.length < selectedFiles.length) {
        setError("Some files exceed the 50MB limit and were skipped.");
      } else {
        setError(null);
      }
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    
    // We cannot use our api.post wrapper easily here because it sets Content-Type to application/json
    // We need multipart/form-data for files. We will use native fetch.
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      
      // Simulate progress since fetch doesn't have native upload progress without XHR
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 200);

      const res = await fetch(`${API_BASE}/projects/${projectId}/upload`, {
        method: "POST",
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: formData
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      setTimeout(() => {
        onSuccess();
      }, 500);

    } catch (err: any) {
      setError(err.message || "Failed to upload codebase");
      setLoading(false);
      setProgress(0);
    }
  };

  const handleFilesUpload = async () => {
    if (files.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 200);

      const res = await fetch(`${API_BASE}/projects/${projectId}/upload-files`, {
        method: "POST",
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: formData
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      setTimeout(() => {
        onSuccess();
      }, 500);

    } catch (err: any) {
      setError(err.message || "Failed to upload files");
      setLoading(false);
      setProgress(0);
    }
  };

  const handleGithubImport = async () => {
    if (!githubUrl) return;
    setLoading(true);
    setError(null);
    try {
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 95));
      }, 500);
      
      await api.post(`/projects/${projectId}/github`, { github_url: githubUrl });
      
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Failed to import from GitHub");
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-zinc-50 tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-400" /> Upload Codebase
          </h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-zinc-900/50 rounded-lg border border-white/5">
          <button
            onClick={() => setMode('zip')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'zip' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <FileArchive className="w-3.5 h-3.5" /> ZIP File
          </button>
          <button
            onClick={() => setMode('files')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'files' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" /> Files
          </button>
          <button
            onClick={() => setMode('github')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'github' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <Github className="w-3.5 h-3.5" /> GitHub
          </button>
        </div>

        <div className="space-y-6">
          {mode === 'github' ? (
            <div className="space-y-2">
              <label className="label-text">GitHub Repository URL</label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                className="input-field"
                disabled={loading}
              />
              <p className="text-xs text-zinc-500">Public repositories only (for now). Uses shallow clone for speed.</p>
            </div>
          ) : mode === 'files' ? (
            <div className="space-y-4">
              <div 
                onClick={() => multiFileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700/50 hover:border-sky-500/50 bg-zinc-900/30 rounded-xl p-8 text-center cursor-pointer transition-colors group"
              >
                <input 
                  type="file" 
                  ref={multiFileInputRef} 
                  onChange={handleMultiFileChange} 
                  multiple
                  className="hidden" 
                />
                <UploadCloud className="w-10 h-10 text-zinc-600 group-hover:text-sky-400 mx-auto mb-4 transition-colors" />
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Click to select files</h3>
                <p className="text-xs text-zinc-500">You can select multiple files at once.</p>
              </div>
              
              {files.length > 0 && (
                <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 max-h-40 overflow-y-auto space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-zinc-300">{files.length} files selected</span>
                    <button 
                      onClick={() => setFiles([])} 
                      className="text-xs text-zinc-500 hover:text-red-400"
                    >
                      Clear all
                    </button>
                  </div>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-t border-white/5 first:border-0">
                      <span className="text-zinc-400 truncate pr-4">{f.name}</span>
                      <button 
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                        className="text-zinc-500 hover:text-red-400 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700/50 hover:border-sky-500/50 bg-zinc-900/30 rounded-xl p-8 text-center cursor-pointer transition-colors group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".zip" 
                className="hidden" 
              />
              <FileArchive className="w-10 h-10 text-zinc-600 group-hover:text-sky-400 mx-auto mb-4 transition-colors" />
              <h3 className="text-sm font-medium text-zinc-300 mb-1">Click to select a ZIP file</h3>
              <p className="text-xs text-zinc-500">Max size: 50MB. Ignored: node_modules, .git, etc.</p>
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                  <FileArchive className="w-5 h-5 text-sky-400" />
                </div>
                <div className="truncate">
                  <p className="text-sm font-medium text-zinc-200 truncate">{file.name}</p>
                  <p className="text-xs text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              </div>
              {!loading && (
                <button 
                  onClick={() => setFile(null)} 
                  className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Uploading & Extracting...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={mode === 'github' ? handleGithubImport : mode === 'files' ? handleFilesUpload : handleUpload}
              disabled={loading || (mode === 'zip' && !file) || (mode === 'github' && !githubUrl) || (mode === 'files' && files.length === 0)}
              className="btn-primary flex-1 flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing
                </>
              ) : (
                mode === 'github' ? "Import Repository" : "Upload & Analyze"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
