"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import ProviderForm from "@/components/providers/ProviderForm";
import {
  Plus,
  FolderOpen,
  Trash2,
  FileCode2,
  Calendar,
  Loader2,
  ChevronDown,
  Cpu,
  X,
} from "lucide-react";

interface AiProviderConfig {
  id: string;
  name: string;
  base_url: string;
  api_key_set: boolean;
  model_name: string;
  is_default: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string;
  ai_provider_config_id: string | null;
  created_at: string;
  file_count: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [providers, setProviders] = useState<AiProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    ai_provider_config_id: "" as string,
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const [projectsRes, providersRes] = await Promise.all([
        api.get<{ projects: Project[]; total: number }>("/projects"),
        api.get<AiProviderConfig[]>("/ai-provider-configs"),
      ]);
      setProjects(projectsRes.projects);
      setProviders(providersRes);
    } catch (e) {
      console.error("Failed to fetch data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;

    setCreating(true);
    try {
      const project = await api.post<Project>("/projects", {
        name: newProject.name,
        description: newProject.description,
        ai_provider_config_id: newProject.ai_provider_config_id || null,
      });
      setProjects((prev) => [project, ...prev]);
      setShowCreateModal(false);
      setNewProject({ name: "", description: "", ai_provider_config_id: "" });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return;
    
    setDeleting(projectId);
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (e) {
      console.error("Failed to delete project:", e);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <ProtectedRoute>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Projects</h1>
            <p className="text-gray-400 mt-1">
              Upload code and get AI-powered reviews
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-surface-2 border border-surface-4 flex items-center justify-center mx-auto mb-5">
              <FolderOpen className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">
              No projects yet
            </h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Create your first project to start uploading code and running AI reviews.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <div
                key={project.id}
                className="glass-card p-5 hover:border-brand-500/20 transition-all cursor-pointer group animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-600/10 border border-brand-500/20 flex items-center justify-center">
                    <FileCode2 className="w-5 h-5 text-brand-400" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project.id);
                    }}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    {deleting === project.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-brand-300 transition-colors">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-600 mt-auto pt-2 border-t border-white/5">
                  <span className="flex items-center gap-1">
                    <FileCode2 className="w-3 h-3" />
                    {project.file_count} files
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <div className="relative glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-semibold text-white">
                  New Project
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-surface-3"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject((p) => ({ ...p, name: e.target.value }))
                    }
                    className="input-field"
                    placeholder="e.g. Portfolio Website"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Description
                    <span className="text-gray-600 text-xs ml-1.5">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    className="input-field resize-none h-20"
                    placeholder="Brief description of the project..."
                  />
                </div>

                {/* Provider selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    <Cpu className="w-3.5 h-3.5 inline mr-1.5 opacity-60" />
                    AI Provider
                  </label>

                  {!showProviderForm ? (
                    <>
                      {providers.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            value={newProject.ai_provider_config_id}
                            onChange={(e) =>
                              setNewProject((p) => ({
                                ...p,
                                ai_provider_config_id: e.target.value,
                              }))
                            }
                            className="input-field"
                          >
                            <option value="">Select a provider...</option>
                            {providers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.model_name})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowProviderForm(true)}
                            className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
                          >
                            + Add new provider
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">
                            No providers configured yet.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowProviderForm(true)}
                            className="btn-ghost text-sm border border-dashed border-surface-4"
                          >
                            <Plus className="w-3.5 h-3.5 inline mr-1" />
                            Configure AI Provider
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="glass-card p-4 mt-2">
                      <ProviderForm
                        onCreated={(config) => {
                          setProviders((prev) => [config, ...prev]);
                          setNewProject((p) => ({
                            ...p,
                            ai_provider_config_id: config.id,
                          }));
                          setShowProviderForm(false);
                        }}
                        onCancel={() => setShowProviderForm(false)}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={creating || !newProject.name.trim()}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create Project
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
