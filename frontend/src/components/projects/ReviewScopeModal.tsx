"use client";

import { useState } from "react";
import { X, CheckSquare, Square, FileCode, FolderOpen, Play, FileStack } from "lucide-react";
import FileTree, { TreeNode } from "./FileTree";

export interface ReviewOptions {
  scope: "project" | "single_file" | "multi_file";
  fileIds?: string[];
  templateTypes: string[];
  depth?: "quick" | "standard" | "thorough";
}

interface ReviewScopeModalProps {
  currentFileId?: string;
  currentFileName?: string;
  treeData: TreeNode[];
  onRun: (options: ReviewOptions) => void;
  onCancel: () => void;
  loading: boolean;
}

const TEMPLATE_TYPES = [
  { id: "security", label: "Security", default: true },
  { id: "code_quality", label: "Code Quality", default: true },
  { id: "performance", label: "Performance", default: false },
  { id: "tech_debt", label: "Tech Debt", default: false },
  { id: "architecture", label: "Architecture", default: false },
];

export default function ReviewScopeModal({
  currentFileId,
  currentFileName,
  treeData,
  onRun,
  onCancel,
  loading,
}: ReviewScopeModalProps) {
  const [scope, setScope] = useState<"project" | "single_file" | "multi_file">("project");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [depth, setDepth] = useState<"quick" | "standard" | "thorough">("standard");
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
    new Set(TEMPLATE_TYPES.filter((t) => t.default).map((t) => t.id))
  );

  const toggleTemplate = (id: string) => {
    const next = new Set(selectedTemplates);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTemplates(next);
  };

  const handleSelectChange = (id: string, selected: boolean) => {
    setSelectedFileIds(prev => 
      selected ? [...prev, id] : prev.filter(fid => fid !== id)
    );
  };

  const handleRun = () => {
    onRun({
      scope,
      fileIds: scope === "single_file" && currentFileId ? [currentFileId] : scope === "multi_file" ? selectedFileIds : undefined,
      templateTypes: Array.from(selectedTemplates),
      depth
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-zinc-50 tracking-tight flex items-center gap-2">
            <Play className="w-5 h-5 text-sky-400" /> Review Code
          </h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Scope Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Scope</h3>
            <div className="space-y-2">
              <label 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  scope === "project" ? "bg-sky-500/10 border-sky-500/50" : "bg-zinc-900/50 border-white/5 hover:border-white/10"
                }`}
              >
                <input 
                  type="radio" 
                  name="scope" 
                  checked={scope === "project"} 
                  onChange={() => setScope("project")}
                  className="hidden"
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${scope === "project" ? "border-sky-500" : "border-zinc-600"}`}>
                  {scope === "project" && <div className="w-2 h-2 rounded-full bg-sky-500" />}
                </div>
                <FolderOpen className={`w-4 h-4 ${scope === "project" ? "text-sky-400" : "text-zinc-500"}`} />
                <span className={`text-sm font-medium ${scope === "project" ? "text-sky-100" : "text-zinc-300"}`}>Entire Project</span>
              </label>

              <label 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  !currentFileId ? "opacity-50 cursor-not-allowed" :
                  scope === "single_file" ? "bg-sky-500/10 border-sky-500/50" : "bg-zinc-900/50 border-white/5 hover:border-white/10"
                }`}
              >
                <input 
                  type="radio" 
                  name="scope" 
                  checked={scope === "single_file"} 
                  onChange={() => currentFileId && setScope("single_file")}
                  disabled={!currentFileId}
                  className="hidden"
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${scope === "single_file" ? "border-sky-500" : "border-zinc-600"}`}>
                  {scope === "single_file" && <div className="w-2 h-2 rounded-full bg-sky-500" />}
                </div>
                <FileCode className={`w-4 h-4 ${scope === "single_file" ? "text-sky-400" : "text-zinc-500"}`} />
                <span className={`text-sm font-medium ${scope === "single_file" ? "text-sky-100" : "text-zinc-300"}`}>
                  Current file {currentFileName ? `(${currentFileName})` : ""}
                </span>
              </label>

              <label 
                className={`flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  scope === "multi_file" ? "bg-sky-500/10 border-sky-500/50" : "bg-zinc-900/50 border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input 
                    type="radio" 
                    name="scope" 
                    checked={scope === "multi_file"} 
                    onChange={() => setScope("multi_file")}
                    className="hidden"
                  />
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${scope === "multi_file" ? "border-sky-500" : "border-zinc-600"}`}>
                    {scope === "multi_file" && <div className="w-2 h-2 rounded-full bg-sky-500" />}
                  </div>
                  <FileStack className={`w-4 h-4 shrink-0 ${scope === "multi_file" ? "text-sky-400" : "text-zinc-500"}`} />
                  <span className={`text-sm font-medium ${scope === "multi_file" ? "text-sky-100" : "text-zinc-300"}`}>Selected Files</span>
                  {selectedFileIds.length > 0 && scope === "multi_file" && (
                    <span className="ml-auto bg-sky-500/20 text-sky-400 py-0.5 px-2 rounded-full text-xs">
                      {selectedFileIds.length} selected
                    </span>
                  )}
                </div>
                {scope === "multi_file" && (
                  <div className="mt-2 ml-7 bg-zinc-950 border border-white/5 rounded-lg max-h-40 overflow-y-auto">
                    <FileTree
                      data={treeData}
                      onFileSelect={() => {}}
                      selectable={true}
                      selectedIds={selectedFileIds}
                      onSelectChange={handleSelectChange}
                    />
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Review Type</h3>
            <div className="space-y-2">
              {TEMPLATE_TYPES.map((t) => (
                <label 
                  key={t.id}
                  className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="relative flex items-center justify-center" onClick={(e) => { e.preventDefault(); toggleTemplate(t.id); }}>
                    {selectedTemplates.has(t.id) ? (
                      <CheckSquare className="w-5 h-5 text-sky-500" />
                    ) : (
                      <Square className="w-5 h-5 text-zinc-600" />
                    )}
                  </div>
                  <span className="text-sm text-zinc-300">{t.label}</span>
                </label>
              ))}
            </div>
            {selectedTemplates.size === 0 && (
              <p className="text-xs text-red-400 mt-1">Please select at least one review type.</p>
            )}
          </div>

          {/* Depth Selection */}
          <div className="space-y-3 border-t border-white/5 pt-4">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Depth</h3>
            <div className="flex gap-2">
              {(["quick", "standard", "thorough"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                    depth === d ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              onClick={onCancel}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleRun}
              disabled={loading || selectedTemplates.size === 0 || (scope === "multi_file" && selectedFileIds.length === 0)}
              className="btn-primary flex-1 flex justify-center items-center gap-2"
            >
              {loading ? (
                "Starting..."
              ) : (
                "Run Review"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
