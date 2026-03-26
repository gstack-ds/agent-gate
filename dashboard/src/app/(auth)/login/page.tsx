"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error(error.message);
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw new Error(error.message);
        toast.success("Account created! Check your email to confirm, then sign in.");
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center mb-3">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white font-heading">
              AgentGate
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">
              Authorize your AI agents with confidence
            </p>
          </div>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 font-heading">
            {mode === "login" ? "Sign in" : "Create account"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            {mode === "login"
              ? "Enter your email and password to access the dashboard"
              : "Create an account to start managing your agents"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={6}
                className="border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150"
              disabled={loading}
            >
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline underline-offset-4"
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline underline-offset-4"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
