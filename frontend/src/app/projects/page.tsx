"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import ProviderForm from "@/components/providers/ProviderForm";
import { Plus, FolderOpen, Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const router = useRouter();

  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [projData, confData] = await Promise.all([
        api.get<Project[]>("/projects"),
        api.get<ProviderConfig[]>("/ai-provider-configs")
      ]);
      setProjects(projData);
      setConfigs(confData);
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
    if (!selectedConfigId) return;
    setCreating(true);
    try {
      const p = await api.post<Project>("/projects", {
        name: "New Codebase",
        description: "",
        ai_provider_config_id: selectedConfigId
      });
      router.push(`/projects/${p.id}`);
    } catch (err) {
      console.error(err);
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
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
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
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="card p-6 cursor-pointer group hover:border-sky-500/30 transition-all hover:-translate-y-1"
                >
                  <h3 className="text-lg font-medium text-zinc-100 group-hover:text-sky-400 transition-colors mb-2">
                    {p.name}
                  </h3>
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-4">
                    {p.description || "No description provided."}
                  </p>
                  <div className="text-xs font-mono text-zinc-500 pt-4 border-t border-white/5">
                    {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
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
                  <div className="flex justify-between items-center mb-1.5">
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
      </div>
    </ProtectedRoute>
  );
}
