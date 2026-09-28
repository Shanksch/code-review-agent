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
import AIChat from "@/components/chat/AIChat";
import ProviderSettingsModal from "@/components/projects/ProviderSettingsModal";
import { Loader2, UploadCloud, FolderTree, AlertCircle, RefreshCw, Settings, Check, CheckCircle2 } from "lucide-react";

export default function ProjectWorkspace({ params }: { params: Promise<{ projectId: string }> }) {
  // Use React.use() to unwrap the params promise
  const { projectId } = use(params);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
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
  const [issueSearch, setIssueSearch] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, { loading: boolean, diff?: string }>>({});
  const [issueSeverityFilter, setIssueSeverityFilter] = useState("all");
  const [fileSearch, setFileSearch] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [hasRunningReview, setHasRunningReview] = useState(false);

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
        <div className="h-14 border-b border-white/5 bg-zinc-900/50 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-400">Workspace /</span>
            {isEditingName ? (
              <input
                type="text"
                className="bg-zinc-900 border border-sky-500 rounded px-2 py-0.5 text-zinc-100 font-medium focus:outline-none min-w-[150px]"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                autoFocus
                onBlur={async () => {
                  setIsEditingName(false);
                  const newName = editedName.trim();
                  if (newName && newName !== project?.name) {
                    // Optimistically update the UI instantly
                    const previousName = project?.name;
                    setProject({ ...project, name: newName });

                    try {
                      await api.patch(`/projects/${projectId}`, { name: newName });
                    } catch (err) {
                      console.error("Failed to rename project", err);
                      // Revert on failure
                      setProject({ ...project, name: previousName });
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setEditedName(project?.name || "");
                    setIsEditingName(false);
                  }
                }}
              />
            ) : (
              <span
                className="font-medium text-zinc-100 cursor-text hover:text-sky-400 transition-colors rounded px-1 -ml-1 border border-transparent hover:border-white/10"
                onDoubleClick={() => {
                  setEditedName(project?.name || "");
                  setIsEditingName(true);
                }}
                title="Double click to rename"
              >
                {project?.name}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="btn-secondary py-1.5 text-sm flex items-center gap-2 mr-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            {hasRunningReview && (
              <div className="flex items-center gap-2 px-3 py-1.5 mr-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reviewing...</span>
              </div>
            )}
            <button
              onClick={() => setShowReviewModal(true)}
              disabled={reviewLoading || treeData.length === 0}
              className="btn-primary py-1.5 text-sm flex items-center gap-2"
            >
              {reviewLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
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
            </div>
            <div className="flex-1 overflow-y-auto bg-[#0d1117] relative">
              {activeTab === "overview" ? (
                <OverviewTab stats={stats} reviews={reviews} onRunReview={() => setShowReviewModal(true)} onReviewClick={(rId) => { setSelectedReviewId(rId); setRightTab("issues"); }} />
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
          <aside className="w-96 border-l border-white/5 bg-zinc-900/20 flex flex-col shrink-0 relative">
            <div className="h-10 flex border-b border-white/5 bg-zinc-900/30 shrink-0">
              <div
                className={`flex-1 flex items-center justify-center px-4 py-2 text-xs font-medium cursor-pointer tracking-wider uppercase transition-colors ${rightTab === 'issues' ? 'border-b-2 border-sky-500 text-sky-400 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
                onClick={() => setRightTab("issues")}
              >
                Issues {fileIssues.length > 0 ? `(${fileIssues.length})` : ''}
              </div>
              <div
                className={`flex-1 flex items-center justify-center px-4 py-2 text-xs font-medium cursor-pointer tracking-wider uppercase transition-colors ${rightTab === 'chat' ? 'border-b-2 border-emerald-500 text-emerald-400 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
                onClick={() => setRightTab("chat")}
              >
                AI Chat
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {rightTab === "chat" ? (
                <div className="absolute inset-0">
                  <AIChat
                    projectId={projectId as string}
                    context={{
                      fileId: selectedFile?.id,
                      fileName: selectedFile?.name,
                      issue: selectedIssue,
                      lines: getHighlightLines()
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Issue Filtering Toolbar */}
                  <div className="p-3 border-b border-white/5 bg-zinc-900/30 flex flex-col gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="Search issues..."
                      value={issueSearch}
                      onChange={(e) => setIssueSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/50"
                    />
                    <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
                      {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
                        <button
                          key={sev}
                          onClick={() => setIssueSeverityFilter(sev)}
                          className={`px-2 py-1 text-[10px] uppercase tracking-wider font-medium rounded whitespace-nowrap ${issueSeverityFilter === sev
                              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              : 'bg-zinc-800/50 text-zinc-400 border border-white/5 hover:bg-zinc-800'
                            }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {selectedReviewId && (
                      <div className="mb-3 px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded flex justify-between items-center text-xs text-sky-400">
                        <span>Showing issues for selected review</span>
                        <button onClick={() => setSelectedReviewId(null)} className="hover:text-white">&times;</button>
                      </div>
                    )}
                    {contentLoading ? (
                      <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-zinc-500" /></div>
                    ) : fileIssues.length === 0 ? (
                      <div className="text-sm text-zinc-500 text-center flex flex-col h-full items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-3" />
                        No issues detected. Your code looks clean! 🎉
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {fileIssues
                          .filter(issue => {
                            if (selectedReviewId && issue.review_id !== selectedReviewId) return false;
                            if (issueSeverityFilter !== 'all' && issue.severity !== issueSeverityFilter) return false;
                            if (issueSearch) {
                              const term = issueSearch.toLowerCase();
                              return (issue.title?.toLowerCase().includes(term) || issue.description?.toLowerCase().includes(term) || issue.category?.toLowerCase().includes(term));
                            }
                            return true;
                          })
                          .sort((a, b) => {
                            const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
                            return (rank[b.severity] || 0) - (rank[a.severity] || 0);
                          }).map((issue, idx) => (
                            <div
                              key={issue.id || idx}
                              className="p-3 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-sky-500/30 cursor-pointer transition-colors"
                              onClick={() => handleIssueClick(issue)}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <AlertCircle className={`w-3.5 h-3.5 ${issue.severity === 'critical' ? 'text-red-500' :
                                    issue.severity === 'high' ? 'text-orange-500' :
                                      issue.severity === 'medium' ? 'text-yellow-500' :
                                        'text-blue-500'
                                  }`} />
                                <span className="text-xs font-medium text-zinc-300 truncate">{issue.title}</span>
                              </div>
                              {issue.category && (
                                <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-zinc-500 mb-2 font-medium">
                                  <span className="text-sky-500/80">{issue.category}</span>
                                  {issue.file_name && (
                                    <span className="flex items-center gap-1 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                                      {issue.file_name}{issue.line_start ? `:${issue.line_start}` : ''}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className={`text-xs text-zinc-500 mb-3 ${selectedIssue?.id === issue.id ? '' : 'line-clamp-2'}`}>
                                {issue.description}
                              </div>

                              {issue.evidence && selectedIssue?.id === issue.id && (
                                <div className="mb-3">
                                  <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Why it matters</div>
                                  <div className="text-xs text-zinc-400 font-mono bg-zinc-950 p-1.5 rounded border border-white/5 whitespace-pre-wrap">
                                    {issue.evidence}
                                  </div>
                                </div>
                              )}

                              {issue.recommendation && selectedIssue?.id === issue.id && (
                                <div className="mb-3">
                                  <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Recommendation</div>
                                  <div className="text-xs text-emerald-400/90 bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20 whitespace-pre-wrap">
                                    {issue.recommendation}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <button
                                  className="flex-1 py-1 text-[10px] font-medium rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleIssueClick(issue);
                                  }}
                                >
                                  View Code
                                </button>
                                <button
                                  className="flex-1 py-1 text-[10px] font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                  onClick={(e) => handleSuggestFix(issue, e)}
                                  disabled={fixes[issue.id]?.loading}
                                >
                                  {fixes[issue.id]?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Suggest Fix"}
                                </button>
                                <button
                                  className="flex-1 py-1 text-[10px] font-medium rounded bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors flex items-center justify-center gap-1"
                                  onClick={(e) => handleAskAI(issue, e)}
                                >
                                  Ask AI
                                </button>
                              </div>

                              {fixes[issue.id]?.diff && (
                                <div className="mt-3">
                                  <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Suggested Fix</div>
                                  <div className="text-xs text-zinc-300 font-mono bg-zinc-950 p-2 rounded border border-white/10 max-h-48 overflow-y-auto whitespace-pre-wrap">
                                    {fixes[issue.id]?.diff}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        {fileIssues.length > 0 && fileIssues.filter(issue => {
                          if (issueSeverityFilter !== 'all' && issue.severity !== issueSeverityFilter) return false;
                          if (issueSearch) {
                            const term = issueSearch.toLowerCase();
                            return (issue.title?.toLowerCase().includes(term) || issue.description?.toLowerCase().includes(term) || issue.category?.toLowerCase().includes(term));
                          }
                          return true;
                        }).length === 0 && (
                            <div className="text-sm text-zinc-500 text-center py-4">
                              No issues match your filters.
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
    </ProtectedRoute>
  );
}
