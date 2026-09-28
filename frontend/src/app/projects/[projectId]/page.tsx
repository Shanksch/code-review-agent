"use client";

import { use, useState, useEffect } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import CodeUploadModal from "@/components/projects/CodeUploadModal";
import FileTree, { TreeNode } from "@/components/projects/FileTree";
import ReviewScopeModal, { ReviewOptions } from "@/components/projects/ReviewScopeModal";
import CodeViewer from "@/components/projects/CodeViewer";
import OverviewTab from "@/components/projects/OverviewTab";
import ProviderSettingsModal from "@/components/projects/ProviderSettingsModal";
import WorkspaceToolbar from "@/components/projects/WorkspaceToolbar";
import IssueSidebar from "@/components/projects/IssueSidebar";
import { Loader2, UploadCloud, FolderTree, AlertCircle, RefreshCw } from "lucide-react";

export interface Project {
  id: string;
  name: string;
  description?: string;
  ai_provider_config_id?: string;
}

export interface AIConfig {
  id: string;
  name: string;
  [key: string]: any;
}

export interface Review {
  id: string;
  status: string;
  summary?: string;
  created_at: string;
  [key: string]: any;
}

export default function ProjectWorkspace({ params }: { params: Promise<{ projectId: string }> }) {
  // Use React.use() to unwrap the params promise
  const { projectId } = use(params);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  // Tree state
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);

  // File state
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileIssues, setFileIssues] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "code">("overview");
  const [rightTab, setRightTab] = useState<"issues" | "chat">("issues");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, { loading: boolean, diff?: string }>>({});
  const [fileSearch, setFileSearch] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [hasRunningReview, setHasRunningReview] = useState(false);
  
  const [docsLoading, setDocsLoading] = useState(false);
  const [testsLoading, setTestsLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{title: string, content: string} | null>(null);

  const handleGenerateDocs = async () => {
    setDocsLoading(true);
    try {
      const data = await api.post(`/projects/${projectId}/generate-docs`, {});
      setGeneratedResult({ title: "Generated Documentation", content: data.documentation });
    } catch (err) {
      alert("Failed to generate docs");
    } finally {
      setDocsLoading(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!selectedFile?.id) return;
    setTestsLoading(true);
    try {
      const data = await api.post(`/projects/${projectId}/files/${selectedFile.id}/generate-tests`, {});
      setGeneratedResult({ title: `Generated Tests for ${selectedFile.name}`, content: data.tests });
    } catch (err) {
      alert("Failed to generate tests");
    } finally {
      setTestsLoading(false);
    }
  };

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
        const [projData, confData, statsData, reviewsData, issuesData] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get("/ai-provider-configs"),
          api.get(`/projects/${projectId}/stats`),
          api.get(`/projects/${projectId}/reviews`),
          api.get(`/projects/${projectId}/issues`)
        ]);
        setProject(projData);
        setConfigs(confData);
        setStats(statsData);
        setReviews(reviewsData.reviews);
        setHasRunningReview(reviewsData.reviews.some((r: any) => r.status === "running"));
        setFileIssues(issuesData.issues || []);
        await fetchTree();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  // Polling for running reviews
  useEffect(() => {
    if (!hasRunningReview) return;

    const interval = setInterval(async () => {
      try {
        const [reviewsData, statsData, issuesData] = await Promise.all([
          api.get(`/projects/${projectId}/reviews`),
          api.get(`/projects/${projectId}/stats`),
          api.get(`/projects/${projectId}/issues`)
        ]);

        setReviews(reviewsData.reviews);
        setStats(statsData);

        const isStillRunning = reviewsData.reviews.some((r: any) => r.status === "running");
        setHasRunningReview(isStillRunning);

        // If it just finished, we want to update the file issues and tree
        if (!isStillRunning) {
          if (!selectedFile || selectedFile.type === "directory") {
            setFileIssues(issuesData.issues || []);
          }
          await fetchTree();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [hasRunningReview, projectId, selectedFile]);

  const handleFileSelect = async (node: TreeNode) => {
    setSelectedFile(node);
    setSelectedIssue(null); // Clear selected issue when switching files
    setContentLoading(true);
    try {
      if (node.type === "directory") {
        const issuesData = await api.get(`/projects/${projectId}/issues?path_prefix=${encodeURIComponent(node.path || "")}`);
        setFileIssues(issuesData.issues || []);
        setFileContent("");
        setActiveTab("overview");
      } else if (node.id) {
        const data = await api.get(`/projects/${projectId}/files/${node.id}`);
        setFileContent(data.content || "/* File is empty or could not be read */");
        setFileIssues(data.issues || []);
        setActiveTab("code");
      }
    } catch (err) {
      console.error("Failed to fetch file content or issues:", err);
      if (node.type !== "directory") {
        setFileContent("/* Failed to load file content */");
      }
      setFileIssues([]);
    } finally {
      setContentLoading(false);
    }
  };

  const [reviewLoading, setReviewLoading] = useState(false);

  const runReview = async (options: ReviewOptions) => {
    setReviewLoading(true);
    try {
      await api.post(`/projects/${projectId}/reviews`, {
        scope: options.scope,
        file_ids: options.fileIds,
        template_types: options.templateTypes,
        depth: options.depth
      });
      setShowReviewModal(false);
      setHasRunningReview(true);
      // Wait a moment for background task to initialize
      setTimeout(() => fetchTree(), 1000);
    } catch (err) {
      console.error("Failed to run review:", err);
      alert("Failed to run review. Check console for details.");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleIssueClick = (issue: any) => {
    setSelectedIssue(issue);
    if (issue.file_id && (!selectedFile || selectedFile.id !== issue.file_id)) {
      handleFileSelect({
        id: issue.file_id,
        name: issue.file_name || "Unknown File",
        path: issue.file_path,
        type: "file"
      });
    } else {
      setActiveTab("code");
    }
  };

  const handleAskAI = (issue: any, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent clicking the card from opening code if they just want to ask AI
    setSelectedIssue(issue);

    // Auto-select the file if needed, just like clicking the issue
    if (issue.file_id && (!selectedFile || selectedFile.id !== issue.file_id)) {
      handleFileSelect({
        id: issue.file_id,
        name: issue.file_name || "Unknown File",
        path: issue.file_path,
        type: "file"
      });
    }
    setRightTab("chat");
  };

  const handleSuggestFix = async (issue: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!issue.id) return;

    setFixes(prev => ({ ...prev, [issue.id]: { loading: true } }));

    try {
      const data = await api.post(`/projects/${projectId}/issues/${issue.id}/suggest-fix`, {});
      setFixes(prev => ({ ...prev, [issue.id]: { loading: false, diff: data.diff } }));
    } catch (err: any) {
      console.error("Failed to generate fix", err);
      setFixes(prev => ({ ...prev, [issue.id]: { loading: false, diff: `Error generating fix: ${err.message}` } }));
    }
  };

  const getHighlightLines = () => {
    if (!selectedIssue || !selectedIssue.line_start) return [];
    const lines = [];
    const start = selectedIssue.line_start;
    const end = selectedIssue.line_end || selectedIssue.line_start;
    for (let i = start; i <= end; i++) lines.push(i);
    return lines;
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
        <WorkspaceToolbar
          projectId={projectId as string}
          projectName={project?.name || ""}
          hasRunningReview={hasRunningReview}
          reviewLoading={reviewLoading}
          treeDataLength={treeData.length}
          onProjectNameUpdate={(newName) => setProject({ ...project, name: newName })}
          onOpenSettings={() => setShowSettingsModal(true)}
          onRunReview={() => setShowReviewModal(true)}
        />

        {/* 3-Pane Layout */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left: File Tree */}
          <aside className="w-64 border-r border-white/5 bg-zinc-900/20 flex flex-col shrink-0 overflow-hidden">
            <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 text-xs font-medium text-zinc-400 uppercase tracking-wider shrink-0">
              <span className="flex items-center"><FolderTree className="w-4 h-4 mr-2" /> Explorer</span>
              <button onClick={fetchTree} className="hover:text-zinc-200 transition-colors" title="Refresh Tree">
                <RefreshCw className={`w-3.5 h-3.5 ${treeLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="p-2 border-b border-white/5 bg-zinc-900/30">
              <input
                type="text"
                placeholder="Search files..."
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {treeLoading ? (
                <div className="flex flex-col gap-3 p-4">
                  <div className="w-full h-5 bg-zinc-800/50 rounded animate-pulse"></div>
                  <div className="w-3/4 h-5 bg-zinc-800/50 rounded animate-pulse ml-4"></div>
                  <div className="w-2/3 h-5 bg-zinc-800/50 rounded animate-pulse ml-4"></div>
                  <div className="w-5/6 h-5 bg-zinc-800/50 rounded animate-pulse"></div>
                  <div className="w-3/4 h-5 bg-zinc-800/50 rounded animate-pulse ml-8"></div>
                  <div className="w-1/2 h-5 bg-zinc-800/50 rounded animate-pulse ml-8"></div>
                </div>
              ) : treeData.length > 0 ? (
                <FileTree
                  data={
                    (() => {
                      const getFilteredTree = (nodes: TreeNode[], term: string): TreeNode[] => {
                        if (!term) return nodes;
                        const lowerTerm = term.toLowerCase();

                        return nodes.map(node => {
                          if (node.type === "directory") {
                            const filteredChildren = getFilteredTree(node.children || [], term);
                            if (node.name.toLowerCase().includes(lowerTerm) || filteredChildren.length > 0) {
                              return { ...node, children: filteredChildren };
                            }
                            return null;
                          }
                          if (node.name.toLowerCase().includes(lowerTerm)) {
                            return node;
                          }
                          return null;
                        }).filter(Boolean) as TreeNode[];
                      };
                      return getFilteredTree(treeData, fileSearch);
                    })()
                  }
                  onFileSelect={handleFileSelect}
                  selectedFileId={selectedFile?.id}
                />
              ) : (
                <div className="p-6 text-sm text-zinc-500 text-center">
                  No codebase uploaded.
                </div>
              )}
            </div>
          </aside>

          {/* Center: Code / Issue Tabs */}
          <main className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative">
            <div className="h-10 flex items-center border-b border-white/5 bg-zinc-900/30 shrink-0">
              <div
                className={`px-4 py-2 text-sm font-medium cursor-pointer ${activeTab === 'overview' ? 'border-b-2 border-sky-500 text-sky-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                onClick={async () => {
                  setActiveTab("overview");
                  setSelectedReviewId(null);
                  if (selectedFile) {
                    setSelectedFile(null);
                    try {
                      setContentLoading(true);
                      const issuesData = await api.get(`/projects/${projectId}/issues`);
                      setFileIssues(issuesData.issues || []);
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setContentLoading(false);
                    }
                  }
                }}
              >
                Overview
              </div>
              <div
                className={`px-4 py-2 text-sm font-medium ${!selectedFile || selectedFile.type === 'directory' ? 'opacity-50 cursor-not-allowed text-zinc-600' : 'cursor-pointer'} ${activeTab === 'code' ? 'border-b-2 border-sky-500 text-sky-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                onClick={() => {
                  if (selectedFile && selectedFile.type !== 'directory') {
                    setActiveTab("code");
                  }
                }}
              >
                Code {selectedFile && selectedFile.type !== 'directory' ? `- ${selectedFile.name}` : ''}
              </div>
              <div className="ml-auto flex items-center pr-4 gap-2">
                 {activeTab === "code" && selectedFile?.type !== 'directory' && (
                    <button className="btn-secondary py-1 px-3 text-xs" onClick={handleGenerateTests} disabled={testsLoading}>
                       {testsLoading ? <><Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> Generating...</> : 'Generate Tests'}
                    </button>
                 )}
                 {activeTab === "overview" && (
                    <button className="btn-secondary py-1 px-3 text-xs" onClick={handleGenerateDocs} disabled={docsLoading}>
                       {docsLoading ? <><Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> Generating...</> : 'Generate Docs'}
                    </button>
                 )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#0d1117] relative">
              {activeTab === "overview" ? (
                <OverviewTab projectId={projectId as string} stats={stats} reviews={reviews} onRunReview={() => setShowReviewModal(true)} onReviewClick={(rId) => { setSelectedReviewId(rId); setRightTab("issues"); }} />
              ) : treeData.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="text-center max-w-sm">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-6 border border-white/5">
                      <UploadCloud className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h3 className="text-xl font-medium text-zinc-200 mb-2">Import your codebase</h3>
                    <p className="text-zinc-500 mb-6 text-sm">
                      Upload a ZIP file or import a GitHub repository to build the file tree and run AI reviews.
                    </p>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="btn-primary flex items-center gap-2 mx-auto"
                    >
                      <UploadCloud className="w-4 h-4" />
                      Import Codebase
                    </button>
                  </div>
                </div>
              ) : !selectedFile ? (
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
                <CodeViewer
                  content={fileContent || ""}
                  language={selectedFile?.name?.split('.').pop() || "typescript"}
                  highlightLines={getHighlightLines()}
                  severity={selectedIssue?.severity || "low"}
                  activeIssueId={selectedIssue?.id}
                  onAskAI={(prompt, code) => {
                    setRightTab("chat");
                    window.dispatchEvent(new CustomEvent('ai-chat-prompt', { detail: { prompt, code } }));
                  }}
                />
              )}
            </div>
          </main>

          {/* Right: Issue Sidebar & AI Chat */}
          <IssueSidebar
            projectId={projectId as string}
            fileIssues={fileIssues}
            selectedFile={selectedFile}
            selectedIssue={selectedIssue}
            selectedReviewId={selectedReviewId}
            contentLoading={contentLoading}
            rightTab={rightTab}
            fixes={fixes}
            onTabChange={setRightTab}
            onClearReviewFilter={() => setSelectedReviewId(null)}
            onIssueClick={handleIssueClick}
            onSuggestFix={handleSuggestFix}
            onAskAI={handleAskAI}
            getHighlightLines={getHighlightLines}
          />

        </div>
      </div>

      {showUploadModal && (
        <CodeUploadModal
          projectId={projectId}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchTree();
            api.get(`/projects/${projectId}`).then(setProject);
          }}
          onCancel={() => setShowUploadModal(false)}
        />
      )}

      {showSettingsModal && (
        <ProviderSettingsModal
          projectId={projectId as string}
          currentConfigId={project?.ai_provider_config_id || null}
          configs={configs}
          stats={stats}
          onClose={() => setShowSettingsModal(false)}
          onSave={(configId, updatedConfig) => {
            setProject((prev: any) => prev ? { ...prev, ai_provider_config_id: configId } : null);
            setConfigs(prev => {
              const exists = prev.find(c => c.id === configId);
              if (exists) {
                return prev.map(c => c.id === configId ? updatedConfig : c);
              }
              return [...prev, updatedConfig];
            });
          }}
        />
      )}
      {showReviewModal && (
        <ReviewScopeModal
          currentFileId={selectedFile?.id}
          currentFileName={selectedFile?.name}
          treeData={treeData}
          onRun={runReview}
          onCancel={() => setShowReviewModal(false)}
          loading={reviewLoading}
        />
      )}

      {generatedResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-zinc-100">{generatedResult.title}</h3>
              <button onClick={() => setGeneratedResult(null)} className="text-zinc-500 hover:text-white">&times;</button>
            </div>
            <div className="flex-1 overflow-auto bg-[#0d1117] rounded-lg border border-white/5 p-4 text-sm text-zinc-300 font-mono whitespace-pre-wrap">
              {generatedResult.content}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setGeneratedResult(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
