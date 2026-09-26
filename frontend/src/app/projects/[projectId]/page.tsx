"use client";

import { use, useState, useEffect } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Loader2, UploadCloud, FolderTree, AlertCircle } from "lucide-react";

export default function ProjectWorkspace({ params }: { params: Promise<{ projectId: string }> }) {
  // Use React.use() to unwrap the params promise
  const { projectId } = use(params);
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  
  // Later: treeData, uploading state, etc.

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const data = await api.get(`/projects/${projectId}`);
        setProject(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

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
            <button className="btn-secondary py-1.5 text-sm flex items-center gap-2">
              <UploadCloud className="w-4 h-4" />
              Upload Codebase
            </button>
            <button className="btn-primary py-1.5 text-sm">
              Run Review
            </button>
          </div>
        </div>

        {/* 3-Pane Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: File Tree */}
          <aside className="w-64 border-r border-white/5 bg-zinc-900/20 flex flex-col shrink-0">
            <div className="h-10 flex items-center px-4 border-b border-white/5 text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <FolderTree className="w-4 h-4 mr-2" /> Explorer
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm text-zinc-500 flex items-center justify-center text-center">
              Upload a ZIP file to view your codebase tree.
            </div>
          </aside>

          {/* Center: Code / Issue Tabs */}
          <main className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative">
            <div className="h-10 flex items-center border-b border-white/5 bg-zinc-900/30 shrink-0">
              <div className="px-4 py-2 text-sm font-medium border-b-2 border-sky-500 text-sky-400">
                Code
              </div>
              <div className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-300 cursor-pointer">
                Issue Analysis
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
              <div className="text-center text-zinc-500 max-w-sm">
                <AlertCircle className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p>Select a file from the explorer to view its contents and associated AI review.</p>
              </div>
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
    </ProtectedRoute>
  );
}
