"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { api, uploadFile } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import {
  Upload,
  FolderOpen,
  FileCode2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  ai_provider_config_id: string | null;
  created_at: string;
  file_count: number;
}

export default function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProject = useCallback(async () => {
    try {
      const data = await api.get<Project>(`/projects/${projectId}`);
      setProject(data);
    } catch (e) {
      console.error("Failed to fetch project:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setUploadResult({
        success: false,
        message: "Please upload a ZIP file",
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadFile(`/projects/${projectId}/upload`, formData);
      setUploadResult({
        success: true,
        message: "Files uploaded and extracted successfully!",
      });
      fetchProject(); // Refresh file count
    } catch (e) {
      setUploadResult({
        success: false,
        message: "Upload failed. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">Project not found</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          {project.description && (
            <p className="text-gray-400 mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FileCode2 className="w-3.5 h-3.5" />
              {project.file_count} files
            </span>
          </div>
        </div>

        {/* Upload Section (shown when no files) */}
        {project.file_count === 0 ? (
          <div className="animate-fade-in">
            <div
              className="glass-card p-12 border-2 border-dashed border-surface-4 hover:border-brand-500/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("border-brand-500/50");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("border-brand-500/50");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-brand-500/50");
                const file = e.dataTransfer.files[0];
                if (file) handleUpload(file);
              }}
            >
              <div className="text-center">
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
                    <p className="text-gray-300">
                      Extracting and processing files...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-brand-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Upload Your Code
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Drop a ZIP file here, or click to browse
                    </p>
                    <p className="text-xs text-gray-600">
                      ZIP files up to 50MB • node_modules and build artifacts
                      are automatically excluded
                    </p>
                  </>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />

            {uploadResult && (
              <div
                className={`mt-4 p-4 rounded-lg flex items-center gap-3 animate-fade-in ${
                  uploadResult.success
                    ? "bg-green-500/10 border border-green-500/20 text-green-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}
              >
                {uploadResult.success ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                )}
                <span>{uploadResult.message}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen className="w-5 h-5 text-brand-400" />
              <h2 className="text-lg font-semibold text-white">
                Code Explorer
              </h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="ml-auto btn-ghost text-sm flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Re-upload
              </button>
            </div>
            <p className="text-gray-500 text-sm">
              File tree and code explorer will be built in Day 2.
              <br />
              {project.file_count} files are stored and ready for review.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
