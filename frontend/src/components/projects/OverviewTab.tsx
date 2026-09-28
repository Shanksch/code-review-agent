import { useState } from "react";
import { FolderTree, Activity, CheckCircle, Clock, ChevronRight, Search, Zap, Check, AlertCircle, ShieldAlert, CheckCircle2 } from "lucide-react";

interface OverviewTabProps {
  stats: any;
  reviews: any[];
  onRunReview?: () => void;
  onReviewClick?: (reviewId: string) => void;
}

export default function OverviewTab({ stats, reviews, onRunReview, onReviewClick }: OverviewTabProps) {
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState("All");

  const severities = stats?.severities || {};
  const totalIssues = stats?.total_issues || 0;
  
  const getSeverityPercent = (sev: string) => {
    if (!totalIssues) return 0;
    return ((severities[sev] || 0) / totalIssues) * 100;
  };

  const filteredReviews = reviews?.filter(r => {
    if (reviewFilter !== "All" && r.status !== reviewFilter.toLowerCase()) return false;
    if (reviewSearch) {
      const term = reviewSearch.toLowerCase();
      return r.scope.toLowerCase().includes(term) || r.template_type.toLowerCase().includes(term) || r.status.includes(term);
    }
    return true;
  }) || [];

  const coverageList = ["general", "security", "performance", "best_practices"];
  const coverageMap = new Set(stats?.coverage || []);

  const latestReview = stats?.latest_review;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 pb-20">
      <h2 className="text-2xl font-semibold text-zinc-100 mb-6">Project Overview</h2>
      
      {/* Top row: Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 hover:bg-zinc-900/70 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <FolderTree className="w-4 h-4 text-sky-500" />
            <h3 className="text-sm text-zinc-400 font-medium">Total Files</h3>
          </div>
          <div className="text-3xl font-semibold text-zinc-100">{stats?.total_files || 0}</div>
        </div>
        
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 hover:bg-zinc-900/70 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm text-zinc-400 font-medium">Reviews Run</h3>
          </div>
          <div className="text-3xl font-semibold text-zinc-100">{stats?.total_reviews || 0}</div>
        </div>
        
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 hover:bg-zinc-900/70 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm text-zinc-400 font-medium">Total Issues</h3>
          </div>
          <div className="text-3xl font-semibold text-zinc-100">{totalIssues}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Breakdown */}
        <div className="lg:col-span-2 bg-zinc-900/30 border border-white/5 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-zinc-500" /> Severity Breakdown
          </h3>
          {totalIssues === 0 ? (
            <div className="text-sm text-zinc-500 py-4">No issues found yet.</div>
          ) : (
            <div className="space-y-4">
              <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                <div style={{ width: `${getSeverityPercent('critical')}%` }} className="h-full bg-red-500" title={`Critical: ${severities.critical || 0}`} />
                <div style={{ width: `${getSeverityPercent('high')}%` }} className="h-full bg-orange-500" title={`High: ${severities.high || 0}`} />
                <div style={{ width: `${getSeverityPercent('medium')}%` }} className="h-full bg-yellow-500" title={`Medium: ${severities.medium || 0}`} />
                <div style={{ width: `${getSeverityPercent('low')}%` }} className="h-full bg-blue-500" title={`Low: ${severities.low || 0}`} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-zinc-400">Critical <span className="text-zinc-200 font-medium">{severities.critical || 0}</span></span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" /><span className="text-zinc-400">High <span className="text-zinc-200 font-medium">{severities.high || 0}</span></span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span className="text-zinc-400">Medium <span className="text-zinc-200 font-medium">{severities.medium || 0}</span></span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-zinc-400">Low <span className="text-zinc-200 font-medium">{severities.low || 0}</span></span></div>
              </div>
            </div>
          )}
        </div>

        {/* Review Coverage */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-zinc-500" /> Review Coverage
          </h3>
          <div className="space-y-3">
            {coverageList.map(type => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 capitalize">{type.replace("_", " ")}</span>
                {coverageMap.has(type) ? (
                  <div className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border border-emerald-500/20">Covered</div>
                ) : (
                  <div className="bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border border-white/5">Pending</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Review Summary */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" /> Latest Review
          </h3>
          {latestReview ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-semibold text-zinc-100">{latestReview.issues_count}</div>
                  <div className="text-sm text-zinc-500">issues detected</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-300 capitalize">{latestReview.template.replace("_", " ")}</div>
                  <div className="text-xs text-zinc-500">{new Date(latestReview.created_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-500">No reviews yet.</div>
          )}
        </div>

        {/* AI Usage Indicator */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-zinc-500" /> AI Usage Activity
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-sm text-zinc-400">Current Model</span>
              <span className="text-sm font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {stats?.ai_model || "Not Configured"}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-sm text-zinc-400">Files Analyzed</span>
              <span className="text-sm text-zinc-200">{stats?.total_files || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Review History */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-medium text-zinc-200">Review History</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search reviews..."
                value={reviewSearch}
                onChange={e => setReviewSearch(e.target.value)}
                className="bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-sky-500/50 w-64"
              />
            </div>
            <select
              value={reviewFilter}
              onChange={e => setReviewFilter(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-sky-500/50 appearance-none"
            >
              <option>All</option>
              <option>Completed</option>
              <option>Running</option>
              <option>Failed</option>
            </select>
          </div>
        </div>
        
        {reviews.length === 0 ? (
          <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-12 text-center flex flex-col items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mb-4" />
            <h4 className="text-lg font-medium text-zinc-200 mb-2">No reviews yet</h4>
            <p className="text-zinc-400 mb-6 max-w-md">Run your first AI code review to identify security, quality, and performance issues.</p>
            {onRunReview && (
              <button onClick={onRunReview} className="btn-primary">
                Run Review
              </button>
            )}
          </div>
        ) : filteredReviews.length > 0 ? (
          <div className="bg-zinc-900/30 border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="p-4 font-medium">Scope / Template</th>
                  <th className="p-4 font-medium">Issues</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredReviews.map((review: any) => (
                  <tr 
                    key={review.id} 
                    className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => onReviewClick && onReviewClick(review.id)}
                  >
                    <td className="p-4">
                      <div className="text-zinc-200 font-medium capitalize mb-1">{review.scope.replace("_", " ")}</div>
                      <div className="text-xs text-zinc-500 capitalize">{review.template_type.replace("_", " ")}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-300 font-medium">{review.issue_count || 0}</span>
                        {review.severities && Object.keys(review.severities).length > 0 && (
                          <div className="flex gap-1">
                            {review.severities.critical > 0 && <span className="w-2 h-2 rounded-full bg-red-500" title={`Critical: ${review.severities.critical}`} />}
                            {review.severities.high > 0 && <span className="w-2 h-2 rounded-full bg-orange-500" title={`High: ${review.severities.high}`} />}
                            {review.severities.medium > 0 && <span className="w-2 h-2 rounded-full bg-yellow-500" title={`Medium: ${review.severities.medium}`} />}
                            {review.severities.low > 0 && <span className="w-2 h-2 rounded-full bg-blue-500" title={`Low: ${review.severities.low}`} />}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-semibold ${
                        review.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        review.status === 'running' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {review.status}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-500 text-right">
                      {new Date(review.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-8 text-center">
            <Search className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No reviews match your search criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
