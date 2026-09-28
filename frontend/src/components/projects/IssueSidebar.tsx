import React, { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { TreeNode } from "./FileTree";
import AIChat from "../chat/AIChat";

interface Issue {
  id: string;
  review_id: string;
  file_id?: string;
  file_name?: string;
  file_path?: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  category?: string;
  description: string;
  evidence?: string;
  recommendation?: string;
  line_start?: number;
  line_end?: number;
}

interface IssueSidebarProps {
  projectId: string;
  fileIssues: Issue[];
  selectedFile: TreeNode | null;
  selectedIssue: Issue | null;
  selectedReviewId: string | null;
  contentLoading: boolean;
  rightTab: "issues" | "chat";
  fixes: Record<string, { loading: boolean, diff?: string }>;
  onTabChange: (tab: "issues" | "chat") => void;
  onClearReviewFilter: () => void;
  onIssueClick: (issue: Issue) => void;
  onSuggestFix: (issue: Issue, e: React.MouseEvent) => void;
  onAskAI: (issue: Issue, e: React.MouseEvent) => void;
  getHighlightLines: () => number[];
}

export default function IssueSidebar({
  projectId,
  fileIssues,
  selectedFile,
  selectedIssue,
  selectedReviewId,
  contentLoading,
  rightTab,
  fixes,
  onTabChange,
  onClearReviewFilter,
  onIssueClick,
  onSuggestFix,
  onAskAI,
  getHighlightLines
}: IssueSidebarProps) {
  const [issueSearch, setIssueSearch] = useState("");
  const [issueSeverityFilter, setIssueSeverityFilter] = useState("all");

  return (
    <aside className="w-96 border-l border-white/5 bg-zinc-900/20 flex flex-col shrink-0 relative">
      <div className="h-10 flex border-b border-white/5 bg-zinc-900/30 shrink-0">
        <div
          className={`flex-1 flex items-center justify-center px-4 py-2 text-xs font-medium cursor-pointer tracking-wider uppercase transition-colors ${rightTab === 'issues' ? 'border-b-2 border-sky-500 text-sky-400 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
          onClick={() => onTabChange("issues")}
        >
          Issues {fileIssues.length > 0 ? `(${fileIssues.length})` : ''}
        </div>
        <div
          className={`flex-1 flex items-center justify-center px-4 py-2 text-xs font-medium cursor-pointer tracking-wider uppercase transition-colors ${rightTab === 'chat' ? 'border-b-2 border-emerald-500 text-emerald-400 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
          onClick={() => onTabChange("chat")}
        >
          AI Chat
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        {rightTab === "chat" ? (
          <div className="absolute inset-0">
            <AIChat
              projectId={projectId}
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
                  <button onClick={onClearReviewFilter} className="hover:text-white">&times;</button>
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
                        onClick={() => onIssueClick(issue)}
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
                        <div className={`text-xs text-zinc-500 mb-3 break-words ${selectedIssue?.id === issue.id ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                          {issue.description}
                        </div>

                        {issue.evidence && selectedIssue?.id === issue.id && (
                          <div className="mb-3">
                            <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Why it matters</div>
                            <div className="text-xs text-zinc-400 font-mono bg-zinc-950 p-1.5 rounded border border-white/5 whitespace-pre-wrap break-words">
                              {issue.evidence}
                            </div>
                          </div>
                        )}

                        {issue.recommendation && selectedIssue?.id === issue.id && (
                          <div className="mb-3">
                            <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Recommendation</div>
                            <div className="text-xs text-emerald-400/90 bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20 whitespace-pre-wrap break-words">
                              {issue.recommendation}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            className="flex-1 py-1 text-[10px] font-medium rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onIssueClick(issue);
                            }}
                          >
                            View Code
                          </button>
                          <button
                            className="flex-1 py-1 text-[10px] font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                            onClick={(e) => onSuggestFix(issue, e)}
                            disabled={fixes[issue.id]?.loading}
                          >
                            {fixes[issue.id]?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Suggest Fix"}
                          </button>
                          <button
                            className="flex-1 py-1 text-[10px] font-medium rounded bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors flex items-center justify-center gap-1"
                            onClick={(e) => onAskAI(issue, e)}
                          >
                            Ask AI
                          </button>
                        </div>

                        {fixes[issue.id]?.diff && (
                          <div className="mt-3">
                            <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Suggested Fix</div>
                            <div className="text-xs text-zinc-300 font-mono bg-zinc-950 p-2 rounded border border-white/10 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
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
  );
}
