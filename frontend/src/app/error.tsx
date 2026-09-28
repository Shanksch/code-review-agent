"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Workspace Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">Something went wrong!</h2>
        <p className="text-zinc-400 text-sm mb-6">
          An unexpected error occurred in the workspace. The error has been logged.
        </p>
        <div className="bg-black/50 rounded p-3 text-xs text-red-400 font-mono text-left mb-6 overflow-x-auto">
          {error.message || "Unknown error"}
        </div>
        <button
          onClick={() => reset()}
          className="w-full flex justify-center items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
