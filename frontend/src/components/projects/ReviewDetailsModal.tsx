import { useEffect, useState } from "react";
import { X, Loader2, Calendar, FileText, CheckCircle2, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";

interface ReviewDetailsModalProps {
  projectId: string;
  reviewId: string;
  onClose: () => void;
}

export default function ReviewDetailsModal({ projectId, reviewId, onClose }: ReviewDetailsModalProps) {
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const data = await api.get(`/projects/${projectId}/reviews/${reviewId}`);
        setReview(data);
      } catch (err) {
        console.error("Failed to fetch review details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReview();
  }, [projectId, reviewId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (!review) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-zinc-900/50">
          <div>
            <h3 className="text-xl font-medium text-zinc-100 flex items-center gap-3">
              Review Details
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${
                review.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                review.status === 'running' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {review.status}
              </span>
            </h3>
            <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(review.created_at).toLocaleString()}</span>
              <span className="flex items-center gap-1.5 capitalize"><FileText className="w-3.5 h-3.5" /> {review.template_type.replace("_", " ")}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#0d1117]">
          
          {/* Summary Section */}
          <section>
            <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">AI Summary</h4>
            {review.summary ? (
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-900/50 p-5 rounded-xl border border-white/5">
                {review.summary}
              </div>
            ) : (
              <div className="text-sm text-zinc-500 italic bg-zinc-900/30 p-4 rounded-lg">No summary generated.</div>
            )}
          </section>

          {/* Stats/Issues Breakdown */}
          <section>
            <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Issue Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {['critical', 'high', 'medium', 'low'].map(sev => {
                 const count = review.issues?.filter((i: any) => i.severity === sev).length || 0;
                 return (
                   <div key={sev} className="bg-zinc-900/50 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                     <span className={`text-2xl font-semibold mb-1 ${
                       sev === 'critical' ? 'text-red-500' :
                       sev === 'high' ? 'text-orange-500' :
                       sev === 'medium' ? 'text-yellow-500' :
                       'text-blue-500'
                     }`}>{count}</span>
                     <span className="text-xs text-zinc-500 uppercase font-medium">{sev}</span>
                   </div>
                 );
               })}
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-zinc-900/80 flex justify-end">
          <button onClick={onClose} className="btn-secondary px-6">Close</button>
        </div>

      </div>
    </div>
  );
}
