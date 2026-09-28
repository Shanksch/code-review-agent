"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import ProviderForm from "@/components/providers/ProviderForm";
import CodeUploadModal from "@/components/projects/CodeUploadModal";
import { Plus, FolderOpen, Loader2, Trash2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface ProviderConfig {
  id: string;
  model_name: string;
}

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const router = useRouter();

  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [importSource, setImportSource] = useState<"zip" | "github" | "files">("zip");
  
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [projData, confData, statsData] = await Promise.all([
        api.get<Project[]>("/projects"),
        api.get<ProviderConfig[]>("/ai-provider-configs"),
        api.get<Record<string, any>>("/projects/batch-stats")
      ]);
      setProjects(projData);
      setConfigs(confData);
      setStats(statsData || {});
      if (confData.length > 0) setSelectedConfigId(confData[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfigId || !projectName.trim()) return;
    setCreating(true);
    try {
      const p = await api.post<Project>("/projects", {
        name: projectName.trim(),
        description: projectDescription.trim(),
        ai_provider_config_id: selectedConfigId
      });
      setShowNewProject(false);
      setCreatedProjectId(p.id);
      // Let the CodeUploadModal handle the next steps
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-zinc-950">
        <Navbar />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-50 tracking-tight mb-2">Projects</h1>
              <p className="text-zinc-400">Manage your codebases and AI review runs.</p>
            </div>
            <button
              onClick={() => setShowNewProject(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-6 h-48 flex flex-col justify-between animate-pulse bg-zinc-900/30 border-white/5">
                  <div>
                    <div className="h-6 w-1/2 bg-zinc-800/80 rounded mb-3"></div>
                    <div className="h-4 w-3/4 bg-zinc-800/50 rounded mb-1.5"></div>
                    <div className="h-4 w-2/3 bg-zinc-800/50 rounded"></div>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/5 pt-4 mt-4">
                    <div className="flex gap-2">
                      <div className="h-3 w-12 bg-zinc-800/80 rounded"></div>
                      <div className="h-3 w-12 bg-zinc-800/80 rounded"></div>
                    </div>
                    <div className="h-3 w-20 bg-zinc-800/80 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="card border-dashed border-white/10 bg-zinc-900/30 flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6">
                <FolderOpen className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-medium text-zinc-200 mb-2">No projects yet</h3>
              <p className="text-zinc-500 max-w-sm mb-6">
                Create your first project, upload a codebase, and start running automated AI reviews.
              </p>
              <button onClick={() => setShowNewProject(true)} className="btn-secondary">
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((p) => {
                const projectStats = stats[p.id] || { files: 0, reviews: 0, issues: 0, severities: {}, last_reviewed: null };
                const sevs = projectStats.severities || {};
                
                // Helper to render severity dots
                const hasCritical = sevs.critical > 0;
                const hasHigh = sevs.high > 0;
                const hasMedium = sevs.medium > 0;
                const hasLow = sevs.low > 0;
                
                return (
                  <div
                    key={p.id}
                    className="card p-6 cursor-pointer group hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10 transition-all duration-300 hover:-translate-y-1 relative flex flex-col h-full"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this project?")) {
                          try {
                            await api.delete(`/projects/${p.id}`);
                            fetchData();
                          } catch (err) {
                            console.error("Failed to delete project", err);
                          }
                        }
                      }}
                      className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <h3 className="text-lg font-medium text-zinc-100 group-hover:text-sky-400 transition-colors mb-2 pr-8">
                      {p.name}
                    </h3>
                    
                    <p className="text-sm text-zinc-400 line-clamp-2 mb-4 flex-1">
                      {p.description || "No description provided."}
                    </p>
                    
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 font-medium">
                        <span>{projectStats.files} files</span>
                        <span>&middot;</span>
                        <span>{projectStats.issues} issues</span>
                        <span>&middot;</span>
                        <span>{projectStats.reviews} reviews</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          {hasCritical && <span className="w-2.5 h-2.5 rounded-full bg-red-500" title="Critical Issues" />}
                          {hasHigh && <span className="w-2.5 h-2.5 rounded-full bg-orange-500" title="High Issues" />}
                          {hasMedium && <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" title="Medium Issues" />}
                          {hasLow && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" title="Low Issues" />}
                          {!hasCritical && !hasHigh && !hasMedium && !hasLow && (
                            <span className="text-xs text-zinc-600">No issues</span>
                          )}
                        </div>
                        
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          {projectStats.last_reviewed ? (
                            `Reviewed ${new Date(projectStats.last_reviewed).toLocaleDateString()}`
                          ) : (
                            "Not reviewed yet"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* New Project Modal */}
        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <div className="card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
              <h2 className="text-xl font-semibold text-zinc-50 tracking-tight mb-6">Create Project</h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="label-text">Project Name</label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. My Awesome App"
                    className="input-field"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="label-text">Description <span className="text-zinc-500 font-normal">(optional)</span></label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="What does this project do?"
                    className="input-field resize-none h-20"
                  />
                </div>



                <div>
                  <div className="flex justify-between items-center mb-1.5 mt-2">
                    <label className="label-text mb-0">AI Provider Config</label>
                    <button
                      type="button"
                      onClick={() => setShowProviderForm(true)}
                      className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      + Add New
                    </button>
                  </div>
                  {configs.length === 0 ? (
                    <div className="text-sm text-yellow-400 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                      You need to add an AI Provider config first.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedConfigId}
                      onChange={(e) => setSelectedConfigId(e.target.value)}
                      className="input-field appearance-none bg-zinc-900"
                    >
                      {configs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.model_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <button type="button" onClick={() => setShowNewProject(false)} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || configs.length === 0}
                    className="btn-primary flex-1 flex justify-center items-center"
                  >
                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Provider Form Modal */}
        {showProviderForm && (
          <ProviderForm
            onCancel={() => setShowProviderForm(false)}
            onSuccess={async (newId) => {
              setShowProviderForm(false);
              await fetchData();
              setSelectedConfigId(newId);
            }}
          />
        )}

        {/* Code Upload Modal (shown immediately after project creation) */}
        {createdProjectId && (
          <CodeUploadModal
            projectId={createdProjectId}
            initialMode={importSource}
            onSuccess={() => {
              router.push(`/projects/${createdProjectId}`);
            }}
            onCancel={() => {
              setCreatedProjectId(null);
              fetchData();
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
