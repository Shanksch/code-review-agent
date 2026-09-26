"use client";

import { use, useState, useEffect } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import CodeUploadModal from "@/components/projects/CodeUploadModal";
import FileTree, { TreeNode } from "@/components/projects/FileTree";
import { Loader2, UploadCloud, FolderTree, AlertCircle, RefreshCw, Settings, Check } from "lucide-react";

export default function ProjectWorkspace({ params }: { params: Promise<{ projectId: string }> }) {
  // Use React.use() to unwrap the params promise
  const { projectId } = use(params);
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  
  useEffect(() => {
    if (showSettingsModal && project?.ai_provider_config_id) {
      const fetchModels = async () => {
        setFetchingModels(true);
        try {
          const res = await api.get(`/ai-provider-configs/${project.ai_provider_config_id}/models`);
          setAvailableModels(res.models);
          const currentConfig = configs.find(c => c.id === project.ai_provider_config_id);
          setSelectedModel(currentConfig?.model_name || "");
        } catch (err) {
          console.error("Failed to fetch models", err);
          setAvailableModels([]);
          const currentConfig = configs.find(c => c.id === project.ai_provider_config_id);
          setSelectedModel(currentConfig?.model_name || "");
        } finally {
          setFetchingModels(false);
        }
      };
      fetchModels();
    }
  }, [showSettingsModal, project?.ai_provider_config_id, configs]);
  
  // Tree state
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  
  // File state
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const fetchTree = async () => {
    setTreeLoading(true);
    try {
      const data = await api.get(`/projects/${projectId}/tree`);
      setTreeData(data.tree);
    } catch (err) {
      console.error("Failed to fetch tree:", err);
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const [projData, confData] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get("/ai-provider-configs")
        ]);
        setProject(projData);
        setConfigs(confData);
        await fetchTree();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const handleFileSelect = async (node: TreeNode) => {
    setSelectedFile(node);
    if (!node.id) return;
    
    setContentLoading(true);
    try {
      const data = await api.get(`/projects/${projectId}/files/${node.id}`);
      setFileContent(data.content || "/* File is empty or could not be read */");
    } catch (err) {
      console.error("Failed to fetch file content:", err);
      setFileContent("/* Failed to load file content */");
    } finally {
      setContentLoading(false);
    }
  };

  const [reviewLoading, setReviewLoading] = useState(false);

  const runReview = async () => {
    setReviewLoading(true);
    try {
      await api.post(`/projects/${projectId}/reviews`, {});
      // Refresh tree to get new severity colors
      await fetchTree();
    } catch (err) {
      console.error("Failed to run review:", err);
      alert("Failed to run review. Check console for details.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-zinc-950 flex flex-col overflow-hidden h-screen">
        <Navbar />
        
        {/* Workspace Toolbar */}
        <div className="h-14 border-b border-white/5 bg-zinc-900/50 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-400">Workspace /</span>
            <span className="font-medium text-zinc-100">{project?.name}</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="btn-secondary py-1.5 text-sm flex items-center gap-2 mr-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="btn-secondary py-1.5 text-sm flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Codebase
            </button>
            <button 
              onClick={runReview}
              disabled={reviewLoading || treeData.length === 0}
              className="btn-primary py-1.5 text-sm flex items-center gap-2"
            >
              {reviewLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                "Run Review"
              )}
            </button>
          </div>
        </div>

        {/* 3-Pane Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: File Tree */}
          <aside className="w-64 border-r border-white/5 bg-zinc-900/20 flex flex-col shrink-0 overflow-hidden">
            <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 text-xs font-medium text-zinc-400 uppercase tracking-wider shrink-0">
              <span className="flex items-center"><FolderTree className="w-4 h-4 mr-2" /> Explorer</span>
              <button onClick={fetchTree} className="hover:text-zinc-200 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${treeLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {treeLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
                </div>
              ) : treeData.length > 0 ? (
                <FileTree 
                  data={treeData} 
                  onFileSelect={handleFileSelect}
                  selectedFileId={selectedFile?.id}
                />
              ) : (
                <div className="p-6 text-sm text-zinc-500 text-center">
                  Upload a ZIP file to view your codebase tree.
                </div>
              )}
            </div>
          </aside>

          {/* Center: Code / Issue Tabs */}
          <main className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative">
            <div className="h-10 flex items-center border-b border-white/5 bg-zinc-900/30 shrink-0">
              <div className="px-4 py-2 text-sm font-medium border-b-2 border-sky-500 text-sky-400">
                Code {selectedFile ? `- ${selectedFile.name}` : ''}
              </div>
              <div className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-300 cursor-pointer">
                Issue Analysis
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#0d1117] relative">
              {!selectedFile ? (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="text-center text-zinc-500 max-w-sm">
                    <AlertCircle className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                    <p>Select a file from the explorer to view its contents and associated AI review.</p>
                  </div>
                </div>
              ) : contentLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                </div>
              ) : (
                <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
                  <code>{fileContent}</code>
                </pre>
              )}
            </div>
          </main>

          {/* Right: Issue Sidebar */}
          <aside className="w-80 border-l border-white/5 bg-zinc-900/20 flex flex-col shrink-0">
            <div className="h-10 flex items-center px-4 border-b border-white/5 text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Detected Issues
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm text-zinc-500 flex items-center justify-center text-center">
              No issues detected for this file.
            </div>
          </aside>

        </div>
      </div>

      {showUploadModal && (
        <CodeUploadModal
          projectId={projectId}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchTree();
          }}
          onCancel={() => setShowUploadModal(false)}
        />
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-semibold text-zinc-50 tracking-tight mb-6">Project Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="label-text">AI Provider</label>
                <select
                  value={project?.ai_provider_config_id || ""}
                  onChange={(e) => setProject({ ...project, ai_provider_config_id: e.target.value })}
                  className="input-field appearance-none bg-zinc-900"
                >
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.model_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-text">Select Model</label>
                {fetchingModels ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400 mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Fetching available models...
                  </div>
                ) : availableModels.length > 0 ? (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="input-field appearance-none bg-zinc-900 mt-1"
                  >
                    {availableModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="input-field mt-1"
                    placeholder="Enter model name"
                  />
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowSettingsModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setSavingSettings(true);
                    try {
                      await api.patch(`/projects/${projectId}`, {
                        ai_provider_config_id: project.ai_provider_config_id
                      });
                      if (selectedModel) {
                        await api.patch(`/ai-provider-configs/${project.ai_provider_config_id}`, {
                          model_name: selectedModel
                        });
                      }
                      setConfigs(configs.map(c => 
                        c.id === project.ai_provider_config_id 
                          ? { ...c, model_name: selectedModel }
                          : c
                      ));
                      setShowSettingsModal(false);
                    } catch(err) {
                      console.error(err);
                      alert("Failed to save settings");
                    } finally {
                      setSavingSettings(false);
                    }
                  }}
                  disabled={savingSettings}
                  className="btn-primary flex-1 flex justify-center items-center"
                >
                  {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
