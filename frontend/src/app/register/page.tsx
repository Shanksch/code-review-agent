"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/projects");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-zinc-950">
      {/* Form Side */}
      <div className="flex items-center justify-center p-6 md:p-12 order-2 md:order-1">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-3 mb-12">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <span className="text-sky-400 font-bold font-mono text-xs">AI</span>
            </div>
            <span className="text-xl font-semibold text-zinc-50 tracking-tight">CodeReview</span>
          </div>

          <h1 className="text-3xl font-semibold text-zinc-50 mb-2 tracking-tight">Create an account</h1>
          <p className="text-zinc-400 mb-8">Start auditing your codebases with AI.</p>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all placeholder:text-zinc-600"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all placeholder:text-zinc-600"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-500 hover:bg-sky-400 text-white font-medium py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create account"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="text-sky-400 hover:text-sky-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Brand Side - Hidden on mobile */}
      <div className="hidden md:flex flex-col justify-between p-12 border-l border-white/5 bg-zinc-900/50 backdrop-blur-3xl order-1 md:order-2">
        <div className="flex justify-end">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold text-zinc-50 tracking-tight">CodeReview</span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <span className="text-sky-400 font-bold font-mono text-base">AI</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-medium text-zinc-200 mb-4 tracking-tight">
            Elevate your engineering standards.
          </h2>
          <p className="text-zinc-400 text-lg ml-auto max-w-sm leading-relaxed">
            Automated architecture analysis, security vulnerability detection, and technical debt mapping in seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
